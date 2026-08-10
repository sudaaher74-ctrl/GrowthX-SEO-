"use strict";
/**
 * Builds the prompt and JSON schema for each kind of SEO fix, and provides a
 * heuristic fallback derived from the page's own content.
 *
 * The rule this file exists to enforce: a proposed fix must be built from the
 * customer's page, never from a template mentioning our product. A patch that
 * says "GrowthX AI" on someone else's site is worse than no patch at all.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.humanizeSlug = humanizeSlug;
exports.hostOf = hostOf;
exports.planFix = planFix;
exports.canonicalize = canonicalize;
exports.jsonLdScript = jsonLdScript;
exports.escapeHtml = escapeHtml;
exports.renderFromModel = renderFromModel;
const TEXT_SCHEMA = (field, guidance) => ({
    type: 'object',
    properties: { [field]: { type: 'string', description: guidance } },
    required: [field],
    additionalProperties: false,
});
const JSONLD_SCHEMA = {
    type: 'object',
    properties: { jsonLd: { type: 'string', description: 'A complete JSON-LD object as a JSON string.' } },
    required: ['jsonLd'],
    additionalProperties: false,
};
/** "/guides/insulated-jackets" -> "Insulated Jackets" */
function humanizeSlug(url) {
    try {
        const path = new URL(url).pathname;
        const slug = path.split('/').filter(Boolean).pop();
        if (!slug)
            return 'Home';
        return slug
            .replace(/\.[a-z]+$/i, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    catch {
        return 'Home';
    }
}
function hostOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    }
    catch {
        return '';
    }
}
/** A compact description of the page for the model to work from. */
function describe(page) {
    const lines = [`URL: ${page.url}`];
    if (page.title)
        lines.push(`Current title: ${page.title}`);
    if (page.metaDescription)
        lines.push(`Current meta description: ${page.metaDescription}`);
    if (page.h1?.length)
        lines.push(`H1: ${page.h1.join(' | ')}`);
    if (page.h2?.length)
        lines.push(`H2s: ${page.h2.slice(0, 8).join(' | ')}`);
    if (page.wordCount)
        lines.push(`Word count: ${page.wordCount}`);
    return lines.join('\n');
}
const GROUNDING = 'Base everything strictly on the page described below. Do not invent products, ' +
    'prices, company names, or claims that are not evidenced by the page. If a detail ' +
    'is unknown, write around it rather than guessing.';
