import { expectedCtr } from '../integrations/google/expected-ctr';
import {
  Confidence,
  Evidence,
  EvidenceSource,
  Finding,
  Movement,
  PageDiagnosis,
  PageFacts,
  Severity,
  SiteFacts,
  SiteTrends,
} from './intelligence.types';

/**
 * The rules that turn evidence into findings.
 *
 * Deterministic and free of I/O, so every conclusion can be traced and tested.
 * No AI writes a conclusion here: a model may later phrase one, but what is
 * concluded, and what it rests on, is decided below.
 *
 * Methodology, stated once:
 *  - A finding exists only when a named threshold is crossed by real data.
 *  - Its expected impact is a click estimate from a general CTR curve, labelled
 *    as an estimate. Where nothing honest can be estimated it is null.
 *  - Confidence counts INDEPENDENT sources behind a page's findings: one source
 *    is LOW, two MEDIUM, three or more HIGH. Agreement between sources, not
 *    the wording of a claim, is what raises it.
 *  - Priority is the estimated extra clicks, then the number of corroborating
 *    sources. There is no blended score; the reason is written out per page.
 *  - Data that is absent is reported as absent, never as zero.
 */
export const THRESHOLDS = {
  /** Impressions over the window below which a query or page is noise. */
  minImpressions: 100,
  /** Sessions over the window below which engagement figures are noise. */
  minSessions: 30,
  /** A page counts as low-CTR below this share of the expected CTR for its position. */
  ctrShortfallRatio: 0.6,
  /** Page-two band. */
  pageTwo: { min: 10.5, max: 20.5 },
  /** Engagement below this share of the site's own rate is flagged. */
  engagementRatio: 0.8,
  /** A page holding search visibility with fewer inbound internal links than this is weakly linked. */
  minInboundLinks: 3,
  /** A competitor must lead by at least this many positions to be called ahead. */
  competitorLead: 5,
  /** Period-over-period decline that counts as a risk. */
  declinePct: -20,
  /** Prior-period floor so a fall from 3 to 2 is not a risk. */
  minPriorVolume: 50,
  /** Percentage-point fall in AI citation rate that counts as a risk. */
  aiDeclinePoints: 15,
  /** Website clicks from the local profile needed before its landing page is judged. */
  minGbpWebsiteClicks: 30,
  /** Checks needed before an AI-visibility rate means anything. */
  minAiChecks: 5,
} as const;

const SEVERITY_ORDER: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
const pos = (n: number) => n.toFixed(1);

