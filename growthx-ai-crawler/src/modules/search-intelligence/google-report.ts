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
    countries: Array<{ country: string; sessions: number }>;
  };
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

export interface GoogleReportAnalysis {
  executiveSummary: string;
  whereWeAre: {
    searchConsole: { verdict: string; points: string[] };
    analytics: { verdict: string; points: string[] };
  };
  /** What to do first, in order. */
  priorities: PriorityItem[];
  quickWins: string[];
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
  top countries: ${t.countries.map((c) => `${c.country} ${n(c.sessions)}`).join(', ') || 'none'}`
    : '  no Analytics data';

  const idx = f.index
    ? `  ${f.index.asked} pages checked with Google: ${f.index.indexed} indexed, ${f.index.notIndexed} not indexed; ${f.index.indexableButNotIndexed} allowed in search but not indexed; ${f.index.canonicalOverridden} where Google chose a different canonical. Reasons: ${f.index.topReasons.map((g) => `${g.state} (${g.count})`).join('; ') || 'none'}`
    : '  no index inspection has been run';

  return `Write an improvement report for the website${f.site ? ` ${f.site}` : ''}, from its Google Search Console and Google Analytics 4 data for the last ${f.days} days.

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
  "plan": [ { "week": "Week 1", "actions": ["..."] } ],
  "dataGaps": ["what could not be measured and what would measure it"]
}

Rules:
- Order "priorities" as the order to do them: high impact and low effort first. Give 5 to 8. Every one names its platform and cites figures from the data above.
- Cover both platforms. If a platform has no data, say so in whereWeAre and put connecting or fixing it first.
- Name the actual queries and page URLs to work on. Give 3 to 5 concrete steps each.
- The plan is 4 weeks, highest impact first.
- Use only the data above. Never invent rankings, traffic, revenue, benchmarks or numbers. If something is "not measured", say it is not measured instead of guessing.
- Small numbers are small: with only a handful of clicks, say the sample is too small to trust and prefer actions that build visibility over actions that tune it.`;
}
