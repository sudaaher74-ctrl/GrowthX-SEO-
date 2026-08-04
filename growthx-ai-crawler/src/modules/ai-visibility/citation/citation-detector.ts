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

/** Escapes a literal for use inside a RegExp. */
function escape(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strips protocol, `www.`, path, and case from a domain-ish string. */
export function normalizeDomain(raw: string): string {
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
function domainPattern(domain: string): RegExp {
  return new RegExp(`(?<![a-z0-9])${escape(domain)}(?![a-z0-9])`, 'i');
}

/** Matches a brand word without matching it inside a longer word. */
function namePattern(name: string): RegExp {
  return new RegExp(`(?<![a-z0-9])${escape(name.trim())}(?![a-z0-9])`, 'i');
}

/** "northwindoutdoors.com" -> "northwindoutdoors", so a bare brand mention counts. */
function labelOf(domain: string): string {
  return domain.split('.')[0];
}

/** Earliest index at which any pattern matches, or -1. */
function firstMentionIndex(answer: string, patterns: RegExp[]): number {
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
function findCitedUrl(answer: string, domains: string[]): string | null {
  const matches = answer.match(URL_PATTERN);
  if (!matches) return null;

  for (const raw of matches) {
    // Trailing punctuation is common when a URL ends a sentence.
    const url = raw.replace(/[.,;:]+$/, '');
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      continue;
    }
    if (domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return url;
    }
  }
  return null;
}

export function detectCitation(input: DetectCitationInput): CitationDetection {
  const answer = input.answer ?? '';
  const ownDomains = [...new Set(input.ownDomains.map(normalizeDomain).filter(Boolean))];

  const seen = new Set<string>();
  const competitors: CompetitorRef[] = [];
  for (const entry of input.competitors) {
    const ref: CompetitorRef = typeof entry === 'string' ? { domain: entry } : entry;
    const domain = normalizeDomain(ref.domain);
    // A domain the customer owns is never counted as a competitor.
    if (!domain || seen.has(domain) || ownDomains.includes(domain)) continue;
    seen.add(domain);
    competitors.push({ domain, names: ref.names });
  }

  const empty: CitationDetection = { cited: false, position: null, citedUrl: null, competitorsCited: [] };
  if (!answer.trim() || ownDomains.length === 0) return empty;

  const ownPatterns = [
    ...ownDomains.map(domainPattern),
    ...ownDomains.map((domain) => namePattern(labelOf(domain))),
    ...(input.ownBrandNames ?? []).filter((name) => name?.trim()).map(namePattern),
  ];

  const ownIndex = firstMentionIndex(answer, ownPatterns);

  // Rank every brand that appears, by where it first appears.
  const ranked: { key: string; index: number }[] = [];
  if (ownIndex >= 0) ranked.push({ key: '__own__', index: ownIndex });

  const competitorsCited: string[] = [];
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