export function diagnosePage(page: PageFacts, site: SiteFacts): PageDiagnosis {
  const evidence: Evidence[] = [];
  const findings: Finding[] = [];
  const notMeasured: PageDiagnosis['notMeasured'] = [];
  let n = 0;
  const ev = (source: Evidence['source'], text: string, data?: Evidence['data']): string => {
    const id = `${page.path}#e${++n}`;
    evidence.push({ id, source, text, data });
    return id;
  };
  const add = (f: Omit<Finding, 'id' | 'url'>) => findings.push({ ...f, id: `${page.path}#f${findings.length + 1}`, url: page.url });

  // ── Evidence, source by source ───────────────────────────────────────────
  let searchEv: string | null = null;
  const s = page.search;
  if (s) {
    searchEv = ev(
      'GSC',
      `Google Search: ${s.impressions.toLocaleString('en-US')} impressions, ${s.clicks.toLocaleString('en-US')} clicks, CTR ${pct(s.ctr, 2)}, average position ${pos(s.position)}.`,
      { impressions: s.impressions, clicks: s.clicks, ctr: s.ctr, position: s.position },
    );
  } else {
    notMeasured.push({
      source: 'GSC',
      reason: site.sources.GSC.connected
        ? 'Search Console reported no impressions for this page in the window.'
        : (site.sources.GSC.note ?? 'Search Console is not connected.'),
    });
  }

  let trafficEv: string | null = null;
  const a = page.analytics;
  if (a) {
    trafficEv = ev(
      'GA4',
      `Analytics: ${a.sessions.toLocaleString('en-US')} sessions landed here (all channels), ` +
        `${a.engagementRate === null ? 'engagement rate not available' : `${pct(a.engagementRate)} engaged`}, ` +
        `${a.conversions === null ? 'key events not configured' : `${a.conversions} key events`}.`,
      { sessions: a.sessions, engagementRate: a.engagementRate, conversions: a.conversions },
    );
  } else {
    notMeasured.push({
      source: 'GA4',
      reason: site.sources.GA4.connected
        ? 'Analytics recorded no sessions starting on this page in the window.'
        : (site.sources.GA4.note ?? 'Analytics is not connected.'),
    });
  }

  const c = page.crawl;
  let crawlEv: string | null = null;
  if (c) {
    crawlEv = ev(
      'CRAWL',
      `Crawl: ${c.wordCount} words, ${c.h1Count} H1, ${c.inboundLinks} inbound internal links, ` +
        `${c.schemaTypes.length ? `schema ${c.schemaTypes.join(', ')}` : 'no structured data'}, ${c.indexability.toLowerCase().replace('_', ' ')}.`,
      {
        title: c.title,
        metaDescription: c.metaDescription,
        wordCount: c.wordCount,
        h1Count: c.h1Count,
        inboundLinks: c.inboundLinks,
        schemaTypes: c.schemaTypes.join(', '),
        indexability: c.indexability,
      },
    );
  } else {
    notMeasured.push({ source: 'CRAWL', reason: 'This URL is not in the latest completed crawl.' });
  }

  // ── Crawl problems: each stored audit issue keeps its own evidence ──────
  for (const issue of c?.issues ?? []) {
    if (issue.severity === 'LOW') continue;
    const id = ev('CRAWL', `${issue.description}${issue.evidence ? ` Evidence: ${issue.evidence}` : ''}`, { issueType: issue.type });
    add({
      type: issue.type,
      category: 'PROBLEM',
      severity: issue.severity,
      what: issue.description,
      why: 'Found by the crawler on this page; it affects how search engines or visitors read it.',
      evidenceIds: [id],
      action: issue.recommendation,
      expectedImpact: null,
      measurement: ['Re-crawl this page and confirm the issue no longer appears.'],
      potentialClicks: null,
      fixIssueId: issue.aiFixAvailable ? issue.id : null,
    });
  }

  // ── Search rules ─────────────────────────────────────────────────────────
  if (s && s.impressions >= THRESHOLDS.minImpressions) {
    const expected = expectedCtr(s.position);
    if (s.position <= THRESHOLDS.pageTwo.max && s.ctr < expected * THRESHOLDS.ctrShortfallRatio) {
      const potential = Math.max(0, Math.round(s.impressions * expected * THRESHOLDS.ctrShortfallRatio - s.clicks));
      add({
        type: 'LOW_CTR',
        category: 'OPPORTUNITY',
        severity: potential >= 50 ? 'HIGH' : 'MEDIUM',
        what: `The page is shown ${s.impressions.toLocaleString('en-US')} times but only ${pct(s.ctr, 2)} click, below what its position ${pos(s.position)} usually earns.`,
        why: 'It is being shown, so the search snippet (title and description) may not be compelling or relevant enough to the query.',
        evidenceIds: [searchEv!, ...(crawlEv ? [crawlEv] : [])],
        action: 'Rewrite the title and meta description around what people actually searched for.',
        expectedImpact: `About ${potential} more clicks over the same period if CTR reaches ${pct(expected * THRESHOLDS.ctrShortfallRatio, 1)} (estimate from a general CTR curve, not a forecast).`,
        measurement: ['Compare Search Console CTR for this page before and after.', 'Compare clicks at similar impressions.'],
        potentialClicks: potential,
      });
    }
    if (s.position >= THRESHOLDS.pageTwo.min && s.position <= THRESHOLDS.pageTwo.max) {
      const potential = Math.max(0, Math.round(s.impressions * expectedCtr(10) - s.clicks));
      add({
        type: 'PAGE_TWO_RANKING',
        category: 'OPPORTUNITY',
        severity: potential >= 50 ? 'HIGH' : 'MEDIUM',
        what: `Average position ${pos(s.position)} puts this page on the second page of results.`,
        why: 'Few people look past page one; small gains in relevance and internal support can move it across.',
        evidenceIds: [searchEv!, ...(crawlEv ? [crawlEv] : [])],
        action: 'Improve how completely the page covers the topic, link to it from related pages, and add supporting content.',
        expectedImpact: `About ${potential} more clicks over the same period if it reached position 10 (estimate).`,
        measurement: ['Compare average position and clicks for this page before and after.'],
        potentialClicks: potential,
      });
    }
  }

  // ── Analytics rules ──────────────────────────────────────────────────────
  if (a && a.sessions >= THRESHOLDS.minSessions) {
    if (a.engagementRate !== null && site.engagementRate !== null && a.engagementRate < site.engagementRate * THRESHOLDS.engagementRatio) {
      add({
        type: 'LOW_ENGAGEMENT',
        category: 'PROBLEM',
        severity: 'MEDIUM',
        what: `Only ${pct(a.engagementRate)} of visits that start here are engaged, against ${pct(site.engagementRate)} across the site.`,
        why: 'Visitors are arriving and leaving without engaging, which suggests the page does not match what they came for, or is hard to use.',
        evidenceIds: [trafficEv!, ...(searchEv ? [searchEv] : [])],
        action: 'Check that the page answers the searches that bring people to it, then review layout, load speed and the first screen.',
        expectedImpact: null,
        measurement: ['Compare this page’s engagement rate before and after.'],
        potentialClicks: null,
      });
    }
    if (a.conversions === 0) {
      add({
        type: 'TRAFFIC_NO_CONVERSION',
        category: 'OPPORTUNITY',
        severity: 'HIGH',
        what: `${a.sessions.toLocaleString('en-US')} visits started on this page and none produced a key event.`,
        why: 'The page attracts visitors but gives them no effective next step, or the key event is not reachable from here.',
        evidenceIds: [trafficEv!],
        action: 'Add a clear call to action and a direct path to the key event; confirm the event is tracked on this page.',
        expectedImpact: null,
        measurement: ['Compare key events per session for this page before and after.'],
        potentialClicks: null,
      });
    }
  }

  // ── Crawl-derived rule that needs the other sources to matter ────────────
  if (c && s && s.impressions >= THRESHOLDS.minImpressions && c.inboundLinks < THRESHOLDS.minInboundLinks) {
    add({
      type: 'WEAK_INTERNAL_LINKING',
      category: 'PROBLEM',
      severity: c.inboundLinks === 0 ? 'HIGH' : 'MEDIUM',
      what: `A page Google already shows has only ${c.inboundLinks} inbound internal link${c.inboundLinks === 1 ? '' : 's'}.`,
      why: 'Internal links tell search engines which pages matter; a page with search demand and few links gets little support.',
      evidenceIds: [crawlEv!, searchEv!],
      action: 'Link to this page from related pages and navigation using descriptive anchor text.',
      expectedImpact: null,
      measurement: ['Re-crawl to confirm inbound links, then track position.'],
      potentialClicks: null,
    });
  }
  if (c && c.indexability === 'NOT_INDEXABLE' && ((s && s.clicks > 0) || (a && a.sessions > 0))) {
    add({
      type: 'NON_INDEXABLE_WITH_TRAFFIC',
      category: 'RISK',
      severity: 'CRITICAL',
      what: 'This page receives traffic but the crawl found it is not indexable.',
      why: 'It can drop out of Google, taking its traffic with it.',
      evidenceIds: [crawlEv!, ...(searchEv ? [searchEv] : trafficEv ? [trafficEv] : [])],
      action: 'Check the noindex directive, canonical and robots rules on this page.',
      expectedImpact: null,
      measurement: ['Re-crawl and confirm the page is indexable.', 'Watch impressions for this page.'],
      potentialClicks: null,
    });
  }

  // ── Competitor rule ──────────────────────────────────────────────────────
  if (page.competitors === null) {
    notMeasured.push({ source: 'COMPETITORS', reason: site.sources.COMPETITORS.note ?? 'No competitor keyword data has been collected.' });
  } else if (s) {
    const ownQueries = new Set(s.queries.map((q) => q.query.toLowerCase()));
    const ahead = page.competitors
      .filter((r) => ownQueries.has(r.keyword.toLowerCase()))
      .map((r) => ({ r, own: s.queries.find((q) => q.query.toLowerCase() === r.keyword.toLowerCase())! }))
      .filter(({ r, own }) => own.position - r.competitorPosition >= THRESHOLDS.competitorLead)
      .slice(0, 5);
    if (ahead.length) {
      const ids = ahead.map(({ r, own }) =>
        ev('COMPETITORS', `For “${r.keyword}” ${r.competitor} ranks ${r.competitorPosition}${r.competitorUrl ? ` (${r.competitorUrl})` : ''}; this page ranks ${pos(own.position)}.`, {
          keyword: r.keyword,
          competitor: r.competitor,
          competitorPosition: r.competitorPosition,
          ownPosition: own.position,
        }),
      );
      add({
        type: 'COMPETITOR_RANKS_HIGHER',
        category: 'OPPORTUNITY',
        severity: 'HIGH',
        what: `${new Set(ahead.map((x) => x.r.competitor)).size} competitor(s) rank at least ${THRESHOLDS.competitorLead} places above this page for searches it already appears for.`,
        why: 'Their pages win these searches. The measurable differences (content coverage, internal links, snippet) are what to compare against.',
        evidenceIds: [...ids, ...(searchEv ? [searchEv] : [])],
        action: 'Open each competing page and compare topic coverage, headings, internal links and snippet against this page; close the gaps that are measurable.',
        expectedImpact: null,
        measurement: ['Track this page’s position for the listed searches.'],
        potentialClicks: null,
      });
    }
  }

  // ── AI visibility ────────────────────────────────────────────────────────
  if (page.ai === null) {
    notMeasured.push({ source: 'AI_VISIBILITY', reason: site.sources.AI_VISIBILITY.note ?? 'AI visibility has not been measured.' });
  } else if (page.ai.checks >= THRESHOLDS.minAiChecks) {
    const rate = page.ai.citedChecks / page.ai.checks;
    const id = ev(
      'AI_VISIBILITY',
      `AI assistants named the brand in ${page.ai.citedChecks} of ${page.ai.checks} checks (${pct(rate, 0)}); this page was the cited URL ${page.ai.citedThisPage} time(s).` +
        (page.ai.competitorsCited.length ? ` Competitors named: ${page.ai.competitorsCited.slice(0, 5).join(', ')}.` : ''),
      { checks: page.ai.checks, citedChecks: page.ai.citedChecks, citedThisPage: page.ai.citedThisPage },
    );
    if (rate < 0.25 && page.ai.competitorsCited.length > 0 && findings.length > 0) {
      // Supporting evidence, attached to what is already wrong rather than raised alone.
      for (const f of findings) if (f.category !== 'RISK') f.evidenceIds.push(id);
    }
  }

  return finish(page, findings, evidence, notMeasured);
}

