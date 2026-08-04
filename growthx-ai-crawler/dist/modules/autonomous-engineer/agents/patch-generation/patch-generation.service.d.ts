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
export declare class PatchGenerationService {
    private readonly logger;
    /** Extension-based dispatch, so callers do not have to know the file shape. */
    detectTarget(filePath: string): PatchTarget;
    /**
     * Injects or replaces a property on the exported `metadata` object.
     *
     * Supports dotted paths so nested fields work too: `openGraph.title` writes
     * `metadata.openGraph.title`, creating the intermediate object if needed.
     */
    updateNextJsMetadata(filePath: string, propertyPath: string, newValue: string): Promise<boolean>;
    private loadHtml;
    private saveHtml;
    /** Sets or replaces `<title>`, creating `<head>` if the document lacks one. */
    setHtmlTitle(filePath: string, title: string): Promise<PatchOutcome>;
    /** Sets or replaces a `<meta name="...">` tag. */
    setMetaTag(filePath: string, name: string, content: string): Promise<PatchOutcome>;
    /** Sets or replaces `<link rel="canonical">`. */
    setCanonical(filePath: string, href: string): Promise<PatchOutcome>;
    /**
     * Adds alt text to images that lack it.
     *
     * An image that already has alt text is never touched — overwriting a human's
     * description with a generated one is a regression, not a fix. Pass `src` to
     * target one image; omit it to fill every empty alt with the same text.
     */
    setImageAlt(filePath: string, altText: string, src?: string): Promise<PatchOutcome>;
    /**
     * Injects a JSON-LD block, replacing any existing block of the same `@type`.
     *
     * Malformed JSON is rejected outright — a broken `<script type="application/ld+json">`
     * is worse for the customer than the missing schema we were asked to add.
     */
    injectJsonLd(filePath: string, jsonLd: string | object): Promise<PatchOutcome>;
    /**
     * Applies a patch by fix type, dispatching to the right file strategy.
     * This is what the orchestrator calls.
     */
    applyFix(filePath: string, fixType: string, value: string, options?: {
        target?: PatchTarget;
        imageSrc?: string;
    }): Promise<PatchOutcome>;
}
