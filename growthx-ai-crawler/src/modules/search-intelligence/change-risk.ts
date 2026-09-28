import { Evidence } from './diagnosis-rules';
import { keywordTerms } from './serp-analysis';

export type ChangeKind = 'DELETE' | 'REDIRECT' | 'CANONICAL' | 'URL_CHANGE' | 'NOINDEX';

export const CHANGE_LABEL: Record<ChangeKind, string> = {
  DELETE: 'Delete the page',
  REDIRECT: 'Redirect it to another page',
  CANONICAL: 'Point its canonical tag at another page',
  URL_CHANGE: 'Move it to a new address',
  NOINDEX: 'Hide it from Google (noindex)',
};

export interface Risk {
  code: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  evidence: Evidence[];
}

export interface TargetFacts {
  url: string;
  onSite: boolean;
  /** From our crawl; null when the target was not crawled. */
  statusCode: number | null;
  indexability: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  title: string | null;
}

export interface RiskInput {
  change: ChangeKind;
  url: string;
  title: string | null;
  searchConsole: {
    connected: boolean;
    clicks: number;
    impressions: number;
    queries: Array<{ query: string; clicks: number; impressions: number; position: number | null }>;
  };
  analytics: { sessions: number; conversions: number } | null;
  inlinks: string[];
  inSitemap: boolean;
  /** Pages that declare this page as their canonical (main) version. */
  canonicalFrom: string[];
  /** Tracked keywords where Google ranks this page, from the latest checks. */
  rankings: Array<{ keyword: string; position: number }>;
  indexed: boolean | null;
  target: TargetFacts | null;
}

export interface RiskAssessment {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  risks: Risk[];
  beforeYouDoIt: string[];
  notMeasured: string[];
}

const SRC = { gsc: 'Google Search Console (last 90 days)', ga: 'Google Analytics (last 90 days)', crawl: 'Your site crawl', ranks: 'Rank tracking', inspect: 'Google URL Inspection' };

function norm(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return null;
  }
}

/** Topic overlap between two titles, 0 to 1. */
export function titleOverlap(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const x = new Set(keywordTerms(a));
  const y = new Set(keywordTerms(b));
  if (x.size === 0 || y.size === 0) return null;
  let shared = 0;
  for (const t of x) if (y.has(t)) shared++;
  return shared / new Set([...x, ...y]).size;
}