function finish(page: PageFacts, findings: Finding[], evidence: Evidence[], notMeasured: PageDiagnosis['notMeasured']): PageDiagnosis {
  findings.sort(
    (x, y) =>
      SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity] || (y.potentialClicks ?? 0) - (x.potentialClicks ?? 0),
  );
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const sources = new Set<EvidenceSource>();
  for (const f of findings) for (const id of f.evidenceIds) sources.add(byId.get(id)!.source);
  const corroborating = [...sources];
  const confidence: Confidence = corroborating.length >= 3 ? 'HIGH' : corroborating.length === 2 ? 'MEDIUM' : 'LOW';
  const potentialClicks = findings.reduce((sum, f) => sum + (f.potentialClicks ?? 0), 0);

  const opps = findings.filter((f) => f.category === 'OPPORTUNITY');
  const probs = findings.filter((f) => f.category === 'PROBLEM');
  const conclusion = findings.length
    ? `${page.path}: ${[
        probs.length ? `${probs.length} problem${probs.length === 1 ? '' : 's'}` : null,
        opps.length ? `${opps.length} opportunit${opps.length === 1 ? 'y' : 'ies'}` : null,
        findings.some((f) => f.category === 'RISK') ? 'a risk' : null,
      ]
        .filter(Boolean)
        .join(' and ')} found, supported by ${corroborating.length} source${corroborating.length === 1 ? '' : 's'} (${corroborating.join(', ')}). ` +
      findings
        .slice(0, 3)
        .map((f) => f.what)
        .join(' ')
    : null;

  return {
    url: page.url,
    path: page.path,
    headline: findings.length ? findings[0].what : 'Nothing wrong that the connected data can show.',
    evidence,
    findings,
    conclusion,
    confidence,
    corroboratingSources: corroborating,
    priority: {
      potentialClicks,
      reason: potentialClicks
        ? `Ranked by estimated extra clicks (${potentialClicks}) from its findings, then by how many sources agree (${corroborating.length}).`
        : `No click estimate is possible; ranked by how many sources agree (${corroborating.length}) and severity.`,
    },
    notMeasured,
  };
}

