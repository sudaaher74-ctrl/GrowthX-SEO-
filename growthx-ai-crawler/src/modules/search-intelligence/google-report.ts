/**
 * The Google improvement report's shape, and the pure parts of it: turning
 * measured figures into the prompt, and coercing the model's reply into the
 * report. Kept free of Nest and Prisma so both are unit-tested directly.
 */

export type Priority = 'high' | 'medium' | 'low';
export type Platform = 'GSC' | 'GA4' | 'BOTH';

export interface ReportSource {
  connected: boolean;
  hasData: boolean;
  lastSyncedAt: string | null;
  propertyName: string | null;
}

export interface KpiFact {
  label: string;
  source: 'GSC' | 'GA4';
  format: string;
  value: number | null;
  previous: number | null;
  /** Null when there is no earlier period to compare with. */
  change: string | null;
  note: string | null;
}

export interface RowFact {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  extra?: string;
}

export interface BusinessTrafficContext {
  businessName: string | null;
  industry: string | null;
  summary: string | null;
  businessModel: string | null;
  targetAudience: string | null;
  businessGoal: string | null;
  offerings: string[];
  targetCities: string[];
  primaryCity: string | null;
  state: string | null;
  country: string | null;
  seedKeywords: string[];
  pagesAudited: number;
  crawledAt: string | null;
  healthScore: number | null;
  auditedPages: Array<{ path: string; title: string }>;
}

export interface LocationTrafficGap {
  location: string;
  source: 'website_audit' | 'business_profile' | 'target_market';
  sessions: number;
  searchClicks: number;
  searchImpressions: number;
  status: 'NO_CLICKS' | 'LOW_TRAFFIC' | 'ACTIVE';
  finding: string;
  plan: string;
  recommendedSteps: string[];
  relevantOfferings: string[];
  matchingPages: string[];
}

export interface GoogleReportFacts {
  days: number;
  site: string | null;
  searchConsole: ReportSource;
  analytics: ReportSource;
  kpis: KpiFact[];
  topQueries: RowFact[];
  topPages: RowFact[];
  /** Ranking just off page one, seen often. */
  strikingDistance: RowFact[];
  /** Pages seen often and clicked rarely for where they rank. */
  ctrOpportunities: RowFact[];
  decliningQueries: Array<{ query: string; previousPosition: number; currentPosition: number; previousClicks: number; currentClicks: number }>;
  newQueries: string[];
  cannibalization: string[];
  index: null | {
    asked: number;
    indexed: number;
    notIndexed: number;
    indexableButNotIndexed: number;
    canonicalOverridden: number;
    topReasons: Array<{ state: string; count: number }>;
  };
  alerts: string[];
  traffic: null | {
    sessions: number;
    users: number;
    engagementRate: number;
    keyEvents: number | null;
    channels: Array<{ channel: string; sessions: number; share: number; engagementRate: number | null; keyEvents: number | null }>;
    landingPages: Array<{ page: string; sessions: number; engagementRate: number; keyEvents: number | null }>;
    /** The named sites, apps and campaigns behind the channels. Empty until the property is refreshed after sources were added. */
    sources: Array<{ source: string; medium: string; channel: string; sessions: number; share: number; engagementRate: number; keyEvents: number | null }>;
    countries: Array<{ country: string; sessions: number }>;
    cities: Array<{ city: string; country: string; sessions: number }>;
  };
  /** What the Website Audit understood about the user's business, offerings, and target service cities. */
  business?: BusinessTrafficContext | null;
  /** Comparison between cities/markets where the business operates and actual traffic/clicks received. */
  locationGaps?: LocationTrafficGap[];
  /** What could not be read, and why, so the report does not guess at it. */
  notMeasured: string[];
}

export interface PriorityItem {
  rank: number;
  title: string;
  platform: Platform;
  priority: Priority;
  effort: Priority;
  impact: Priority;
  evidence: string;
  whyItMatters: string;
  steps: string[];
  /** The figure to watch to know it worked. */
  measureBy: string;
}

export type ChannelVerdict = 'grow' | 'fix' | 'start' | 'maintain';

/** What to do with one traffic channel. */
export interface ChannelStrategy {
  channel: string;
  verdict: ChannelVerdict;
  /** Its share of sessions today, as measured, or "not measured". */
  share: string;
  whatWeSee: string;
  strategy: string;
  actions: string[];
}

