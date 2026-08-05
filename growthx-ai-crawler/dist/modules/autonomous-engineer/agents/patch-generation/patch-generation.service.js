"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PatchGenerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchGenerationService = void 0;
const common_1 = require("@nestjs/common");
const ts_morph_1 = require("ts-morph");
const cheerio = require("cheerio");
const fs = require("fs/promises");
const path = require("path");
const multi_ai_router_service_1 = require("../../../ai-search/multi-ai-router/multi-ai-router.service");
/**
 * Applies an approved SEO fix to a file in the customer's repository.
 *
 * Two file shapes are supported: a Next.js `metadata` export (App Router) and
 * plain HTML. The right one is chosen from the file extension unless the caller
 * forces it.
 */
let PatchGenerationService = PatchGenerationService_1 = class PatchGenerationService {
    constructor(aiRouter) {
        this.aiRouter = aiRouter;
        this.logger = new common_1.Logger(PatchGenerationService_1.name);
    }
    /** Extension-based dispatch, so callers do not have to know the file shape. */
    detectTarget(filePath) {
        return /\.(html?|htm)$/i.test(path.extname(filePath)) ? 'html' : 'nextjs-metadata';
    }
    // ------------------------------------------------------------ AI Generation
    /**
     * Generates a code patch using AI based on the issue analysis strategy.
     * Replaces the entire file content with the AI's updated version.
     */
    async generatePatch(filePath, issueAnalysis, organizationId) {
        this.logger.log(`Generating AI patch for ${filePath}...`);
        let fileContent;
        try {
            fileContent = await fs.readFile(filePath, 'utf-8');
        }
        catch (e) {
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
            task: multi_ai_router_service_1.AiTask.CODE_GEN,
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
        }
        catch (e) {
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
    async updateNextJsMetadata(filePath, propertyPath, newValue) {
        this.logger.log(`Patching Next.js metadata (${propertyPath}) in ${filePath}...`);
        const project = new ts_morph_1.Project();
        const sourceFile = project.addSourceFileAtPath(filePath);
        const metadataDecl = sourceFile.getVariableDeclaration('metadata');
        if (!metadataDecl) {
            this.logger.warn(`No 'metadata' export found in ${filePath}. Cannot patch.`);
            return false;
        }
        let target = metadataDecl.getInitializerIfKind(ts_morph_1.SyntaxKind.ObjectLiteralExpression);
        if (!target) {
            this.logger.warn(`'metadata' is not an object literal in ${filePath}. Cannot patch.`);
            return false;
        }
        const segments = propertyPath.split('.');
        const leaf = segments.pop();
        // Walk (creating as needed) to the object that should hold the leaf.
        for (const segment of segments) {
            const parent = target;
            const existing = parent.getProperty(segment);
            let nested = existing
                ?.asKind(ts_morph_1.SyntaxKind.PropertyAssignment)
                ?.getInitializerIfKind(ts_morph_1.SyntaxKind.ObjectLiteralExpression);
            if (!nested) {
                existing?.remove();
                const added = parent.addPropertyAssignment({ name: segment, initializer: '{}' });
                nested = added.getInitializerIfKind(ts_morph_1.SyntaxKind.ObjectLiteralExpression);
            }
            target = nested;
        }
        const leafHolder = target;
        leafHolder.getProperty(leaf)?.remove();
        leafHolder.addPropertyAssignment({ name: leaf, initializer: JSON.stringify(newValue) });
        await sourceFile.save();
        this.logger.log(`Wrote ${propertyPath} to ${filePath}.`);
        return true;
    }
    // --------------------------------------------------------------- HTML
    async loadHtml(filePath) {
        const html = await fs.readFile(filePath, 'utf8');
        // decodeEntities: false keeps existing markup byte-stable so the PR diff
        // shows only the change we made, not a whole-file re-encoding.
        return { html, $: cheerio.load(html, { decodeEntities: false }) };
    }
    async saveHtml(filePath, $) {
        await fs.writeFile(filePath, $.html(), 'utf8');
    }
    /** Sets or replaces `<title>`, creating `<head>` if the document lacks one. */
    async setHtmlTitle(filePath, title) {
        const { $ } = await this.loadHtml(filePath);
        if ($('head').length === 0)
            $('html').prepend('<head></head>');
        if ($('title').length > 0) {
            $('title').first().text(title);
            $('title').slice(1).remove();
        }
        else {
            $('head').append(`<title>${escapeText(title)}</title>`);
        }
        await this.saveHtml(filePath, $);
        return { applied: true };
    }
    /** Sets or replaces a `<meta name="...">` tag. */
    async setMetaTag(filePath, name, content) {
        const { $ } = await this.loadHtml(filePath);
        if ($('head').length === 0)
            $('html').prepend('<head></head>');
        const existing = $(`head meta[name="${name}"]`);
        if (existing.length > 0) {
            existing.first().attr('content', content);
            existing.slice(1).remove();
        }
        else {
            $('head').append(`<meta name="${escapeAttr(name)}" content="${escapeAttr(content)}" />`);
        }
        await this.saveHtml(filePath, $);
        return { applied: true };
    }
    /** Sets or replaces `<link rel="canonical">`. */
    async setCanonical(filePath, href) {
        const { $ } = await this.loadHtml(filePath);
        if ($('head').length === 0)
            $('html').prepend('<head></head>');
        const existing = $('head link[rel="canonical"]');
        if (existing.length > 0) {
            existing.first().attr('href', href);
            existing.slice(1).remove();
        }
        else {
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
    async setImageAlt(filePath, altText, src) {
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
    async injectJsonLd(filePath, jsonLd) {
        let parsed;
        try {
            parsed = typeof jsonLd === 'string' ? JSON.parse(jsonLd) : jsonLd;
        }
        catch {
            return { applied: false, reason: 'Refused to inject malformed JSON-LD.' };
        }
        if (!parsed || typeof parsed !== 'object' || !parsed['@type']) {
            return { applied: false, reason: 'JSON-LD is missing an @type and would not validate.' };
        }
        const { $ } = await this.loadHtml(filePath);
        if ($('head').length === 0)
            $('html').prepend('<head></head>');
        $('script[type="application/ld+json"]').each((_, el) => {
            try {
                const existing = JSON.parse($(el).contents().text());
                if (existing?.['@type'] === parsed['@type'])
                    $(el).remove();
            }
            catch {
                // Leave unparseable blocks alone; they are not ours to clean up.
            }
        });
        $('head').append(`<script type="application/ld+json">\n${JSON.stringify(parsed, null, 2)}\n</script>`);
        await this.saveHtml(filePath, $);
        return { applied: true };
    }
    /**
     * Applies a patch by fix type, dispatching to the right file strategy.
     * This is what the orchestrator calls.
     */
    async applyFix(filePath, fixType, value, options = {}) {
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
};
exports.PatchGenerationService = PatchGenerationService;
exports.PatchGenerationService = PatchGenerationService = PatchGenerationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [multi_ai_router_service_1.MultiAiRouterService])
], PatchGenerationService);
/** Fix types that map onto the Next.js metadata object. */
const NEXT_METADATA_PROPERTY = {
    META_TITLE: 'title',
    META_DESCRIPTION: 'description',
    CANONICAL_URL: 'alternates.canonical',
};
function escapeAttr(value) {
    return value.replace(/"/g, '&quot;');
}
function escapeText(value) {
    return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
//# sourceMappingURL=patch-generation.service.js.map