/** Maps a crawler issue type to the fix we should propose for it. */
function planFix(issueType, page, recommendation) {
    const brandSuffix = hostOf(page.url);
    const subject = page.h1?.[0] || humanizeSlug(page.url);
    switch (issueType) {
        case 'MISSING_TITLE':
        case 'SHORT_TITLE':
        case 'LONG_TITLE':
            return {
                fixType: 'META_TITLE',
                originalValue: page.title ?? null,
                prompt: `${GROUNDING}\n\n${describe(page)}\n\nWrite a title tag of 50-58 characters. Put the primary keyword first. End with the brand only if it fits.`,
                schema: TEXT_SCHEMA('title', 'The complete title tag text, 50-58 characters.'),
                heuristic: () => {
                    const value = `${subject} | ${brandSuffix}`.slice(0, 58);
                    return { proposedValue: value, codeSnippet: `<title>${escapeHtml(value)}</title>` };
                },
            };
        case 'MISSING_META_DESCRIPTION':
        case 'SHORT_META_DESCRIPTION':
        case 'LONG_META_DESCRIPTION':
            return {
                fixType: 'META_DESCRIPTION',
                originalValue: page.metaDescription ?? null,
                prompt: `${GROUNDING}\n\n${describe(page)}\n\nWrite a meta description of 130-155 characters that states what the page offers and gives a reason to click.`,
                schema: TEXT_SCHEMA('description', 'The meta description, 130-155 characters.'),
                heuristic: () => {
                    const value = `${subject} — everything you need to know, from ${brandSuffix}.`.slice(0, 155);
                    return {
                        proposedValue: value,
                        codeSnippet: `<meta name="description" content="${escapeHtml(value)}" />`,
                    };
                },
            };
        case 'MISSING_ALT_TEXT':
            return {
                fixType: 'ALT_TEXT',
                originalValue: null,
                prompt: `${GROUNDING}\n\n${describe(page)}\n\nWrite alt text of 5-12 words for the main image on this page. Describe what a sighted reader would see. Do not start with "image of" and do not keyword-stuff.`,
                schema: TEXT_SCHEMA('altText', 'Alt text, 5-12 words.'),
                heuristic: () => {
                    const value = subject;
                    return {
                        proposedValue: value,
                        codeSnippet: `<img src="..." alt="${escapeHtml(value)}" loading="lazy" />`,
                    };
                },
            };
        case 'MISSING_CANONICAL':
        case 'BROKEN_CANONICAL': {
            // Deterministic by nature — a canonical URL is derived, never written.
            const canonical = canonicalize(page.url);
            return {
                fixType: 'CANONICAL_URL',
                originalValue: page.canonicalUrl ?? null,
                prompt: '',
                schema: {},
                heuristic: () => ({
                    proposedValue: canonical,
                    codeSnippet: `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
                }),
            };
        }
        case 'SCHEMA_ERROR_FAQ':
        case 'SCHEMA_ERROR_FAQPage':
        case 'MISSING_FAQ_SCHEMA':
            return {
                fixType: 'FAQ_SCHEMA',
                originalValue: null,
                prompt: `${GROUNDING}\n\n${describe(page)}\n\nProduce schema.org FAQPage JSON-LD using only questions this page actually answers, drawn from its headings. If the page has no question-style content, return an empty mainEntity array rather than inventing questions.`,
                schema: JSONLD_SCHEMA,
                heuristic: () => {
                    // Only headings phrased as questions are safe to use unattended.
                    const questions = (page.h2 ?? []).filter((h) => h.trim().endsWith('?')).slice(0, 5);
                    const jsonLd = {
                        '@context': 'https://schema.org',
                        '@type': 'FAQPage',
                        mainEntity: questions.map((q) => ({
                            '@type': 'Question',
                            name: q,
                            acceptedAnswer: { '@type': 'Answer', text: '' },
                        })),
                    };
                    return { proposedValue: 'FAQPage JSON-LD', codeSnippet: jsonLdScript(jsonLd) };
                },
            };
        case 'SCHEMA_ERROR_PRODUCT':
        case 'SCHEMA_ERROR_Product':
            return {
                fixType: 'PRODUCT_SCHEMA',
                originalValue: null,
                prompt: `${GROUNDING}\n\n${describe(page)}\n\nProduce schema.org Product JSON-LD. Include price and availability ONLY if the page states them; otherwise omit the offers block entirely. Never guess a price.`,
                schema: JSONLD_SCHEMA,
                heuristic: () => {
                    // No offers block: a wrong price is a legal problem, not an SEO one.
                    const jsonLd = {
                        '@context': 'https://schema.org/',
                        '@type': 'Product',
                        name: subject,
                        url: page.url,
                    };
                    return { proposedValue: 'Product JSON-LD', codeSnippet: jsonLdScript(jsonLd) };
                },
            };
        case 'MISSING_ORGANIZATION_SCHEMA':
            return {
                fixType: 'ORGANIZATION_SCHEMA',
                originalValue: null,
                prompt: `${GROUNDING}\n\n${describe(page)}\n\nProduce schema.org Organization JSON-LD for the site owner using only details evidenced by the page.`,
                schema: JSONLD_SCHEMA,
                heuristic: () => {
                    const jsonLd = {
                        '@context': 'https://schema.org',
                        '@type': 'Organization',
                        name: brandSuffix,
                        url: `https://${brandSuffix}`,
                    };
                    return { proposedValue: 'Organization JSON-LD', codeSnippet: jsonLdScript(jsonLd) };
                },
            };
        case 'MISSING_BREADCRUMB_SCHEMA': {
            const jsonLd = breadcrumbFor(page.url);
            return {
                fixType: 'BREADCRUMB_SCHEMA',
                originalValue: null,
                prompt: '',
                schema: {},
                heuristic: () => ({ proposedValue: 'BreadcrumbList JSON-LD', codeSnippet: jsonLdScript(jsonLd) }),
            };
        }
        case 'MISSING_H1':
        case 'MULTIPLE_H1':
            return {
                fixType: 'HEADING_STRUCTURE',
                originalValue: page.h1?.join(' | ') ?? null,
                prompt: `${GROUNDING}\n\n${describe(page)}\n\nWrite a single H1 for this page: one clear phrase describing what the page is about.`,
                schema: TEXT_SCHEMA('h1', 'The H1 text.'),
                heuristic: () => ({ proposedValue: subject, codeSnippet: `<h1>${escapeHtml(subject)}</h1>` }),
            };
        case 'ORPHAN_PAGE':
            return {
                fixType: 'INTERNAL_LINKING',
                originalValue: null,
                prompt: `${GROUNDING}\n\n${describe(page)}\n\nWrite anchor text of 2-6 words for an internal link pointing to this page from a related page.`,
                schema: TEXT_SCHEMA('anchorText', 'Anchor text, 2-6 words.'),
                heuristic: () => ({
                    proposedValue: subject,
                    codeSnippet: `<a href="${escapeHtml(page.url)}">${escapeHtml(subject)}</a>`,
                }),
            };
        default:
            return {
                fixType: 'META_TITLE',
                originalValue: page.title ?? null,
                prompt: `${GROUNDING}\n\n${describe(page)}\n\nThe crawler reported: ${recommendation ?? issueType}. Propose the single most valuable on-page change, as a short instruction.`,
                schema: TEXT_SCHEMA('change', 'A concrete change to make.'),
                heuristic: () => ({
                    proposedValue: recommendation ?? `Resolve ${issueType}`,
                    codeSnippet: `<!-- ${recommendation ?? issueType} -->`,
                }),
            };
    }
}
/** Strips query and fragment and forces https — the canonical form. */
function canonicalize(url) {
    try {
        const parsed = new URL(url);
        parsed.protocol = 'https:';
        parsed.search = '';
        parsed.hash = '';
        let out = parsed.toString();
        if (out.endsWith('/') && parsed.pathname !== '/')
            out = out.slice(0, -1);
        return out;
    }
    catch {
        return url.split('?')[0].split('#')[0].replace(/^http:\/\//, 'https://');
    }
}
function breadcrumbFor(url) {
    let segments = [];
    let origin = '';
    try {
        const parsed = new URL(url);
        origin = parsed.origin;
        segments = parsed.pathname.split('/').filter(Boolean);
    }
    catch {
        /* fall through to a home-only crumb */
    }
    const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: origin || url }];
    let path = '';
    segments.forEach((segment, index) => {
        path += `/${segment}`;
        items.push({
            '@type': 'ListItem',
            position: index + 2,
            name: segment.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            item: `${origin}${path}`,
        });
    });
    return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}
