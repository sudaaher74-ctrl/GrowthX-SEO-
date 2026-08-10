"use strict";
/**
 * Works out whether an AI assistant's answer actually recommended the customer,
 * and where they ranked against tracked competitors.
 *
 * This is deliberately a pure function with no I/O: it is the part of AI
 * visibility that has to be right, so it is the part that is exhaustively
 * testable without a network or a database.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDomain = normalizeDomain;
exports.detectCitation = detectCitation;
/** Escapes a literal for use inside a RegExp. */
function escape(literal) {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Strips protocol, `www.`, path, and case from a domain-ish string. */
function normalizeDomain(raw) {
    return raw
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .split(':')[0];
}
/**
 * Matches a domain, allowing subdomains but not a longer domain that merely
 * ends with it — `shop.acme.com` counts for `acme.com`, `notacme.com` does not.
 */
function domainPattern(domain) {
    return new RegExp(`(?<![a-z0-9])${escape(domain)}(?![a-z0-9])`, 'i');
}
/** Matches a brand word without matching it inside a longer word. */
function namePattern(name) {
    return new RegExp(`(?<![a-z0-9])${escape(name.trim())}(?![a-z0-9])`, 'i');
}
/** "northwindoutdoors.com" -> "northwindoutdoors", so a bare brand mention counts. */
function labelOf(domain) {
    return domain.split('.')[0];
}
/** Earliest index at which any pattern matches, or -1. */
function firstMentionIndex(answer, patterns) {
    let earliest = -1;
    for (const pattern of patterns) {
        const match = pattern.exec(answer);
        if (match && (earliest === -1 || match.index < earliest)) {
            earliest = match.index;
        }
    }
    return earliest;
}
const URL_PATTERN = /https?:\/\/[^\s)<>\]"'`]+/gi;
/** First URL in the answer whose host is one of `domains`. */
function findCitedUrl(answer, domains) {
    const matches = answer.match(URL_PATTERN);
    if (!matches)
        return null;
    for (const raw of matches) {
        // Trailing punctuation is common when a URL ends a sentence.
        const url = raw.replace(/[.,;:]+$/, '');
        let host;
        try {
            host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
        }
        catch {
            continue;
        }
        if (domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
            return url;
        }
    }
    return null;
}
function detectCitation(input) {
    const answer = input.answer ?? '';
    const ownDomains = [...new Set(input.ownDomains.map(normalizeDomain).filter(Boolean))];
    const seen = new Set();
    const competitors = [];
    for (const entry of input.competitors) {
        const ref = typeof entry === 'string' ? { domain: entry } : entry;
        const domain = normalizeDomain(ref.domain);
        // A domain the customer owns is never counted as a competitor.
        if (!domain || seen.has(domain) || ownDomains.includes(domain))
            continue;
        seen.add(domain);
        competitors.push({ domain, names: ref.names });
    }
    const empty = { cited: false, position: null, citedUrl: null, competitorsCited: [] };
    if (!answer.trim() || ownDomains.length === 0)
        return empty;
    const ownPatterns = [
        ...ownDomains.map(domainPattern),
        ...ownDomains.map((domain) => namePattern(labelOf(domain))),
        ...(input.ownBrandNames ?? []).filter((name) => name?.trim()).map(namePattern),
    ];
    const ownIndex = firstMentionIndex(answer, ownPatterns);
    // Rank every brand that appears, by where it first appears.
    const ranked = [];
    if (ownIndex >= 0)
        ranked.push({ key: '__own__', index: ownIndex });
    const competitorsCited = [];
    for (const { domain, names } of competitors) {
        const patterns = [
            domainPattern(domain),
            namePattern(labelOf(domain)),
            ...(names ?? []).filter((name) => name?.trim()).map(namePattern),
        ];
        const index = firstMentionIndex(answer, patterns);
        if (index >= 0) {
            competitorsCited.push(domain);
            ranked.push({ key: domain, index });
        }
    }
    if (ownIndex < 0) {
        return { cited: false, position: null, citedUrl: null, competitorsCited };
    }
    ranked.sort((a, b) => a.index - b.index);
    const position = ranked.findIndex((entry) => entry.key === '__own__') + 1;
    return {
        cited: true,
        position,
        citedUrl: findCitedUrl(answer, ownDomains),
        competitorsCited,
    };
}
//# sourceMappingURL=citation-detector.js.map