export function assessRisk(input: RiskInput): RiskAssessment {
  const risks: Risk[] = [];
  const steps: string[] = [];
  const { change, searchConsole: gsc } = input;
  // Every change here takes this address out of Google's results; they
  // differ in where, if anywhere, its visitors and rankings go instead.
  const needsTarget = change === 'REDIRECT' || change === 'CANONICAL' || change === 'URL_CHANGE';

  const topQueries = gsc.queries.slice(0, 5).map((q) => ({
    label: q.query,
    value: `${q.clicks} clicks, ${q.impressions.toLocaleString()} impressions${q.position ? `, position ${q.position}` : ''}`,
    source: SRC.gsc,
  }));

  // ── Search traffic that depends on this address ─────────────────────────
  if (gsc.connected && gsc.clicks > 0) {
    const lose = change === 'DELETE' || change === 'NOINDEX';
    risks.push({
      code: 'SEARCH_TRAFFIC',
      severity: gsc.clicks >= 30 || lose ? 'HIGH' : 'MEDIUM',
      title: lose
        ? `You would lose about ${Math.round(gsc.clicks / 3)} clicks a month from Google`
        : `About ${Math.round(gsc.clicks / 3)} clicks a month from Google depend on this address`,
      detail: lose
        ? 'Google sends visitors to this page for the searches below. Once it is gone or hidden, those searches stop reaching you.'
        : 'Google should pass these searches to the new page, but only if it covers the same topic. Expect a dip of a few weeks while Google catches up.',
      evidence: [{ label: 'Last 90 days', value: `${gsc.clicks} clicks, ${gsc.impressions.toLocaleString()} impressions`, source: SRC.gsc }, ...topQueries],
    });
  } else if (gsc.connected && gsc.impressions > 0) {
    risks.push({
      code: 'SEARCH_VISIBILITY',
      severity: 'LOW',
      title: 'Google shows this page, though it rarely gets clicked',
      detail: 'The searches below would stop showing it.',
      evidence: [{ label: 'Last 90 days', value: `${gsc.impressions.toLocaleString()} impressions, ${gsc.clicks} clicks`, source: SRC.gsc }, ...topQueries],
    });
  }

  if (input.rankings.length > 0) {
    risks.push({
      code: 'RANKINGS',
      severity: input.rankings.some((r) => r.position <= 10) ? 'HIGH' : 'MEDIUM',
      title: `Ranks in Google for ${input.rankings.length} of your tracked keyword(s)`,
      detail: 'These positions belong to this address today.',
      evidence: input.rankings.slice(0, 5).map((r) => ({ label: r.keyword, value: `position ${r.position}`, source: SRC.ranks })),
    });
  }

  if (input.analytics && input.analytics.sessions > 0) {
    risks.push({
      code: 'VISITS',
      severity: input.analytics.conversions > 0 ? 'HIGH' : 'MEDIUM',
      title: `${input.analytics.sessions.toLocaleString()} visits started on this page`,
      detail: input.analytics.conversions > 0 ? 'Some of those visits turned into sales or leads.' : 'Across all channels, not only Google.',
      evidence: [{ label: 'Last 90 days', value: `${input.analytics.sessions} sessions, ${input.analytics.conversions} conversions`, source: SRC.ga }],
    });
  }

  // ── Your own site's references to it ────────────────────────────────────
  if (input.inlinks.length > 0) {
    const dead = change === 'DELETE';
    risks.push({
      code: 'INTERNAL_LINKS',
      severity: dead ? 'HIGH' : 'LOW',
      title: `${input.inlinks.length} of your pages link here`,
      detail: dead
        ? 'Those links would lead visitors and Google to a missing page.'
        : 'They would go through a redirect or to a page Google ignores. Update them to point straight at the page you want found.',
      evidence: input.inlinks.slice(0, 8).map((u) => ({ label: 'Links from', value: u, source: SRC.crawl })),
    });
    steps.push(`Update the ${input.inlinks.length} internal link(s) to point at ${needsTarget && input.target ? input.target.url : 'a page that stays'}.`);
  }
  if (input.inSitemap) {
    risks.push({
      code: 'SITEMAP',
      severity: 'LOW',
      title: 'It is listed in your sitemap',
      detail: 'A sitemap should only list pages you want in Google. Leaving it there sends Google mixed signals.',
      evidence: [{ label: 'Sitemap', value: 'Listed', source: SRC.crawl }],
    });
    steps.push(needsTarget && input.target ? `Replace it with ${input.target.url} in your sitemap.` : 'Remove it from your sitemap.');
  }
  if (input.canonicalFrom.length > 0) {
    risks.push({
      code: 'CANONICAL_REFERENCES',
      severity: 'HIGH',
      title: `${input.canonicalFrom.length} page(s) name this page as their main version`,
      detail: 'Their canonical tags point here. If this page goes, they point at nothing and Google has to guess which version to show.',
      evidence: input.canonicalFrom.slice(0, 8).map((u) => ({ label: 'Canonical tag on', value: u, source: SRC.crawl })),
    });
    steps.push('Change the canonical tags on those pages first.');
  }

  // ── The page it would point to ──────────────────────────────────────────
  if (needsTarget) {
    const t = input.target;
    if (!t) {
      risks.push({ code: 'NO_TARGET', severity: 'HIGH', title: 'No destination page given', detail: 'Say which page this should point to.', evidence: [] });
    } else {
      if (norm(t.url) === norm(input.url)) {
        risks.push({ code: 'POINTS_TO_ITSELF', severity: 'HIGH', title: 'The destination is the same page', detail: 'A page redirecting to itself loops forever.', evidence: [{ label: 'Destination', value: t.url, source: SRC.crawl }] });
      }
      if (t.statusCode !== null && t.statusCode !== 200) {
        risks.push({
          code: 'TARGET_NOT_OK',
          severity: 'HIGH',
          title: `The destination answers HTTP ${t.statusCode}`,
          detail: t.statusCode >= 300 && t.statusCode < 400 ? 'It redirects again, which makes a chain Google may not follow to the end.' : 'Visitors and Google would land on a broken page.',
          evidence: [{ label: 'Destination', value: `${t.url}: HTTP ${t.statusCode}`, source: SRC.crawl }],
        });
      }
      if (t.noindex || t.indexability === 'NOT_INDEXABLE') {
        risks.push({
          code: 'TARGET_NOT_INDEXABLE',
          severity: 'HIGH',
          title: 'The destination is hidden from Google',
          detail: 'Pointing a page that ranks at one Google will not show throws the rankings away.',
          evidence: [{ label: 'Destination', value: `${t.url}: ${t.noindex ? 'noindex' : 'not indexable'}`, source: SRC.crawl }],
        });
      }
      if (t.canonicalUrl && norm(t.canonicalUrl) !== norm(t.url)) {
        const loops = norm(t.canonicalUrl) === norm(input.url);
        risks.push({
          code: loops ? 'CANONICAL_LOOP' : 'TARGET_CANONICAL_ELSEWHERE',
          severity: loops ? 'HIGH' : 'MEDIUM',
          title: loops ? 'The destination points back at this page' : 'The destination itself points Google at a third page',
          detail: loops ? 'Each names the other as the main version, so Google trusts neither.' : 'Google may follow that on to a page you did not intend.',
          evidence: [{ label: 'Destination canonical tag', value: t.canonicalUrl, source: SRC.crawl }],
        });
      }
      if (t.statusCode === null) {
        risks.push({
          code: 'TARGET_UNKNOWN',
          severity: 'LOW',
          title: 'The destination was not in your last crawl',
          detail: t.onSite ? 'Check it loads and is the page you mean before pointing anything at it.' : 'It is on another website; rankings rarely pass cleanly across sites.',
          evidence: [{ label: 'Destination', value: t.url, source: SRC.crawl }],
        });
      }
      const overlap = titleOverlap(input.title, t.title);
      if (overlap !== null && overlap < 0.2 && (gsc.clicks > 0 || input.rankings.length > 0)) {
        risks.push({
          code: 'TOPIC_MISMATCH',
          severity: 'MEDIUM',
          title: 'The destination is about something else',
          detail: 'Google passes rankings through a redirect only to a page on the same topic. To an unrelated page it is treated like a deletion.',
          evidence: [
            { label: 'This page', value: input.title ?? '(no title)', source: SRC.crawl },
            { label: 'Destination', value: t.title ?? '(no title)', source: SRC.crawl },
          ],
        });
      }
    }
    if (change === 'REDIRECT' || change === 'URL_CHANGE') steps.push('Use a permanent (301) redirect, not a temporary (302) one.');
    if (change === 'URL_CHANGE') steps.push('Redirect the old address to the new one, then update your canonical tags to the new address.');
  }

  if (change === 'DELETE' && (gsc.clicks > 0 || input.inlinks.length > 0)) {
    steps.push('Redirect the address to the closest related page instead of leaving a "not found", so its visitors and rankings are not simply lost.');
  }
  if (input.indexed === false && risks.every((r) => r.severity === 'LOW')) {
    risks.push({ code: 'NOT_INDEXED', severity: 'LOW', title: 'Google has not indexed this page anyway', detail: 'There is little search value to lose.', evidence: [{ label: 'Index status', value: 'Not indexed', source: SRC.inspect }] });
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  risks.sort((a, b) => order[a.severity] - order[b.severity]);
  const level = risks.some((r) => r.severity === 'HIGH') ? 'HIGH' : risks.some((r) => r.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW';

  const notMeasured = ['Links from other websites (see Search Console, Links report, before removing a page)'];
  if (!gsc.connected) notMeasured.unshift('Search traffic: Search Console is not connected');
  if (!input.analytics) notMeasured.push('Visits from all channels: Google Analytics is not connected');

  const summary =
    level === 'HIGH'
      ? 'High risk: this page carries search traffic, rankings or references that the change would break. Deal with the items below first.'
      : level === 'MEDIUM'
        ? 'Some risk: the change is workable if you handle the items below.'
        : 'Low risk: nothing measured depends much on this page.';

  return { level, summary, risks, beforeYouDoIt: [...new Set(steps)], notMeasured };
}
