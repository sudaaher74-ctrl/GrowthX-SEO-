import { Injectable, Logger } from '@nestjs/common';
import { Project, SyntaxKind, ObjectLiteralExpression, Node, ReturnStatement } from 'ts-morph';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MultiAiRouterService, AiTask } from '../../../ai-search/multi-ai-router/multi-ai-router.service';
import { IssueAnalysisResult } from '../issue-analysis/issue-analysis.service';

export type PatchTarget = 'nextjs-metadata' | 'html';

export interface PatchOutcome {
  applied: boolean;
  /** Why a patch was skipped — surfaced in the PR body rather than swallowed. */
  reason?: string;
}

/**
 * Applies an approved SEO fix to a file in the customer's repository.
 *
 * Two file shapes are supported: a Next.js `metadata` export (App Router) and
 * plain HTML. The right one is chosen from the file extension unless the caller
 * forces it.
 */
@Injectable()
export class PatchGenerationService {
  private readonly logger = new Logger(PatchGenerationService.name);

  constructor(private readonly aiRouter: MultiAiRouterService) {}

  /** Extension-based dispatch, so callers do not have to know the file shape. */
  detectTarget(filePath: string): PatchTarget {
    return /\.(html?|htm)$/i.test(path.extname(filePath)) ? 'html' : 'nextjs-metadata';
  }

  // ------------------------------------------------------------ AI Generation

  /**
   * Generates a code patch using AI based on the issue analysis strategy.
   * Replaces the entire file content with the AI's updated version.
   */
  async generatePatch(filePath: string, issueAnalysis: IssueAnalysisResult, organizationId?: string): Promise<PatchOutcome> {
    this.logger.log(`Generating AI patch for ${filePath}...`);
    
    let fileContent: string;
    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      return { applied: false, reason: `Could not read file at ${filePath}: ${e.message}` };
    }

    const prompt = `
You are an expert software engineer. You need to apply an SEO fix to the following file.

Fix Strategy:
${issueAnalysis.strategy}

File Path: ${filePath}
Original File Content:
\`\`\`
${fileContent}
\`\`\`

Apply the fix strategy to the file content. 
Return the COMPLETE, updated file content. Do not truncate the file or use placeholders like "// ... rest of code".
Respond strictly with a JSON object.
`;

    const jsonSchema = {
      type: 'object',
      properties: {
        updatedContent: { type: 'string', description: 'The fully updated file content with the fix applied.' },
      },
      required: ['updatedContent']
    };

    const completion = await this.aiRouter.generate({
      prompt,
      systemInstruction: 'You are a technical SEO expert and software engineer.',
      task: AiTask.CODE_GEN,
      organizationId,
      jsonSchema
    });

