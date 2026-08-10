/**
 * Builds the prompt and JSON schema for each kind of SEO fix, and provides a
 * heuristic fallback derived from the page's own content.
 *
 * The rule this file exists to enforce: a proposed fix must be built from the
 * customer's page, never from a template mentioning our product. A patch that
 * says "GrowthX AI" on someone else's site is worse than no patch at all.
 */
export type FixType = 'META_TITLE' | 'META_DESCRIPTION' | 'ALT_TEXT' | 'CANONICAL_URL' | 'FAQ_SCHEMA' | 'PRODUCT_SCHEMA' | 'ORGANIZATION_SCHEMA' | 'BREADCRUMB_SCHEMA' | 'HEADING_STRUCTURE' | 'INTERNAL_LINKING';
/** Everything we know about the page being fixed. */
export interface PageContext {
    url: string;
    title?: string | null;
    metaDescription?: string | null;
    canonicalUrl?: string | null;
    h1?: string[];
    h2?: string[];
    wordCount?: number;
    domain?: string;
}
export interface FixPlan {
    fixType: FixType;
    /** Which value on the page this replaces, for the diff view. */
    originalValue: string | null;
    prompt: string;
    schema: Record<string, unknown>;
    /** Used when no model is available or the model output is unusable. */
    heuristic: () => {
        proposedValue: string;
        codeSnippet: string;
    };
}
/** "/guides/insulated-jackets" -> "Insulated Jackets" */
export declare function humanizeSlug(url: string): string;
export declare function hostOf(url: string): string;
/** Maps a crawler issue type to the fix we should propose for it. */
export declare function planFix(issueType: string, page: PageContext, recommendation?: string): FixPlan;
/** Strips query and fragment and forces https — the canonical form. */
export declare function canonicalize(url: string): string;
export declare function jsonLdScript(jsonLd: unknown): string;
export declare function escapeHtml(value: string): string;
/** Turns a model's structured response into the patch fields. */
export declare function renderFromModel(plan: FixPlan, parsed: Record<string, any>, page: PageContext): {
    proposedValue: string;
    codeSnippet: string;
} | null;