export interface SiteLevel {
  findings: Finding[];
  evidence: Evidence[];
}

/**
 * Risks come from measurable change between two stored windows, never from
 * a single reading. A window with no earlier comparison raises nothing.
 */
export function siteRisks(trends: SiteTrends): SiteLevel {
  const out: SiteLevel = { findings: [], evidence: [] };
  const decline = (m: Movement | null, min: number = THRESHOLDS.minPriorVolume) =>
    m && m.previous !== null && m.changePct !== null && m.previous >= min && m.changePct <= THRESHOLDS.declinePct ? m : null;
  const push = (type: string, source: EvidenceSource, severe: boolean, what: string, why: string, action: string, data: Evidence['data']) => {
    const evidenceId = `site#${type}#e`;
    out.evidence.push({ id: evidenceId, source, text: what, data });
    out.findings.push({
      id: `site#${type}`,
      type,
      category: 'RISK',
      severity: severe ? 'CRITICAL' : 'HIGH',
      url: null,
      what,
      why,
      evidenceIds: [evidenceId],
      action,
      expectedImpact: null,
      measurement: ['Compare the same figure over the next equal period.'],
      potentialClicks: null,
    });
  };
  const fell = (m: Movement) => Math.abs(m.changePct!).toFixed(0);
  const data = (m: Movement) => ({ current: m.current, previous: m.previous, changePct: m.changePct });

  const clicks = decline(trends.searchClicks);
  if (clicks)
    push('ORGANIC_CLICKS_DECLINE', 'GSC', clicks.changePct! <= -40, `Google clicks fell ${fell(clicks)}% (${clicks.previous} → ${clicks.current}) against the previous period.`, 'Sustained loss of search traffic reduces leads and revenue.', 'Find which queries and pages lost clicks and check for ranking, indexing or snippet changes.', data(clicks));
  const conv = decline(trends.conversions, 10);
  if (conv)
    push('CONVERSION_DECLINE', 'GA4', conv.changePct! <= -40, `Key events fell ${fell(conv)}% (${conv.previous} → ${conv.current}).`, 'Fewer visitors are completing the actions that matter.', 'Check tracking is intact, then the pages and channels where key events dropped.', data(conv));
  const web = decline(trends.gbpWebsiteClicks, 20);
  if (web)
    push('GBP_WEBSITE_CLICKS_DECLINE', 'GBP', web.changePct! <= -40, `Website clicks from the Business Profile fell ${fell(web)}% (${web.previous} → ${web.current}).`, 'Local visitors reaching the website are falling.', 'Review the profile’s completeness, reviews and recent changes.', data(web));
  const calls = decline(trends.gbpCalls, 10);
  if (calls)
    push('GBP_CALLS_DECLINE', 'GBP', calls.changePct! <= -40, `Calls from the Business Profile fell ${fell(calls)}% (${calls.previous} → ${calls.current}).`, 'Fewer local customers are phoning.', 'Check the listed number and hours, and recent profile changes.', data(calls));
  const ai = trends.aiCitationRatePct;
  if (ai && ai.previous !== null && ai.previous - ai.current >= THRESHOLDS.aiDeclinePoints)
    push('AI_VISIBILITY_DECLINE', 'AI_VISIBILITY', false, `The brand’s AI citation rate fell from ${ai.previous.toFixed(0)}% to ${ai.current.toFixed(0)}%.`, 'AI assistants recommend the brand less often.', 'Review which questions stopped citing you and what those answers cite instead.', { current: ai.current, previous: ai.previous });
  return out;
}