    try {
      const result = JSON.parse(completion.text);
      if (!result.updatedContent || result.updatedContent.trim() === '') {
        return { applied: false, reason: 'AI returned empty content.' };
      }
      
      await fs.writeFile(filePath, result.updatedContent, 'utf-8');
      this.logger.log(`Successfully generated and applied AI patch to ${filePath}`);
      return { applied: true };
    } catch (e) {
      this.logger.error(`Failed to parse AI patch generation: ${completion.text}`);
      return { applied: false, reason: 'AI returned invalid JSON for code generation.' };
    }
  }

  // ------------------------------------------------------------ Next.js

  /**
   * Injects or replaces a property on the exported `metadata` object.
   *
   * Supports dotted paths so nested fields work too: `openGraph.title` writes
   * `metadata.openGraph.title`, creating the intermediate object if needed.
   */
  async updateNextJsMetadata(filePath: string, propertyPath: string, newValue: string): Promise<boolean> {
    this.logger.log(`Patching Next.js metadata (${propertyPath}) in ${filePath}...`);

    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    const metadataDecl = sourceFile.getVariableDeclaration('metadata');
    if (!metadataDecl) {
      this.logger.warn(`No 'metadata' export found in ${filePath}. Cannot patch.`);
      return false;
    }

    let target: ObjectLiteralExpression | undefined = metadataDecl.getInitializerIfKind(
      SyntaxKind.ObjectLiteralExpression,
    );
    if (!target) {
      this.logger.warn(`'metadata' is not an object literal in ${filePath}. Cannot patch.`);
      return false;
    }

    const segments = propertyPath.split('.');
    const leaf = segments.pop() as string;

    // Walk (creating as needed) to the object that should hold the leaf.
    for (const segment of segments) {
      const parent: ObjectLiteralExpression = target;
      const existing = parent.getProperty(segment);
      let nested: ObjectLiteralExpression | undefined = existing
        ?.asKind(SyntaxKind.PropertyAssignment)
        ?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);

      if (!nested) {
        existing?.remove();
        const added = parent.addPropertyAssignment({ name: segment, initializer: '{}' });
        nested = added.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression) as ObjectLiteralExpression;
      }
      target = nested;
    }

    const leafHolder: ObjectLiteralExpression = target;
    leafHolder.getProperty(leaf)?.remove();
    leafHolder.addPropertyAssignment({ name: leaf, initializer: JSON.stringify(newValue) });

    await sourceFile.save();
    this.logger.log(`Wrote ${propertyPath} to ${filePath}.`);
    return true;
  }

  // --------------------------------------------------------------- HTML

  private async loadHtml(filePath: string) {
    const html = await fs.readFile(filePath, 'utf8');
    // decodeEntities: false keeps existing markup byte-stable so the PR diff
    // shows only the change we made, not a whole-file re-encoding.
    return { html, $: cheerio.load(html, { decodeEntities: false } as any) };
  }

  private async saveHtml(filePath: string, $: cheerio.CheerioAPI): Promise<void> {
    await fs.writeFile(filePath, $.html(), 'utf8');
  }

  /** Sets or replaces `<title>`, creating `<head>` if the document lacks one. */
  async setHtmlTitle(filePath: string, title: string): Promise<PatchOutcome> {
    const { $ } = await this.loadHtml(filePath);
    if ($('head').length === 0) $('html').prepend('<head></head>');

    if ($('title').length > 0) {
      $('title').first().text(title);
      $('title').slice(1).remove();
    } else {
      $('head').append(`<title>${escapeText(title)}</title>`);
    }

    await this.saveHtml(filePath, $);
    return { applied: true };
  }

  /** Sets or replaces a `<meta name="...">` tag. */
  async setMetaTag(filePath: string, name: string, content: string): Promise<PatchOutcome> {
    const { $ } = await this.loadHtml(filePath);
    if ($('head').length === 0) $('html').prepend('<head></head>');

    const existing = $(`head meta[name="${name}"]`);
    if (existing.length > 0) {
      existing.first().attr('content', content);
      existing.slice(1).remove();
    } else {
      $('head').append(`<meta name="${escapeAttr(name)}" content="${escapeAttr(content)}" />`);
    }

    await this.saveHtml(filePath, $);
    return { applied: true };
  }

  /** Sets or replaces `<link rel="canonical">`. */
  async setCanonical(filePath: string, href: string): Promise<PatchOutcome> {
    const { $ } = await this.loadHtml(filePath);
    if ($('head').length === 0) $('html').prepend('<head></head>');

    const existing = $('head link[rel="canonical"]');
    if (existing.length > 0) {
      existing.first().attr('href', href);
      existing.slice(1).remove();
    } else {
      $('head').append(`<link rel="canonical" href="${escapeAttr(href)}" />`);
    }

    await this.saveHtml(filePath, $);
    return { applied: true };
  }

  /**
   * Adds alt text to images that lack it.
   *
   * An image that already has alt text is never touched — overwriting a human's
   * description with a generated one is a regression, not a fix. Pass `src` to
   * target one image; omit it to fill every empty alt with the same text.
   */
  async setImageAlt(filePath: string, altText: string, src?: string): Promise<PatchOutcome> {
    const { $ } = await this.loadHtml(filePath);

    const selector = src ? `img[src="${src}"]` : 'img';
    const candidates = $(selector).filter((_, el) => {
      const alt = $(el).attr('alt');
      return alt === undefined || alt.trim() === '';
    });

    if (candidates.length === 0) {
      return { applied: false, reason: src ? `No image with src "${src}" is missing alt text.` : 'No images are missing alt text.' };
    }

    candidates.attr('alt', altText);
    await this.saveHtml(filePath, $);
    return { applied: true };
  }

  /**
   * Injects a JSON-LD block, replacing any existing block of the same `@type`.
   *
   * Malformed JSON is rejected outright — a broken `<script type="application/ld+json">`
   * is worse for the customer than the missing schema we were asked to add.
   */
  async injectJsonLd(filePath: string, jsonLd: string | object): Promise<PatchOutcome> {
    let parsed: any;
    try {
      parsed = typeof jsonLd === 'string' ? JSON.parse(jsonLd) : jsonLd;
    } catch {
      return { applied: false, reason: 'Refused to inject malformed JSON-LD.' };
    }
    if (!parsed || typeof parsed !== 'object' || !parsed['@type']) {
      return { applied: false, reason: 'JSON-LD is missing an @type and would not validate.' };
    }

    const { $ } = await this.loadHtml(filePath);
    if ($('head').length === 0) $('html').prepend('<head></head>');

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const existing = JSON.parse($(el).contents().text());
        if (existing?.['@type'] === parsed['@type']) $(el).remove();
      } catch {
        // Leave unparseable blocks alone; they are not ours to clean up.
      }
    });

    $('head').append(
      `<script type="application/ld+json">\n${JSON.stringify(parsed, null, 2)}\n</script>`,
    );

    await this.saveHtml(filePath, $);
    return { applied: true };
  }

  /**
   * Adds a plain `<a>` link to an orphan page from a source page (usually the
   * homepage) that crawlers already reach. Prefers the `<footer>` if there is
   * one, so the link reads as site-wide navigation rather than stray markup.
   *
   * A page that already links to `href` is left alone rather than duplicated.
   */
  async insertInternalLink(filePath: string, anchorText: string, href?: string): Promise<PatchOutcome> {
    if (!href) {
      return { applied: false, reason: 'Missing the URL to link to.' };
    }

    const { $ } = await this.loadHtml(filePath);
    if ($('body').length === 0) $('html').append('<body></body>');

    if ($(`a[href="${href}"]`).length > 0) {
      return { applied: true };
    }

    const anchor = `<a href="${escapeAttr(href)}">${escapeText(anchorText)}</a>`;
    const footer = $('footer').first();
    if (footer.length > 0) {
      footer.append(anchor);
    } else {
      $('body').append(anchor);
    }

    await this.saveHtml(filePath, $);
    return { applied: true };
  }

  // ------------------------------------------------------------ Next.js JSON-LD

  /** The page component function a Next.js JSON-LD patch is injected into. */
  private findNextJsPageComponent(sourceFile: import('ts-morph').SourceFile) {
    const defaultFn = sourceFile.getFunctions().find((f) => f.isDefaultExport());
    if (defaultFn) return defaultFn;

    // `const Page = () => {...}; export default Page;`
    const exportAssignment = sourceFile.getExportAssignments()[0];
    const expr = exportAssignment?.getExpression();
    if (expr && Node.isIdentifier(expr)) {
      const varDecl = sourceFile.getVariableDeclaration(expr.getText());
      const init = varDecl?.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) return init;
    }
    if (expr && (Node.isArrowFunction(expr) || Node.isFunctionExpression(expr))) return expr;

    return undefined;
  }

  /**
   * The JSX root of a component body's last `return`, if it has one. The
   * last return is used rather than the first because an early return in a
   * component is usually a loading/error state, not the real page markup.
   */
  private getComponentJsxRoot(body: import('ts-morph').Block) {
    const returnStatement = [...body.getStatements()].reverse().find((s): s is ReturnStatement => Node.isReturnStatement(s));
    const expr = returnStatement?.getExpression();
    const jsxRoot = expr && Node.isParenthesizedExpression(expr) ? expr.getExpression() : expr;
    if (jsxRoot && (Node.isJsxFragment(jsxRoot) || Node.isJsxElement(jsxRoot) || Node.isJsxSelfClosingElement(jsxRoot))) {
      return jsxRoot;
    }
    return undefined;
  }

  /** Inserts `snippet` as the first child of a JSX root, wrapping in a Fragment if it is a single element. */
  private prependJsxChild(jsxRoot: NonNullable<ReturnType<PatchGenerationService['getComponentJsxRoot']>>, snippet: string): void {
    if (Node.isJsxFragment(jsxRoot)) {
      const originalText = jsxRoot.getText();
      const insertPos = originalText.indexOf('>') + 1;
      jsxRoot.replaceWithText(`${originalText.slice(0, insertPos)}\n  ${snippet}${originalText.slice(insertPos)}`);
    } else {
      jsxRoot.replaceWithText(`<>\n  ${snippet}\n  ${jsxRoot.getText()}\n</>`);
    }
  }

  /**
   * Adds a plain `<a>` link to a Next.js page component's JSX, from a source
   * page (usually the homepage) that crawlers already reach — the fix for an
   * orphan page. A page that already links to `href` is left alone.
   */
  async injectNextJsInternalLink(filePath: string, anchorText: string, href?: string): Promise<PatchOutcome> {
    if (!href) {
      return { applied: false, reason: 'Missing the URL to link to.' };
    }

    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    const component = this.findNextJsPageComponent(sourceFile);
    const body = component?.getBody();
    if (!component || !body || !Node.isBlock(body)) {
      return { applied: false, reason: 'No page component with a JSX return was found to patch.' };
    }

    const jsxRoot = this.getComponentJsxRoot(body);
    if (!jsxRoot) {
      return { applied: false, reason: 'Page component return has no JSX to patch.' };
    }

    if (jsxRoot.getText().includes(`href="${href}"`)) {
      return { applied: true };
    }

    this.prependJsxChild(jsxRoot, `<a href="${href}">${escapeText(anchorText)}</a>`);

    await sourceFile.save();
    return { applied: true };
  }

  /**
   * Injects a JSON-LD `<script>` into a Next.js page component's returned
   * JSX, since there is no `metadata` export equivalent for structured data.
   *
   * Re-running with the same `@type` updates the existing `const jsonLd*`
   * declaration in place instead of duplicating the script tag.
   */
  async injectNextJsJsonLd(filePath: string, jsonLd: string | object): Promise<PatchOutcome> {
    let parsed: any;
    try {
      parsed = typeof jsonLd === 'string' ? JSON.parse(jsonLd) : jsonLd;
    } catch {
      return { applied: false, reason: 'Refused to inject malformed JSON-LD.' };
    }
    if (!parsed || typeof parsed !== 'object' || !parsed['@type']) {
      return { applied: false, reason: 'JSON-LD is missing an @type and would not validate.' };
    }

    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    const component = this.findNextJsPageComponent(sourceFile);
    const body = component?.getBody();
    if (!component || !body || !Node.isBlock(body)) {
      return { applied: false, reason: 'No page component with a JSX return was found to patch.' };
    }

    const statements = body.getStatements();
    const returnIndexFromEnd = [...statements].reverse().findIndex((s) => Node.isReturnStatement(s));
    if (returnIndexFromEnd === -1) {
      return { applied: false, reason: 'Page component has no JSX return to patch.' };
    }
    const returnStatementIndex = statements.length - 1 - returnIndexFromEnd;

    const jsxRoot = this.getComponentJsxRoot(body);
    if (!jsxRoot) {
      return { applied: false, reason: 'Page component return has no JSX to patch.' };
    }

    const varName = jsonLdVarName(String(parsed['@type']));
    const jsonLiteral = JSON.stringify(parsed, null, 2);
    const alreadyInjected = jsxRoot.getText().includes(varName) && jsxRoot.getText().includes('application/ld+json');

    // Insert/update the const declaration first — this can invalidate ts-morph's
    // wrapper for sibling nodes in the block (including the JSX we just found),
    // so the JSX is re-located fresh afterward rather than reusing `jsxRoot`.
    const existingDecl = body.getVariableDeclaration(varName);
    if (existingDecl) {
      existingDecl.setInitializer(jsonLiteral);
    } else {
      body.insertStatements(returnStatementIndex, `const ${varName} = ${jsonLiteral};`);
    }

    if (!alreadyInjected) {
      const freshJsxRoot = this.getComponentJsxRoot(body);
      if (!freshJsxRoot) {
        return { applied: false, reason: 'Page component return has no JSX to patch.' };
      }
      this.prependJsxChild(freshJsxRoot, `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(${varName}) }} />`);
    }

    await sourceFile.save();
    return { applied: true };
  }

  /**
   * Applies a patch by fix type, dispatching to the right file strategy.
   * This is what the orchestrator calls.
   */
  async applyFix(
    filePath: string,
    fixType: string,
    value: string,
    options: { target?: PatchTarget; imageSrc?: string; href?: string } = {},
  ): Promise<PatchOutcome> {
    const target = options.target ?? this.detectTarget(filePath);

    if (target === 'nextjs-metadata') {
      if (JSON_LD_FIX_TYPES.has(fixType)) {
        return this.injectNextJsJsonLd(filePath, value);
      }
      if (fixType === 'INTERNAL_LINKING') {
        return this.injectNextJsInternalLink(filePath, value, options.href);
      }
      const property = NEXT_METADATA_PROPERTY[fixType];
      if (!property) {
        return { applied: false, reason: `${fixType} cannot be expressed as Next.js metadata.` };
      }
      const applied = await this.updateNextJsMetadata(filePath, property, value);
      return { applied, reason: applied ? undefined : 'No metadata export to patch.' };
    }

    switch (fixType) {
      case 'META_TITLE':
        return this.setHtmlTitle(filePath, value);
      case 'META_DESCRIPTION':
        return this.setMetaTag(filePath, 'description', value);
      case 'CANONICAL_URL':
        return this.setCanonical(filePath, value);
      case 'ALT_TEXT':
        return this.setImageAlt(filePath, value, options.imageSrc);
      case 'FAQ_SCHEMA':
      case 'PRODUCT_SCHEMA':
      case 'ORGANIZATION_SCHEMA':
      case 'BREADCRUMB_SCHEMA':
        return this.injectJsonLd(filePath, value);
      case 'INTERNAL_LINKING':
        return this.insertInternalLink(filePath, value, options.href);
      default:
        return { applied: false, reason: `${fixType} has no automated HTML patcher.` };
    }
  }
}

/** Fix types that map onto the Next.js metadata object. */
const NEXT_METADATA_PROPERTY: Readonly<Record<string, string>> = {
  META_TITLE: 'title',
  META_DESCRIPTION: 'description',
  CANONICAL_URL: 'alternates.canonical',
};

/** Fix types that inject a JSON-LD `<script>` rather than editing metadata/HTML tags. */
const JSON_LD_FIX_TYPES = new Set(['FAQ_SCHEMA', 'PRODUCT_SCHEMA', 'ORGANIZATION_SCHEMA', 'BREADCRUMB_SCHEMA']);

/** "Product" -> "jsonLdProduct", "FAQPage" -> "jsonLdFAQPage" */
function jsonLdVarName(schemaType: string): string {
  const clean = schemaType.replace(/[^A-Za-z0-9]/g, '') || 'Schema';
  return `jsonLd${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

function escapeText(value: string): string {
  return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
