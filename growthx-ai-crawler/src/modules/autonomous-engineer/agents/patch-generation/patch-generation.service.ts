import { Injectable, Logger } from '@nestjs/common';
import { Project, SyntaxKind, ObjectLiteralExpression } from 'ts-morph';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

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

  /** Extension-based dispatch, so callers do not have to know the file shape. */
  detectTarget(filePath: string): PatchTarget {
    return /\.(html?|htm)$/i.test(path.extname(filePath)) ? 'html' : 'nextjs-metadata';
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
   * Applies a patch by fix type, dispatching to the right file strategy.
   * This is what the orchestrator calls.
   */
  async applyFix(
    filePath: string,
    fixType: string,
    value: string,
    options: { target?: PatchTarget; imageSrc?: string } = {},
  ): Promise<PatchOutcome> {
    const target = options.target ?? this.detectTarget(filePath);

    if (target === 'nextjs-metadata') {
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

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

function escapeText(value: string): string {
  return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