export interface MarketingStrategy {
  summary: string;
  /** Plain findings on where the traffic comes from, with the numbers. */
  whereTrafficComesFrom: string[];
  channels: ChannelStrategy[];
  /** Who the visitors are and where, and what to do about it. */
  audience: string[];
}

export interface GoogleReportAnalysis {
  executiveSummary: string;
  whereWeAre: {
    searchConsole: { verdict: string; points: string[] };
    analytics: { verdict: string; points: string[] };
  };
  /** What to do first, in order. */
  priorities: PriorityItem[];
  quickWins: string[];
  /** Absent on reports written before the marketing strategy was added. */
  marketingStrategy?: MarketingStrategy;
  plan: Array<{ week: string; actions: string[] }>;
  dataGaps: string[];
}

export interface GoogleReport {
  generatedAt: string;
  facts: GoogleReportFacts;
  analysis: GoogleReportAnalysis | null;
  model: string | null;
  analysisError: string | null;
  snapshotId?: string | null;
  /** Number of action items forwarded into Fix Engine (Traffic tab). */
  forwardedToFixEngine?: number;
}

const LEVELS: Priority[] = ['high', 'medium', 'low'];
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const level = (v: unknown, fallback: Priority = 'medium'): Priority => {
  const p = str(v).toLowerCase();
  if (p === 'critical') return 'high';
  return (LEVELS as string[]).includes(p) ? (p as Priority) : fallback;
};
const platform = (v: unknown): Platform => {
  const p = str(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (p === 'GSC' || p === 'SEARCHCONSOLE') return 'GSC';
  if (p === 'GA4' || p === 'GA' || p === 'ANALYTICS' || p === 'GOOGLEANALYTICS') return 'GA4';
  return 'BOTH';
};
const verdict = (v: unknown): ChannelVerdict => {
  const x = str(v).toLowerCase();
  return x === 'grow' || x === 'fix' || x === 'start' || x === 'maintain' ? x : 'maintain';
};
const side = (v: any) => ({ verdict: str(v?.verdict), points: strList(v?.points) });

/**
 * Coerces whatever the model returned into the report's shape. A missing
 * field becomes empty rather than failing the whole report. Priorities are
 * put in the order to do them (high impact and low effort first) and numbered
 * again here, so the numbers the reader sees never depend on the model.
 */
export function normaliseAnalysis(raw: unknown): GoogleReportAnalysis {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const priorities = list(r.priorities)
    .map((p): PriorityItem => ({
      rank: 0,
      title: str(p?.title, 'Untitled action'),
      platform: platform(p?.platform),
      priority: level(p?.priority),
      effort: level(p?.effort),
      impact: level(p?.impact),
      evidence: str(p?.evidence),
      whyItMatters: str(p?.whyItMatters),
      steps: strList(p?.steps),
      measureBy: str(p?.measureBy),
    }))
    .filter((p) => p.title)
    .sort(
      (a, b) =>
        LEVELS.indexOf(a.priority) - LEVELS.indexOf(b.priority) ||
        LEVELS.indexOf(a.impact) - LEVELS.indexOf(b.impact) ||
        LEVELS.indexOf(b.effort) - LEVELS.indexOf(a.effort),
    )
    .map((p, i) => ({ ...p, rank: i + 1 }));

  return {
    executiveSummary: str(r.executiveSummary),
    whereWeAre: { searchConsole: side(r.whereWeAre?.searchConsole), analytics: side(r.whereWeAre?.analytics) },
    priorities,
    quickWins: strList(r.quickWins),
    marketingStrategy: {
      summary: str(r.marketingStrategy?.summary),
      whereTrafficComesFrom: strList(r.marketingStrategy?.whereTrafficComesFrom),
      channels: list(r.marketingStrategy?.channels)
        .map((c): ChannelStrategy => ({
          channel: str(c?.channel),
          verdict: verdict(c?.verdict),
          share: str(c?.share, 'not measured'),
          whatWeSee: str(c?.whatWeSee),
          strategy: str(c?.strategy),
          actions: strList(c?.actions),
        }))
        .filter((c) => c.channel),
      audience: strList(r.marketingStrategy?.audience),
    },
    plan: list(r.plan).map((w, i) => ({ week: str(w?.week, `Week ${i + 1}`), actions: strList(w?.actions) })),
    dataGaps: strList(r.dataGaps),
  };
}

const n = (v: number | null | undefined) => (v == null ? 'not measured' : Math.round(v).toLocaleString('en-US'));
const pct = (v: number | null | undefined, digits = 1) => (v == null ? 'not measured' : `${(v * 100).toFixed(digits)}%`);
const pos = (v: number) => v.toFixed(1);

function rows(items: RowFact[], empty: string): string {
  if (items.length === 0) return `  ${empty}`;
  return items
    .map(
      (r) =>
        `  - ${r.key}: ${n(r.clicks)} clicks, ${n(r.impressions)} impressions, CTR ${pct(r.ctr)}, position ${pos(r.position)}` +
        (r.extra ? ` (${r.extra})` : ''),
    )
    .join('\n');
}

export function buildPrompt(f: GoogleReportFacts): string {
  const src = (name: string, s: ReportSource) =>
    !s.connected ? `${name}: NOT CONNECTED` : !s.hasData ? `${name}: connected, no data stored yet` : `${name}: connected, last synced ${s.lastSyncedAt ?? 'unknown'}`;
  const kpis = f.kpis
    .map((k) => {
      const shown = k.value == null ? `not measured${k.note ? ` (${k.note})` : ''}` : k.format === 'percent' ? pct(k.value) : k.format === 'position' ? pos(k.value) : n(k.value);
      return `  - [${k.source}] ${k.label}: ${shown}${k.change ? `, ${k.change} vs the previous ${f.days} days` : k.value != null ? ', no earlier period to compare' : ''}`;
    })
    .join('\n');

  const t = f.traffic;
  const traffic = t
    ? `  sessions ${n(t.sessions)}, users ${n(t.users)}, engagement rate ${pct(t.engagementRate)}, key events ${t.keyEvents == null ? 'none set up' : n(t.keyEvents)}
  channels:
${t.channels.map((c) => `    - ${c.channel}: ${n(c.sessions)} sessions (${pct(c.share)}), engagement ${pct(c.engagementRate)}, key events ${n(c.keyEvents)}`).join('\n') || '    none'}
  top landing pages:
${t.landingPages.map((p) => `    - ${p.page}: ${n(p.sessions)} sessions, engagement ${pct(p.engagementRate)}, key events ${n(p.keyEvents)}`).join('\n') || '    none'}
  where visits came from, by source / medium (channel):
${t.sources.map((x) => `    - ${x.source} / ${x.medium} (${x.channel}): ${n(x.sessions)} sessions (${pct(x.share)}), engagement ${pct(x.engagementRate)}, key events ${n(x.keyEvents)}`).join('\n') || '    not available yet (the Analytics data needs a refresh to add sources)'}
  top countries: ${t.countries.map((c) => `${c.country} ${n(c.sessions)}`).join(', ') || 'none'}
  top cities: ${t.cities.map((c) => `${c.city}, ${c.country} ${n(c.sessions)}`).join('; ') || 'not available yet'}`
    : '  no Analytics data';

  const idx = f.index
    ? `  ${f.index.asked} pages checked with Google: ${f.index.indexed} indexed, ${f.index.notIndexed} not indexed; ${f.index.indexableButNotIndexed} allowed in search but not indexed; ${f.index.canonicalOverridden} where Google chose a different canonical. Reasons: ${f.index.topReasons.map((g) => `${g.state} (${g.count})`).join('; ') || 'none'}`
    : '  no index inspection has been run';

  const b = f.business;
  const businessSection = b
    ? `\nBUSINESS CONTEXT (from Website Audit)
  business name: ${b.businessName ?? f.site ?? 'unknown'}
  industry: ${b.industry ?? 'not classified'}
  summary: ${b.summary ?? 'not available'}
  core offerings: ${b.offerings.join(', ') || 'none detected'}
  target cities / service areas on website: ${b.targetCities.join(', ') || 'none specified'}
  pages audited: ${b.pagesAudited}${b.healthScore != null ? ` (health score ${b.healthScore}/100)` : ''}
  key website pages: ${b.auditedPages.slice(0, 8).map((p) => `${p.path} (${p.title})`).join('; ') || 'none'}\n`
    : '';

  const gaps = f.locationGaps ?? [];
  const locationSection = gaps.length > 0
    ? `\nTARGET BUSINESS LOCATIONS VS ACTUAL TRAFFIC
${gaps.map((g) => `  - ${g.location} [${g.status}]: ${g.sessions} sessions, ${g.searchClicks} search clicks, ${g.searchImpressions} impressions. ${g.finding}`).join('\n')}\n`
    : '';

  return `Write an improvement report for the website${f.site ? ` ${f.site}` : ''}, from its Google Search Console and Google Analytics 4 data for the last ${f.days} days.
${businessSection}${locationSection}
DATA SOURCES
  ${src('Search Console', f.searchConsole)}
  ${src('Google Analytics 4', f.analytics)}

HEADLINE FIGURES
${kpis || '  none'}

SEARCH CONSOLE
top queries:
${rows(f.topQueries, 'none')}
top pages:
${rows(f.topPages, 'none')}
queries ranking just off page one (positions 4-20, seen often):
${rows(f.strikingDistance, 'none')}
pages seen often but clicked rarely for where they rank:
${rows(f.ctrOpportunities, 'none')}
queries losing ground: ${f.decliningQueries.map((q) => `${q.query} (position ${pos(q.previousPosition)} to ${pos(q.currentPosition)}, clicks ${q.previousClicks} to ${q.currentClicks})`).join('; ') || 'none, or no earlier period stored'}
new queries: ${f.newQueries.join(', ') || 'none'}
queries answered by more than one page: ${f.cannibalization.join('; ') || 'none'}
indexing:
${idx}
alerts: ${f.alerts.join('; ') || 'none'}

GOOGLE ANALYTICS 4
${traffic}

NOT MEASURED
${f.notMeasured.map((m) => `  - ${m}`).join('\n') || '  nothing'}

Return JSON exactly in this shape:
{
  "executiveSummary": "4-6 sentences: where the site stands on Google today, what is working, what is holding it back, and the single most important thing to do first",
  "whereWeAre": {
    "searchConsole": { "verdict": "one sentence", "points": ["specific findings with numbers"] },
    "analytics": { "verdict": "one sentence", "points": ["specific findings with numbers"] }
  },
  "priorities": [
    {
      "title": "the action, in plain words",
      "platform": "GSC | GA4 | BOTH",
      "priority": "high|medium|low",
      "impact": "high|medium|low",
      "effort": "high|medium|low",
      "evidence": "the exact figures, queries and URLs from the data above",
      "whyItMatters": "what it changes for clicks, visits or leads, in plain words",
      "steps": ["step 1", "step 2", "step 3"],
      "measureBy": "which figure to watch and where, to know it worked"
    }
  ],
  "quickWins": ["things that take under an hour, with the exact page or query"],
  "marketingStrategy": {
    "summary": "3-5 sentences: where the visitors come from today, which source is carrying the site, which is missing, and the marketing approach that follows",
    "whereTrafficComesFrom": ["plain findings with numbers, e.g. share of sessions by channel, the named sources (sites, apps, campaigns) behind them, and how well each engages"],
    "channels": [
      {
        "channel": "Organic Search | Direct | Referral | Organic Social | Paid Search | Paid Social | Email | ... (only channels in the data, plus any important channel that has no traffic yet)",
        "verdict": "grow | fix | start | maintain",
        "share": "its share of sessions from the data, or 'not measured'",
        "whatWeSee": "what the data shows for it, with numbers and named sources",
        "strategy": "the marketing approach for this channel in 2-3 sentences",
        "actions": ["concrete action 1", "concrete action 2", "concrete action 3"]
      }
    ],
    "audience": ["where visitors are (countries, cities) and what to do about it, e.g. which locations to target"]
  },
  "plan": [ { "week": "Week 1", "actions": ["..."] } ],
  "dataGaps": ["what could not be measured and what would measure it"]
}

Rules:
- Order "priorities" as the order to do them: high impact and low effort first. Give 5 to 8. Every one names its platform and cites figures from the data above.
- If TARGET BUSINESS LOCATIONS VS ACTUAL TRAFFIC shows any city or region where the business operates with 0 clicks or low traffic, include a high-priority action to capture traffic and search clicks in that exact city/region for the business's core offerings.
- Cover both platforms. If a platform has no data, say so in whereWeAre and put connecting or fixing it first.
- Name the actual queries and page URLs to work on. Give 3 to 5 concrete steps each.
- marketingStrategy is a marketing plan built from where the traffic comes from. Use "grow" for a channel that works and deserves more, "fix" for one that brings visits that do not engage or convert, "start" for a channel with no traffic that suits this business, and "maintain" otherwise. Cover every channel that has traffic, and name the actual sources (for example a referring site or a social app) from the data. Do not recommend spending a budget figure; say where effort or spend should go, in what order.
- If sources are not available yet, work from the channels and say in dataGaps that refreshing Analytics adds the named sources.
- The plan is 4 weeks, highest impact first.
- Use only the data above. Never invent rankings, traffic, revenue, benchmarks or numbers. If something is "not measured", say it is not measured instead of guessing.
- Small numbers are small: with only a handful of clicks, say the sample is too small to trust and prefer actions that build visibility over actions that tune it.`;
}

/**
 * Ensures the report analysis always includes actionable priorities for target cities
 * where the business operates (from Website Audit) that have 0 clicks or low traffic,
 * and provides a complete business-aware fallback analysis when the AI model is unavailable.
 */
export function enrichAnalysisWithBusinessGaps(
  existing: GoogleReportAnalysis | null,
  facts: GoogleReportFacts,
): GoogleReportAnalysis {
  const business = facts.business;
  const gaps = (facts.locationGaps ?? []).filter((g) => g.status === 'NO_CLICKS' || g.status === 'LOW_TRAFFIC');
  const brand = business?.businessName || facts.site || 'your website';
  const offeringLabel = business?.offerings.slice(0, 2).join(' & ') || business?.industry || 'core offerings';
  const clicks = facts.kpis.find((k) => k.label.toLowerCase().includes('click'))?.value ?? 0;
  const impressions = facts.kpis.find((k) => k.label.toLowerCase().includes('impression'))?.value ?? 0;
  const sessions = facts.traffic?.sessions ?? 0;

  const base: GoogleReportAnalysis = existing ?? {
    executiveSummary: `${brand}${business?.industry ? ` (${business.industry})` : ''} recorded ${n(sessions)} visitor sessions, ${n(clicks)} Google search clicks, and ${n(impressions)} search impressions over the last ${facts.days} days.${
      gaps.length > 0
        ? ` Website Audit shows your business targets ${gaps.map((g) => g.location).join(', ')}, where search clicks or visitor traffic are currently missing or below potential.`
        : ''
    } Priority actions focus on capturing high-intent local and commercial search traffic for ${offeringLabel} and converting those visitors on your key landing pages.`,
    whereWeAre: {
      searchConsole: {
        verdict: facts.searchConsole.hasData
          ? `${n(clicks)} clicks from ${n(impressions)} search impressions in the last ${facts.days} days.`
          : 'Search Console needs active query data to measure keyword positions.',
        points: [
          `Total search clicks: ${n(clicks)} across ${n(impressions)} impressions.`,
          ...(facts.topQueries.length > 0
            ? [`Top query: "${facts.topQueries[0].key}" (${n(facts.topQueries[0].clicks)} clicks, position ${pos(facts.topQueries[0].position)}).`]
            : ['No high-volume search queries recorded in this window yet.']),
        ],
      },
      analytics: {
        verdict: facts.traffic
          ? `${n(facts.traffic.sessions)} sessions and ${n(facts.traffic.users)} active users recorded in GA4.`
          : 'Connect or refresh Google Analytics 4 to measure visitor cities and channels.',
        points: [
          ...(facts.traffic?.countries.length
            ? [`Top country: ${facts.traffic.countries[0].country} (${n(facts.traffic.countries[0].sessions)} sessions).`]
            : []),
          ...(facts.traffic?.cities.length
            ? [`Top cities: ${facts.traffic.cities.slice(0, 3).map((c) => `${c.city} (${n(c.sessions)})`).join(', ')}.`]
            : ['No city-level visitor sessions recorded yet in this window.']),
        ],
      },
    },
    priorities: [],
    quickWins: [],
    marketingStrategy: {
      summary: `Align organic search and local referral channels with ${brand}'s core offerings (${offeringLabel})${
        business?.targetCities.length ? ` in ${business.targetCities.join(', ')}` : ''
      }.`,
      whereTrafficComesFrom: facts.traffic?.channels.length
        ? facts.traffic.channels.map((c) => `${c.channel}: ${n(c.sessions)} sessions (${pct(c.share)})`)
        : ['Traffic channel breakdown will populate as GA4 records visitor sessions.'],
      channels: (facts.traffic?.channels ?? []).slice(0, 4).map((c) => ({
        channel: c.channel,
        verdict: c.channel.toLowerCase().includes('organic') ? 'grow' : 'maintain',
        share: pct(c.share),
        whatWeSee: `${n(c.sessions)} sessions (${pct(c.share)} of traffic).`,
        strategy: `Strengthen ${c.channel} landing pages with clear city and offering signals for ${offeringLabel}.`,
        actions: [
          `Optimize landing page headlines and meta descriptions for ${offeringLabel}.`,
          `Add clear calls-to-action above the fold on top landing pages.`,
        ],
      })),
      audience: gaps.map((g) => `${g.location}: ${g.finding} — ${g.plan}`),
    },
    plan: [
      {
        week: 'Week 1',
        actions: [
          gaps[0]
            ? `Optimize titles, H1s, and local landing page copy for ${gaps[0].location} (${offeringLabel}).`
            : `Update primary service page titles and meta descriptions for ${offeringLabel}.`,
          'Verify Google Search Console indexation for all core commercial pages.',
        ],
      },
      {
        week: 'Week 2',
        actions: [
          'Deploy LocalBusiness and Product/Service JSON-LD schema with target service areas.',
          'Add internal links from informational pages to top commercial landing pages.',
        ],
      },
      {
        week: 'Week 3',
        actions: [
          `Publish high-intent local and commercial content answering buyer questions for ${offeringLabel}.`,
          'Improve snippet CTR on pages receiving impressions with 0 clicks.',
        ],
      },
      {
        week: 'Week 4',
        actions: [
          'Review Search Console click growth and GA4 city-level visitor acquisition.',
          'Forward verified improvements into Fix Engine impact tracking.',
        ],
      },
    ],
    dataGaps: facts.notMeasured,
  };

  const priorities = [...base.priorities];
  for (const gap of gaps) {
    const locLower = gap.location.toLowerCase();
    const alreadyCovered = priorities.some((p) => p.title.toLowerCase().includes(locLower));
    if (!alreadyCovered) {
      priorities.unshift({
        rank: 0,
        title:
          gap.status === 'NO_CLICKS'
            ? `Win search clicks and visitors in ${gap.location} for ${offeringLabel} (currently 0 clicks)`
            : `Grow local search traffic and click quality in ${gap.location} for ${offeringLabel}`,
        platform: 'BOTH',
        priority: 'high',
        impact: 'high',
        effort: 'medium',
        evidence: `${gap.finding} Website Audit Offerings: ${gap.relevantOfferings.join(', ') || offeringLabel}.`,
        whyItMatters: `Your website indicates you do business in ${gap.location}, so missing clicks and visitors from ${gap.location} means high-intent local buyers are not reaching your site.`,
        steps: gap.recommendedSteps,
        measureBy: `Search Console clicks for "${gap.location}" queries and GA4 visitor sessions from ${gap.location}.`,
      });
    }
  }

  if (priorities.length === 0) {
    priorities.push({
      rank: 1,
      title: `Improve Google search click-through rate and commercial keyword targeting for ${offeringLabel}`,
      platform: 'GSC',
      priority: 'high',
      impact: 'high',
      effort: 'low',
      evidence: `Search Console recorded ${n(clicks)} clicks from ${n(impressions)} impressions in the last ${facts.days} days.`,
      whyItMatters: `Aligning your page titles and descriptions with what buyers search for ${offeringLabel} turns existing impressions into qualified clicks.`,
      steps: [
        `Update the homepage and top service page titles to name ${offeringLabel}${business?.primaryCity ? ` in ${business.primaryCity}` : ''}.`,
        'Write action-oriented meta descriptions with a clear value proposition and call to action.',
        'Request re-indexing in Google Search Console and monitor click growth.',
      ],
      measureBy: 'Organic clicks and average CTR in Google Search Console.',
    });
  }

  const ranked = priorities.map((p, i) => ({ ...p, rank: i + 1 }));
  const quickWins = base.quickWins.length > 0
    ? base.quickWins
    : [
        ...(gaps[0] ? [`Add "${gaps[0].location}" and "${offeringLabel}" to your homepage and primary service page title tags.`] : []),
        `Add LocalBusiness / Organization JSON-LD schema with areaServed on ${facts.site || 'your homepage'}.`,
        `Link your highest-traffic landing pages directly to your core ${offeringLabel} inquiry or booking page.`,
      ];

  return {
    ...base,
    priorities: ranked,
    quickWins,
  };
}