/** Local profile visits landing on a weak page: the GBP + GA4 join. */
export function gbpLandingFinding(trends: SiteTrends, site: SiteFacts): SiteLevel {
  const out: SiteLevel = { findings: [], evidence: [] };
  const g = trends.gbpLanding;
  if (!g || g.websiteClicks < THRESHOLDS.minGbpWebsiteClicks) return out;
  const weakEngagement = g.engagementRate !== null && site.engagementRate !== null && g.engagementRate < site.engagementRate * THRESHOLDS.engagementRatio;
  const noConversion = g.conversions === 0;
  if (!weakEngagement && !noConversion) return out;
  out.evidence.push(
    { id: 'site#GBP_LANDING_WEAK#e1', source: 'GBP', text: `The Business Profile sent ${g.websiteClicks} website clicks in the window.`, data: { websiteClicks: g.websiteClicks } },
    {
      id: 'site#GBP_LANDING_WEAK#e2',
      source: 'GA4',
      text: `${g.path} (the profile’s website page): ${g.engagementRate === null ? 'engagement not available' : `${pct(g.engagementRate)} engaged`}, ${g.conversions === null ? 'key events not configured' : `${g.conversions} key events`}.`,
      data: { engagementRate: g.engagementRate, conversions: g.conversions },
    },
  );
  out.findings.push({
    id: 'site#GBP_LANDING_WEAK',
    type: 'GBP_LANDING_WEAK',
    category: 'OPPORTUNITY',
    severity: 'HIGH',
    url: g.path,
    what: `The Business Profile sent ${g.websiteClicks} website clicks, but ${g.path} ${noConversion ? 'recorded no key events' : 'has weak engagement'}.`,
    why: 'Local visitors who are ready to act reach the website and do not find a strong local path to convert.',
    evidenceIds: ['site#GBP_LANDING_WEAK#e1', 'site#GBP_LANDING_WEAK#e2'],
    action: 'Make the landing page state the local service area, delivery and contact options, and put the main call to action above the fold.',
    expectedImpact: null,
    measurement: ['Compare this page’s engagement and key events before and after.', 'Compare Business Profile website clicks.'],
    potentialClicks: null,
  });
  return out;
}
