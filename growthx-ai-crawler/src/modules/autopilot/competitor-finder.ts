import * as cheerio from 'cheerio';

/**
 * Finding a business's competitors from its own website.
 *
 * The earlier voice command asked a model to name competitors from the bare
 * domain, which is a guess: "brandkettle.co.in" says nothing about what the
 * business sells or where. Here the model is given what the site itself
 * says, and every domain it names is fetched before it is offered, so a
 * made-up or dead website is never put in front of the customer.
 */

export interface SiteSummary {
  title: string | null;
  description: string | null;
  headings: string[];
  links: string[];
  text: string;
}

export interface CompetitorSuggestion {
  domain: string;
  name: string;
  reason: string;
}

/** Marketplaces, directories and social sites: where competitors list, not competitors. */
const PLATFORM_NAMES = new Set(
  (
    'amazon flipkart facebook instagram youtube wikipedia justdial indiamart google linkedin twitter pinterest meesho ' +
    'myntra sulekha tradeindia quora reddit yelp tripadvisor zomato swiggy blinkit bigbasket jiomart'
  ).split(' '),
);
const PLATFORM_DOMAINS = new Set(['x.com', 't.co', 'wa.me']);

/** Matched on the site's own name, so "teabox.com" is never mistaken for "x.com". */
export function isPlatform(domain: string): boolean {
  if (PLATFORM_DOMAINS.has(domain)) return true;
  return domain.split('.').some((label) => PLATFORM_NAMES.has(label));
}

export function summariseHomepage(html: string): SiteSummary {
  const $ = cheerio.load(html || '');
  const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
  const headings = $('h1, h2')
    .map((_, el) => clean($(el).text()))
    .get()
    .filter((t) => t.length > 2 && t.length < 120)
    .slice(0, 12);
  const links = $('nav a, header a')
    .map((_, el) => clean($(el).text()))
    .get()
    .filter((t) => t.length > 2 && t.length < 40)
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, 20);
  $('script, style, noscript, svg').remove();
  return {
    title: clean($('title').first().text()) || null,
    description: clean($('meta[name="description"]').attr('content')) || null,
    headings,
    links,
    text: clean($('body').text()).slice(0, 700),
  };
}

export function normaliseCandidate(raw: string): string | null {
  const host = (raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#\s]/)[0];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  return host;
}

/** The model's candidates, cleaned: real-looking domains, not the customer, not a marketplace, no repeats. */
export function filterCandidates(raw: unknown, ownDomain: string): CompetitorSuggestion[] {
  const own = normaliseCandidate(ownDomain);
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.competitors) ? (raw as any).competitors : [];
  const seen = new Set<string>();
  const out: CompetitorSuggestion[] = [];
  for (const item of list) {
    const domain = normaliseCandidate(String(item?.domain ?? item?.website ?? ''));
    if (!domain || domain === own || seen.has(domain)) continue;
    if (isPlatform(domain)) continue;
    seen.add(domain);
    out.push({
      domain,
      name: String(item?.name ?? '').trim() || domain,
      reason: String(item?.reason ?? '').trim(),
    });
  }
  return out;
}

export function buildFinderPrompt(domain: string, site: SiteSummary | null, pageTitles: string[]): string {
  const about = site
    ? [
        `Title: ${site.title ?? 'none'}`,
        `Description: ${site.description ?? 'none'}`,
        `Headings: ${site.headings.join(' | ') || 'none'}`,
        `Menu: ${site.links.join(' | ') || 'none'}`,
        `Text: ${site.text || 'none'}`,
      ].join('\n')
    : 'The homepage could not be read.';
  return `A business owns the website ${domain}. This is what their homepage says:
${about}
${pageTitles.length ? `\nOther pages on their site: ${pageTitles.slice(0, 25).join(' | ')}` : ''}

Work out what they sell and where (country, and city if it is a local business). Then name up to 8 real,
direct competitors: other businesses selling the same thing to the same customers, with their own website.
Prefer competitors in the same country. Do not list marketplaces, directories or social media sites.
Only give websites you are confident exist.

Reply with JSON only:
{ "business": "one line on what they sell and where", "competitors": [ { "domain": "example.in", "name": "Example", "reason": "why they compete, in one short plain sentence" } ] }`;
}
