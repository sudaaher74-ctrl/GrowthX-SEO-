/**
 * Works out whether an AI assistant's answer actually recommended the customer,
 * and where they ranked against tracked competitors.
 *
 * This is deliberately a pure function with no I/O: it is the part of AI
 * visibility that has to be right, so it is the part that is exhaustively
 * testable without a network or a database.
 */
/**
 * A rival to measure against. `names` matters: real answers say "Summit Grove",
 * not "summitgrove.com", and a name with a space cannot be derived from the
 * domain — without it that mention is silently missed.
 */
export interface CompetitorRef {
    domain: string;
    names?: string[];
}
export interface DetectCitationInput {
    /** The assistant's raw answer text. */
    answer: string;
    /** Domains the customer owns, e.g. ["northwindoutdoors.com"]. */
    ownDomains: string[];
    /** Extra brand spellings, e.g. ["Northwind Outdoors"]. */
    ownBrandNames?: string[];
    /** Tracked rivals. Plain strings are accepted as domain-only shorthand. */
    competitors: (CompetitorRef | string)[];
}
export interface CitationDetection {
    /** True when the customer was named or linked anywhere in the answer. */
    cited: boolean;
    /** 1 = first brand mentioned. Null when not cited. */
    position: number | null;
    /** The first URL on a customer domain, when the assistant gave one. */
    citedUrl: string | null;
    /** Tracked competitor domains that appeared in the same answer. */
    competitorsCited: string[];
}
/** Strips protocol, `www.`, path, and case from a domain-ish string. */
export declare function normalizeDomain(raw: string): string;
export declare function detectCitation(input: DetectCitationInput): CitationDetection;