function jsonLdScript(jsonLd) {
    return `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
/** Turns a model's structured response into the patch fields. */
function renderFromModel(plan, parsed, page) {
    const firstString = Object.values(parsed).find((v) => typeof v === 'string' && v.trim());
    if (!firstString)
        return null;
    const value = String(firstString).trim();
    switch (plan.fixType) {
        case 'META_TITLE':
            return { proposedValue: value, codeSnippet: `<title>${escapeHtml(value)}</title>` };
        case 'META_DESCRIPTION':
            return {
                proposedValue: value,
                codeSnippet: `<meta name="description" content="${escapeHtml(value)}" />`,
            };
        case 'ALT_TEXT':
            return {
                proposedValue: value,
                codeSnippet: `<img src="..." alt="${escapeHtml(value)}" loading="lazy" />`,
            };
        case 'HEADING_STRUCTURE':
            return { proposedValue: value, codeSnippet: `<h1>${escapeHtml(value)}</h1>` };
        case 'INTERNAL_LINKING':
            return {
                proposedValue: value,
                codeSnippet: `<a href="${escapeHtml(page.url)}">${escapeHtml(value)}</a>`,
            };
        case 'FAQ_SCHEMA':
        case 'PRODUCT_SCHEMA':
        case 'ORGANIZATION_SCHEMA':
        case 'BREADCRUMB_SCHEMA': {
            // Reject anything that is not parseable JSON-LD rather than writing a
            // broken <script> block onto a customer's page.
            try {
                const jsonLd = JSON.parse(value);
                if (!jsonLd || typeof jsonLd !== 'object' || !('@type' in jsonLd))
                    return null;
                return { proposedValue: `${jsonLd['@type']} JSON-LD`, codeSnippet: jsonLdScript(jsonLd) };
            }
            catch {
                return null;
            }
        }
        default:
            return { proposedValue: value, codeSnippet: `<!-- ${escapeHtml(value)} -->` };
    }
}
//# sourceMappingURL=fix-generator.js.map