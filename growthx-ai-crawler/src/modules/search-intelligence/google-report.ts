/**
 * The Google improvement report's shape, and the pure parts of it:
 * cleaning business entities, computing deterministic traffic-quality
 * diagnostics, turning measured figures into the AI prompt, and coercing
 * + enriching the model's reply into an executive-ready, zero-repetition plan.
 *
 * Kept free of Nest and Prisma so every rule is unit-tested directly.
 */

import {
  BusinessContextSummary,
  ReportGrowthPlaybook,
  buildPlaybookSchemaSnippet,
  formatBusinessContextForPrompt,
  normalisePlaybook,
} from '../report-context/report-playbook.types';

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

export interface TrafficQualityDiagnostics {
  botAndNoise: {
    suspectedBotSessions: number;
    notSetCitySessions: number;
    noiseShare: number;
    estimatedHumanSessions: number;
    suspectedBotCities: Array<{ city: string; country: string; sessions: number; reason: string }>;
    diagnosis: string;
  };
  conversionTracking: {
    status: 'MISSING' | 'ZERO_RECORDED' | 'ACTIVE';
    keyEvents: number | null;
    conversionRate: number | null;
    recommendedEvents: string[];
    diagnosis: string;
  };
  attributionHealth: {
    status: 'DARK_TRAFFIC_HIGH' | 'UNASSIGNED_SPIKE' | 'HEALTHY';
    directShare: number;
    unassignedShare: number;
    diagnosis: string;
    utmTemplates: Array<{ label: string; channel: string; url: string }>;
  };
  searchOpportunity: {
    strikingDistanceCount: number;
    ctrOpportunityCount: number;
    decliningCount: number;
    estimatedMissedClicks: number;
    indexedPages: number | null;
    notIndexedPages: number | null;
    indexableButNotIndexed: number | null;
    topWinQuery: { query: string; clicks: number; impressions: number; position: number; ctr: number } | null;
  };
  targetMarketFit: {
    targetCitySessions: number;
    nonTargetHumanSessions: number;
    targetMarketShare: number;
    topUntappedCities: Array<{ city: string; country: string; sessions: number }>;
  };
  aiVisibility: {
    answersMeasured: number;
    brandMentions: number;
    recommendations: number;
    mentionRate: number;
    measuredAt: string | null;
  } | null;
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
  /** Shared hyper-local context: covered/missing micro-areas, catalog prices, trust proof & GBP presence. */
  businessContext?: BusinessContextSummary | null;
  /** Comparison between cities/markets where the business operates and actual traffic/clicks received. */
  locationGaps?: LocationTrafficGap[];
  /** Deterministic traffic quality, bot/noise, attribution, conversion & AI visibility diagnostics. */
  diagnostics?: TrafficQualityDiagnostics | null;
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
  /** 7-layer hyper-local growth playbook: possibilities, methods, copy-paste assets, 90-day roadmap. */
  playbook?: ReportGrowthPlaybook;
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

/* ─────────────────────────── Business & Geo Cleaning Helpers ─────────────────────────── */

const UTILITY_PATH_RE =
  /^\/(app(\/|$)|account(\/|$)|my-account(\/|$)|cart(\/|$)|checkout(\/|$)|login(\/|$)|signin(\/|$)|sign-in(\/|$)|signup(\/|$)|sign-up(\/|$)|register(\/|$)|auth(\/|$)|about(-us)?(\/|$)|contact(-us)?(\/|$)|privacy(-policy)?(\/|$)|terms(-of-service|-and-conditions)?(\/|$)|refund(-policy)?(\/|$)|shipping(-policy)?(\/|$)|return(-policy)?(\/|$)|policy(\/|$)|policies(\/|$)|faq(\/|$)|search(\/|$)|404(\/|$)|admin(\/|$)|api(\/|$)|wp-admin(\/|$)|wp-login(\/|$)|dashboard(\/|$)|orders(\/|$)|profile(\/|$)|wishlist(\/|$)|wallet(\/|$))/i;

const GENERIC_HEADING_RE =
  /^(your|my|our)\s+(account|cart|bag|orders?|profile|wishlist|dashboard|wallet|story|team|mission|vision|values|subscriptions?)|^(about|contact|welcome|home|homepage|sign\s*in|log\s*in|register|cart|checkout|menu|search|privacy|terms|refund|shipping|cancellation|cookie|faq|help|support|error|page not found|404)\b/i;

const CITY_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['bengaluru', 'bangalore'],
  ['gurugram', 'gurgaon'],
  ['delhi', 'new delhi'],
  ['mumbai', 'bombay'],
  ['aurangabad', 'chhatrapati sambhajinagar'],
  ['kolkata', 'calcutta'],
  ['chennai', 'madras'],
  ['kochi', 'cochin'],
  ['pune', 'poona'],
];

const KNOWN_DATACENTER_CITIES: Record<string, string> = {
  'council bluffs': 'Google US cloud datacenter & automated crawler hub',
  ashburn: 'Major AWS/cloud datacenter traffic hub (us-east-1)',
  boardman: 'AWS US-West cloud datacenter traffic hub',
  'the dalles': 'Google cloud datacenter traffic hub',
  'des moines': 'Cloud datacenter / automated monitoring hub',
  lenoir: 'Google US datacenter traffic hub',
  boydton: 'Microsoft Azure datacenter traffic hub',
  quincy: 'Cloud datacenter / crawler traffic hub',
  'forest city': 'Cloud datacenter traffic hub',
  pryor: 'Google US datacenter traffic hub',
  coffeyville: 'Automated crawler / datacenter hub',
  'santa clara': 'Cloud infrastructure / monitoring traffic hub',
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isUtilityPath(path: string): boolean {
  const normalized = (path || '').trim().toLowerCase();
  if (!normalized || normalized === '/') return false;
  return UTILITY_PATH_RE.test(normalized);
}

/**
 * Normalizes squashed multi-line DOM headings (e.g. "Good MilkBrighter Days" ->
 * "Good Milk Brighter Days", "Pure Milk.A Healthier You." -> "Pure Milk. A Healthier You.")
 * while preserving the business's own brand casing when provided.
 */
export function cleanHeadingText(raw: string, brand?: string | null): string {
  let text = (raw || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  // Insert space after sentence punctuation glued to the next word (skip URLs/decimals)
  text = text.replace(/([.!?])([A-Z])/g, '$1 $2');
  // Insert space at camel-case boundaries unless it matches the brand token
  const brandNorm = (brand || '').trim();
  text = text
    .split(' ')
    .map((token) => {
      if (brandNorm && token.toLowerCase().includes(brandNorm.toLowerCase())) return token;
      // Only split word boundaries like "MilkBrighter" where both halves are >=3 chars
      return token.replace(/([a-z]{3,})([A-Z][a-z]{2,})/g, '$1 $2');
    })
    .join(' ');
  return text.replace(/\s+/g, ' ').trim();
}

export function isUtilityOrGenericOffering(raw: string, brand?: string | null): boolean {
  const cleaned = cleanHeadingText(raw, brand);
  if (!cleaned || cleaned.length < 3 || cleaned.length > 72) return true;
  if (GENERIC_HEADING_RE.test(cleaned)) return true;
  if (brand && cleaned.toLowerCase() === brand.trim().toLowerCase()) return true;
  // Filter pure two-sentence marketing taglines (e.g. "Pure Milk. A Healthier You.")
  if (/[.!]\s+[A-Z]/.test(cleaned) && cleaned.split(' ').length <= 7) return true;
  return false;
}

/**
 * Strips embedded city/location phrases from an offering name so templates never
 * generate gibberish like "Fresh Milk Delivery in Navi Mumbai in Navi Mumbai".
 */
export function stripLocationFromOffering(offering: string, cities: string[] = []): string {
  let out = cleanHeadingText(offering);
  if (!out) return '';
  const ordered = [...cities]
    .map((c) => c.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const city of ordered) {
    const escaped = escapeRegex(city);
    // Remove trailing/embedded "in <city>", "near <city>", "across <city>", "for <city>", "- <city>"
    out = out.replace(new RegExp(`\\s*(?:\\bin\\b|\\bnear\\b|\\bacross\\b|\\bfor\\b|\\bat\\b|[-–—|:,])\\s*${escaped}\\b`, 'gi'), '');
    // Also remove bare leading/trailing city token if something meaningful remains
    const strippedBare = out.replace(new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
    if (strippedBare.length >= 4) {
      out = strippedBare;
    }
  }
  return out.replace(/^[\s,–—-]+|[\s,–—-]+$/g, '').replace(/\s+/g, ' ').trim() || cleanHeadingText(offering);
}

/**
 * Exact normalized city match with curated synonym pairs — NEVER uses naive
 * substring matching so "Mumbai" and "Navi Mumbai" never double-count each other.
 */
export function matchExactCity(gaCity: string, targetCity: string): boolean {
  const a = (gaCity || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const b = (targetCity || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!a || !b || a === '(not set)') return false;
  if (a === b) return true;
  return CITY_SYNONYM_GROUPS.some((group) => group.includes(a) && group.includes(b));
}

/**
 * Word-boundary query matching where longer multi-word target locations
 * (e.g. "Navi Mumbai") take precedence over shorter substrings ("Mumbai").
 */
export function queryMatchesLocation(query: string, location: string, allLocations: string[]): boolean {
  let text = (query || '').toLowerCase();
  const locLower = location.trim().toLowerCase();
  if (!text || !locLower) return false;

  // Mask any longer target location that contains `locLower` first
  const longerContaining = allLocations
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length > locLower.length && l.includes(locLower))
    .sort((a, b) => b.length - a.length);

  for (const longer of longerContaining) {
    text = text.replace(new RegExp(`\\b${escapeRegex(longer)}\\b`, 'gi'), ' ');
  }

  const candidates = new Set<string>([locLower]);
  for (const group of CITY_SYNONYM_GROUPS) {
    if (group.includes(locLower)) {
      group.forEach((syn) => candidates.add(syn));
    }
  }

  for (const candidate of candidates) {
    if (new RegExp(`\\b${escapeRegex(candidate)}\\b`, 'i').test(text)) return true;
  }
  return false;
}

/* ─────────────────────────── Deterministic Diagnostics Engine ─────────────────────────── */

function parseMissedClicks(extra?: string): number {
  if (!extra) return 0;
  const m = extra.match(/roughly\s+([\d,]+)\s+clicks?\s+missed/i);
  if (!m) return 0;
  const val = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(val) ? val : 0;
}

function buildRecommendedEvents(business?: BusinessTrafficContext | null): string[] {
  const corpus = `${business?.industry ?? ''} ${business?.businessModel ?? ''} ${business?.summary ?? ''} ${(business?.offerings ?? []).join(' ')}`.toLowerCase();
  if (/milk|dairy|food|grocery|subscri|ecommerce|e-commerce|d2c|store|shop|deliver/.test(corpus)) {
    return ['subscription_started', 'begin_checkout', 'purchase', 'whatsapp_order_click'];
  }
  if (/saas|software|platform|app|b2b|tool/.test(corpus)) {
    return ['sign_up', 'demo_booked', 'start_trial', 'pricing_cta_click'];
  }
  if (/clinic|doctor|hospital|academy|school|interior|agency|consult|service|real estate/.test(corpus)) {
    return ['generate_lead', 'form_submit', 'phone_call_click', 'whatsapp_inquiry'];
  }
  return ['generate_lead', 'sign_up', 'form_submit', 'contact_click'];
}

export function computeTrafficDiagnostics(
  facts: Pick<
    GoogleReportFacts,
    'site' | 'days' | 'traffic' | 'business' | 'locationGaps' | 'topQueries' | 'strikingDistance' | 'ctrOpportunities' | 'decliningQueries' | 'index'
  >,
  aiVisibility: TrafficQualityDiagnostics['aiVisibility'] = null,
): TrafficQualityDiagnostics {
  const t = facts.traffic;
  const totalSessions = t?.sessions ?? 0;
  const targetCities = facts.business?.targetCities ?? [];
  const rawCities = t?.cities ?? [];

  // 1. Bot / Datacenter & (not set) detection
  const suspectedBotCities: TrafficQualityDiagnostics['botAndNoise']['suspectedBotCities'] = [];
  let suspectedBotSessions = 0;
  let notSetCitySessions = 0;

  for (const c of rawCities) {
    const cityLower = (c.city || '').trim().toLowerCase();
    if (!cityLower || cityLower === '(not set)') {
      notSetCitySessions += c.sessions || 0;
      continue;
    }
    const isTarget = targetCities.some((tc) => matchExactCity(c.city, tc));
    const dcReason = KNOWN_DATACENTER_CITIES[cityLower];
    if (dcReason && !isTarget) {
      suspectedBotSessions += c.sessions || 0;
      suspectedBotCities.push({
        city: c.city,
        country: c.country,
        sessions: c.sessions,
        reason: dcReason,
      });
    }
  }

  const estimatedHumanSessions = Math.max(0, totalSessions - suspectedBotSessions);
  const noiseShare = totalSessions > 0 ? suspectedBotSessions / totalSessions : 0;

  let botDiagnosis = 'No obvious cloud datacenter or crawler spikes detected in GA4 top cities.';
  if (suspectedBotSessions > 0 && totalSessions > 0) {
    const topDc = suspectedBotCities[0];
    botDiagnosis =
      `${topDc.city} (${topDc.sessions} sessions — ${topDc.reason}) accounts for ${((suspectedBotSessions / totalSessions) * 100).toFixed(1)}% of recorded GA4 traffic` +
      (notSetCitySessions > 0 ? `, alongside ${notSetCitySessions} "(not set)" city sessions` : '') +
      `. Estimated non-datacenter sessions: ${estimatedHumanSessions.toLocaleString('en-US')} of ${totalSessions.toLocaleString('en-US')}.`;
  } else if (notSetCitySessions > 0 && totalSessions > 0 && notSetCitySessions / totalSessions >= 0.1) {
    botDiagnosis = `${notSetCitySessions} sessions (${((notSetCitySessions / totalSessions) * 100).toFixed(1)}%) have "(not set)" city in GA4, typically caused by VPNs, mobile proxy IPs, or automated checks.`;
  }

  // 2. Conversion Tracking Audit
  const keyEvents = t ? t.keyEvents : null;
  const conversionStatus: TrafficQualityDiagnostics['conversionTracking']['status'] =
    keyEvents == null ? 'MISSING' : keyEvents === 0 && totalSessions > 0 ? 'ZERO_RECORDED' : 'ACTIVE';
  const conversionRate =
    keyEvents != null && estimatedHumanSessions > 0 ? keyEvents / estimatedHumanSessions : null;
  const recommendedEvents = buildRecommendedEvents(facts.business);

  const conversionDiagnosis =
    conversionStatus === 'ACTIVE'
      ? `${keyEvents} GA4 key event${keyEvents === 1 ? '' : 's'} recorded (${conversionRate != null ? `${(conversionRate * 100).toFixed(1)}%` : '0%'} of non-datacenter sessions).`
      : conversionStatus === 'ZERO_RECORDED'
        ? `${totalSessions.toLocaleString('en-US')} sessions recorded with 0 GA4 key events in the last ${facts.days} days — you cannot yet see which channels, pages, or cities drive real leads or orders.`
        : 'No GA4 key events are configured yet, leaving acquisition ROI unmeasured.';

  // 3. Attribution & Direct Dark-Traffic Audit
  const directChannel = t?.channels.find((c) => c.channel.toLowerCase() === 'direct');
  const unassignedChannel = t?.channels.find((c) => c.channel.toLowerCase() === 'unassigned');
  const directShare = directChannel?.share ?? 0;
  const unassignedShare = unassignedChannel?.share ?? 0;
  const attributionStatus: TrafficQualityDiagnostics['attributionHealth']['status'] =
    directShare >= 0.5 ? 'DARK_TRAFFIC_HIGH' : unassignedShare >= 0.05 ? 'UNASSIGNED_SPIKE' : 'HEALTHY';

  const baseHost = facts.site ? `https://${facts.site.replace(/^https?:\/\//i, '').replace(/\/+$/, '')}` : 'https://yourdomain.com';
  const utmTemplates = [
    {
      label: 'Google Business Profile Website Link',
      channel: 'Local Organic',
      url: `${baseHost}/?utm_source=google&utm_medium=organic&utm_campaign=gbp_profile`,
    },
    {
      label: 'WhatsApp Catalog / Broadcasts',
      channel: 'Messaging / Social',
      url: `${baseHost}/?utm_source=whatsapp&utm_medium=social&utm_campaign=local_orders`,
    },
    {
      label: 'Instagram Bio & Stories',
      channel: 'Organic Social',
      url: `${baseHost}/?utm_source=instagram&utm_medium=social&utm_campaign=bio_link`,
    },
  ];

  const attributionDiagnosis =
    attributionStatus === 'DARK_TRAFFIC_HIGH'
      ? `Direct accounts for ${(directShare * 100).toFixed(1)}% of sessions. High Direct share usually mixes returning users with untagged WhatsApp, Instagram, and Google Business Profile links${
          suspectedBotSessions > 0 ? ` — plus ${suspectedBotSessions} suspected datacenter hits` : ''
        }.`
      : attributionStatus === 'UNASSIGNED_SPIKE'
        ? `Unassigned traffic is ${(unassignedShare * 100).toFixed(1)}%, indicating non-standard UTM values or cross-domain redirect attribution breaks.`
        : 'Channel attribution is balanced across measured acquisition sources.';

  // 4. Search Opportunity Rollup
  const estimatedMissedClicks = facts.ctrOpportunities.reduce((sum, r) => sum + parseMissedClicks(r.extra), 0);
  const topWinRow = facts.strikingDistance[0] ?? facts.ctrOpportunities[0] ?? facts.topQueries[0] ?? null;
  const topWinQuery = topWinRow
    ? {
        query: topWinRow.key,
        clicks: topWinRow.clicks,
        impressions: topWinRow.impressions,
        position: topWinRow.position,
        ctr: topWinRow.ctr,
      }
    : null;

  // 5. Target Market Fit vs. Untapped Adjacent Cities
  let targetCitySessions = 0;
  const topUntappedCities: Array<{ city: string; country: string; sessions: number }> = [];

  for (const c of rawCities) {
    const cityLower = (c.city || '').trim().toLowerCase();
    if (!cityLower || cityLower === '(not set)') continue;
    if (KNOWN_DATACENTER_CITIES[cityLower]) continue;
    const isTarget = targetCities.some((tc) => matchExactCity(c.city, tc));
    if (isTarget) {
      targetCitySessions += c.sessions || 0;
    } else if ((c.sessions || 0) >= 3) {
      topUntappedCities.push({ city: c.city, country: c.country, sessions: c.sessions });
    }
  }

  const nonTargetHumanSessions = Math.max(0, estimatedHumanSessions - targetCitySessions - notSetCitySessions);
  const targetMarketShare = estimatedHumanSessions > 0 ? Math.min(1, targetCitySessions / estimatedHumanSessions) : 0;

  return {
    botAndNoise: {
      suspectedBotSessions,
      notSetCitySessions,
      noiseShare,
      estimatedHumanSessions,
      suspectedBotCities,
      diagnosis: botDiagnosis,
    },
    conversionTracking: {
      status: conversionStatus,
      keyEvents,
      conversionRate,
      recommendedEvents,
      diagnosis: conversionDiagnosis,
    },
    attributionHealth: {
      status: attributionStatus,
      directShare,
      unassignedShare,
      diagnosis: attributionDiagnosis,
      utmTemplates,
    },
    searchOpportunity: {
      strikingDistanceCount: facts.strikingDistance.length,
      ctrOpportunityCount: facts.ctrOpportunities.length,
      decliningCount: facts.decliningQueries.length,
      estimatedMissedClicks,
      indexedPages: facts.index?.indexed ?? null,
      notIndexedPages: facts.index?.notIndexed ?? null,
      indexableButNotIndexed: facts.index?.indexableButNotIndexed ?? null,
      topWinQuery,
    },
    targetMarketFit: {
      targetCitySessions,
      nonTargetHumanSessions,
      targetMarketShare,
      topUntappedCities: topUntappedCities.slice(0, 5),
    },
    aiVisibility,
  };
}

/* ─────────────────────────── Normalisation & Prompting ─────────────────────────── */

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
    ...(normalisePlaybook(r.playbook) ? { playbook: normalisePlaybook(r.playbook) } : {}),
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
  key commercial pages: ${b.auditedPages.slice(0, 8).map((p) => `${p.path} (${p.title})`).join('; ') || 'none'}\n`
    : '';

  const gaps = f.locationGaps ?? [];
  const locationSection = gaps.length > 0
    ? `\nTARGET BUSINESS LOCATIONS VS ACTUAL TRAFFIC (exact city match, no double counting)
${gaps.map((g) => `  - ${g.location} [${g.status}]: ${g.sessions} GA4 sessions, ${g.searchClicks} search clicks, ${g.searchImpressions} impressions. ${g.finding}`).join('\n')}\n`
    : '';

  const d = f.diagnostics;
  const diagnosticsSection = d
    ? `\nTRAFFIC QUALITY & ATTRIBUTION DIAGNOSTICS
  datacenter / bot traffic: ${d.botAndNoise.diagnosis}
  conversion tracking: ${d.conversionTracking.diagnosis}
  attribution health: ${d.attributionHealth.diagnosis}
  target market fit: ${d.targetMarketFit.targetCitySessions} sessions in target cities (${pct(d.targetMarketFit.targetMarketShare)} of non-datacenter traffic)${
    d.targetMarketFit.topUntappedCities.length
      ? `; untapped cities sending visitors: ${d.targetMarketFit.topUntappedCities.map((c) => `${c.city} (${c.sessions})`).join(', ')}`
      : ''
  }${
    d.aiVisibility
      ? `\n  AI visibility snapshot: cited in ${d.aiVisibility.brandMentions} of ${d.aiVisibility.answersMeasured} AI answers (${pct(d.aiVisibility.mentionRate)})`
      : ''
  }\n`
    : '';

  const richBizBlock = formatBusinessContextForPrompt(f.businessContext);

  return `Write an executive-grade traffic and growth improvement report for the website${f.site ? ` ${f.site}` : ''}, from its Website Audit, Google Search Console, and Google Analytics 4 data for the last ${f.days} days.
${businessSection}${richBizBlock}${locationSection}${diagnosticsSection}
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
  "executiveSummary": "4-5 crisp executive sentences: true traffic trajectory (separating real human demand from any datacenter/bot noise), what is working, the #1 bottleneck holding back growth, and the exact single highest-leverage move to execute first.",
  "whereWeAre": {
    "searchConsole": { "verdict": "one sharp sentence", "points": ["3-4 specific findings citing real queries, positions, impressions, CTR, or index status"] },
    "analytics": { "verdict": "one sharp sentence", "points": ["3-4 specific findings citing real sessions, engagement, datacenter noise, key events, and top cities/landing pages"] }
  },
  "priorities": [
    {
      "title": "the specific action in plain, natural English (never repeat a city name twice)",
      "platform": "GSC | GA4 | BOTH",
      "priority": "high|medium|low",
      "impact": "high|medium|low",
      "effort": "high|medium|low",
      "evidence": "exact figures, queries, cities, and URLs from the data above",
      "whyItMatters": "what business outcome it unlocks (clicks, qualified leads, attribution accuracy, or conversion visibility)",
      "steps": ["concrete step 1", "concrete step 2", "concrete step 3"],
      "measureBy": "exact metric and report to track success"
    }
  ],
  "quickWins": ["4-5 concrete actions under 1 hour naming exact URLs, queries, UTM tags, or GA4 events"],
  "marketingStrategy": {
    "summary": "3-4 sentences explaining channel dependence, dark-traffic/attribution risks, and how to diversify acquisition.",
    "whereTrafficComesFrom": ["specific findings with session counts, share %, engagement rates, and named sources"],
    "channels": [
      {
        "channel": "Exact channel name from GA4 plus 1 high-fit missing channel marked verdict='start'",
        "verdict": "grow | fix | start | maintain",
        "share": "measured share % from data, or '0% (not started)'",
        "whatWeSee": "measured sessions, share, engagement, and named source/medium",
        "strategy": "channel-specific strategy (NEVER repeat the same strategy text across channels! Direct = UTM/dark-traffic/app hygiene; Organic = striking distance + CTR + local landing pages; Referral = partner sites; Unassigned = UTM/redirect attribution fix)",
        "actions": ["channel-specific action 1", "channel-specific action 2", "channel-specific action 3"]
      }
    ],
    "audience": ["distinct insights about visitor geography, target market coverage vs. bot noise or untapped adjacent cities — do NOT copy-paste the Target City findings word for word"]
  },
  "plan": [ { "week": "Week 1", "actions": ["2-3 specific actions"] } ],
  "dataGaps": ["what could not be measured and exactly how to unlock it"],
  ${buildPlaybookSchemaSnippet('traffic')}
}

Rules:
- Order "priorities" by highest impact & lowest effort first. Provide 5 to 7 DISTINCT priorities covering: (a) GA4 conversion tracking if key events = 0/missing, (b) datacenter/bot filtering & Direct UTM attribution if Direct > 50% or bot cities exist, (c) striking-distance queries (positions 4-20) naming the exact query & rank, (d) CTR opportunities naming exact URLs/missed clicks, (e) each target city with 0 clicks or low traffic, and (f) indexation or declining queries when present.
- NEVER copy-paste identical strategies or bullets across different channels in marketingStrategy.channels. Every channel must have advice specific to how that channel actually works.
- NEVER repeat a city name twice inside a keyword or title (e.g. write "service name in City", never "service name in City in City").
- NEVER treat utility pages (/app, /account, /cart, /about-us) as commercial products.
- Use ONLY the facts given. Never invent rankings, traffic, revenue, benchmarks or numbers. If something is "not measured", say so plainly.
- Small numbers are small: when click counts are small, say the sample is early-stage and prioritize visibility & tracking foundations over micro-tuning.`;
}

/* ─────────────────────────── Smart Channel & Fallback Engine ─────────────────────────── */

function cleanPrimaryOffering(facts: GoogleReportFacts): string {
  const cities = facts.business?.targetCities ?? [];
  const rawOfferings = (facts.business?.offerings ?? [])
    .map((o) => stripLocationFromOffering(o, cities))
    .filter((o) => !isUtilityOrGenericOffering(o, facts.business?.businessName));
  if (rawOfferings.length > 0) return rawOfferings[0];
  const industry = facts.business?.industry ? stripLocationFromOffering(facts.business.industry, cities) : '';
  return industry || 'core offerings';
}

function buildChannelPlaybook(
  c: { channel: string; sessions: number; share: number; engagementRate: number | null; keyEvents: number | null },
  facts: GoogleReportFacts,
  offering: string,
  diag: TrafficQualityDiagnostics,
): ChannelStrategy {
  const lower = c.channel.toLowerCase();
  const sources = (facts.traffic?.sources ?? [])
    .filter((s) => s.channel.toLowerCase() === lower)
    .slice(0, 3);
  const sourceNote = sources.length
    ? ` Named sources: ${sources.map((s) => `${s.source}/${s.medium} (${n(s.sessions)})`).join(', ')}.`
    : '';
  const engNote = c.engagementRate != null ? ` Engagement rate: ${pct(c.engagementRate)}.` : '';
  const topQuery = facts.strikingDistance[0] ?? facts.topQueries[0];
  const primaryCity = facts.business?.primaryCity;

  if (lower === 'direct') {
    const isHeavy = c.share >= 0.5;
    const botNote =
      diag.botAndNoise.suspectedBotSessions > 0
        ? ` Includes up to ${n(diag.botAndNoise.suspectedBotSessions)} suspected datacenter sessions (${diag.botAndNoise.suspectedBotCities.map((x) => x.city).join(', ')}).`
        : '';
    return {
      channel: c.channel,
      verdict: isHeavy ? 'fix' : 'maintain',
      share: pct(c.share),
      whatWeSee: `${n(c.sessions)} sessions (${pct(c.share)} of traffic).${engNote}${botNote}`,
      strategy: isHeavy
        ? `Direct carries ${pct(c.share)} of visits — a classic dark-traffic signal where untagged WhatsApp, Instagram, and Google Business Profile links plus automated pings are lumped together. Clean up attribution so you can see which real campaigns drive ${offering} buyers.`
        : `Direct reflects repeat visitors and brand recall. Keep brand links tagged and separate returning app/account visits from new customer acquisition.`,
      actions: [
        `Tag your Google Business Profile, WhatsApp catalog, and Instagram bio links with UTM parameters (ready-to-copy links in the Attribution Audit above).`,
        diag.botAndNoise.suspectedBotSessions > 0
          ? `Filter known datacenter/internal traffic (${diag.botAndNoise.suspectedBotCities[0]?.city}) in GA4 Data Streams → Configure Tag Settings → Define Internal Traffic.`
          : `Check GA4 top landing pages to separate returning customer logins from new buyer landings.`,
        `Configure GA4 key events (${diag.conversionTracking.recommendedEvents.slice(0, 2).join(', ')}) so Direct conversions are measurable.`,
      ],
    };
  }

  if (lower.includes('organic search')) {
    const clicks = facts.kpis.find((k) => k.label.toLowerCase().includes('click'))?.value ?? 0;
    const impressions = facts.kpis.find((k) => k.label.toLowerCase().includes('impression'))?.value ?? 0;
    return {
      channel: c.channel,
      verdict: 'grow',
      share: pct(c.share),
      whatWeSee: `${n(c.sessions)} GA4 sessions (${pct(c.share)} of traffic) and ${n(clicks)} GSC clicks across ${n(impressions)} impressions.${engNote}${sourceNote}`,
      strategy: `Organic Search is your highest-intent compounding acquisition channel. Focus on moving striking-distance keywords onto the top half of Page 1 and launching dedicated local landing pages${
        primaryCity ? ` for ${primaryCity}` : ''
      }.`,
      actions: [
        topQuery
          ? `Upgrade the page ranking for "${topQuery.key}" (position ${pos(topQuery.position)}, ${n(topQuery.impressions)} impressions) with stronger H1/title alignment, buyer FAQs, and internal links.`
          : `Publish high-intent commercial landing pages targeting "${offering}${primaryCity ? ` in ${primaryCity}` : ''}".`,
        facts.ctrOpportunities[0]
          ? `Rewrite title and meta description on ${facts.ctrOpportunities[0].key} (${facts.ctrOpportunities[0].extra || 'below expected CTR'}) to capture missed search clicks.`
          : `Rewrite meta descriptions on pages with impressions and 0 clicks to highlight delivery speed, pricing, or local trust proof.`,
        `Deploy LocalBusiness + Product/Service JSON-LD schema with explicit areaServed cities and request indexing in Search Console.`,
      ],
    };
  }

  if (lower.includes('referral')) {
    return {
      channel: c.channel,
      verdict: c.sessions >= 10 ? 'grow' : 'maintain',
      share: pct(c.share),
      whatWeSee: `${n(c.sessions)} sessions (${pct(c.share)} of traffic).${engNote}${sourceNote}`,
      strategy: `Referral visits represent third-party trust endorsements. Audit which referring domains drive engaged sessions, protect those backlinks from breaking, and replicate placements on high-trust local directories and partner sites.`,
      actions: [
        sources.length
          ? `Inspect top referrer ${sources[0].source} (${n(sources[0].sessions)} sessions) and confirm its target URL has a clear above-the-fold conversion CTA.`
          : `Refresh GA4 source/medium breakdown to identify which exact partner sites are sending Referral sessions.`,
        `Ensure local citations, community directories, and partner listings point to your core ${offering} landing page rather than utility pages.`,
        `Check Reigel Backlink Intelligence to recover any lost referring domains and add local press/community mentions${primaryCity ? ` in ${primaryCity}` : ''}.`,
      ],
    };
  }

  if (lower.includes('unassigned')) {
    return {
      channel: c.channel,
      verdict: c.share >= 0.05 ? 'fix' : 'maintain',
      share: pct(c.share),
      whatWeSee: `${n(c.sessions)} sessions (${pct(c.share)} of traffic) could not be matched to a standard GA4 channel group.${engNote}${sourceNote}`,
      strategy: `Unassigned traffic is a tracking hygiene issue — not an on-page SEO issue. It happens when custom UTM mediums don't match GA4 default rules, redirects strip query strings, or events fire without session_start.`,
      actions: [
        `Standardize all campaign links to lowercase GA4-recognized utm_medium values (organic, social, referral, email, cpc).`,
        `Verify HTTP → HTTPS and non-www → www redirects preserve query parameters (?utm_...) cleanly.`,
        `Verify the GA4 gtag.js snippet loads in the <head> of every page before user redirects or app logins.`,
      ],
    };
  }

  if (lower.includes('social')) {
    return {
      channel: c.channel,
      verdict: 'grow',
      share: pct(c.share),
      whatWeSee: `${n(c.sessions)} sessions (${pct(c.share)} of traffic).${engNote}${sourceNote}`,
      strategy: `Social channels build local awareness and brand search demand for ${offering}. Send social traffic directly to a fast, mobile-first conversion page with UTM tagging.`,
      actions: [
        `Point bio and post links to a dedicated ${offering} offer page with clean UTM tags.`,
        `Showcase real local customer proof${primaryCity ? ` from ${primaryCity}` : ''} to lift landing engagement.`,
        `Track sign-ups and WhatsApp/checkout clicks as GA4 key events to prove social ROI.`,
      ],
    };
  }

  return {
    channel: c.channel,
    verdict: 'maintain',
    share: pct(c.share),
    whatWeSee: `${n(c.sessions)} sessions (${pct(c.share)} of traffic).${engNote}${sourceNote}`,
    strategy: `Monitor ${c.channel} engagement and conversion performance alongside your primary organic growth initiatives for ${offering}.`,
    actions: [
      `Verify landing pages receiving ${c.channel} traffic match visitor intent and load cleanly on mobile.`,
      `Attach consistent UTM tags so ${c.channel} performance is isolated from Direct traffic.`,
      `Track GA4 key events on ${c.channel} sessions before scaling effort.`,
    ],
  };
}

/**
 * Ensures the report analysis always includes complete diagnostics-driven priorities,
 * distinct channel strategies, and clean non-duplicated geo actions — both when
 * enriching AI output and when acting as a deterministic strategist fallback.
 */
export function enrichAnalysisWithBusinessGaps(
  existing: GoogleReportAnalysis | null,
  facts: GoogleReportFacts,
): GoogleReportAnalysis {
  const business = facts.business;
  const targetCities = business?.targetCities ?? [];
  const gaps = (facts.locationGaps ?? []).filter((g) => g.status === 'NO_CLICKS' || g.status === 'LOW_TRAFFIC');
  const brand = business?.businessName || facts.site || 'your website';
  const offering = cleanPrimaryOffering(facts);
  const diag = facts.diagnostics ?? computeTrafficDiagnostics(facts);

  const clicks = facts.kpis.find((k) => k.label.toLowerCase().includes('click'))?.value ?? 0;
  const clicksDelta = facts.kpis.find((k) => k.label.toLowerCase().includes('click'))?.change;
  const impressions = facts.kpis.find((k) => k.label.toLowerCase().includes('impression'))?.value ?? 0;
  const avgCtr = facts.kpis.find((k) => k.label.toLowerCase().includes('ctr'))?.value;
  const avgPos = facts.kpis.find((k) => k.label.toLowerCase().includes('position'))?.value;
  const sessions = facts.traffic?.sessions ?? 0;

  // Build non-repetitive, high-signal fallback analysis when AI returned null
  const channelStrategies: ChannelStrategy[] = (facts.traffic?.channels ?? [])
    .slice(0, 5)
    .map((c) => buildChannelPlaybook(c, facts, offering, diag));

  const hasSocial = channelStrategies.some((c) => c.channel.toLowerCase().includes('social'));
  if (facts.traffic && !hasSocial && channelStrategies.length < 6) {
    channelStrategies.push({
      channel: 'Organic Social & Local GBP (UTM)',
      verdict: 'start',
      share: '0% measured',
      whatWeSee: 'No Organic Social or UTM-tagged Google Business Profile sessions are separately attributed in GA4 yet.',
      strategy: `For a local ${offering} business${
        business?.primaryCity ? ` in ${business.primaryCity}` : ''
      }, Instagram, WhatsApp broadcasts, and Google Business Profile are often the fastest top-of-funnel drivers — tagging them reveals true local demand instead of burying it inside Direct.`,
      actions: [
        `Replace your Google Business Profile website URL with the UTM-tagged link from the Attribution Audit section.`,
        `Add UTM-tagged links to Instagram bio/reels and WhatsApp customer broadcasts pointing to your core ${offering} page.`,
        `Post weekly local proof updates${business?.primaryCity ? ` featuring ${business.primaryCity} delivery/service areas` : ''} and track resulting GA4 sessions.`,
      ],
    });
  }

  // Distinct audience insights (not a copy-paste of Target City findings!)
  const audienceInsights: string[] = [];
  if (diag.botAndNoise.suspectedBotSessions > 0) {
    audienceInsights.push(diag.botAndNoise.diagnosis);
  }
  if (targetCities.length > 0 && sessions > 0) {
    audienceInsights.push(
      `Target market alignment: ${n(diag.targetMarketFit.targetCitySessions)} GA4 sessions came directly from your configured target cities (${targetCities.join(', ')}), representing ${pct(diag.targetMarketFit.targetMarketShare)} of estimated non-datacenter traffic.`,
    );
  }
  if (diag.targetMarketFit.topUntappedCities.length > 0) {
    audienceInsights.push(
      `Untapped non-target cities sending visitors: ${diag.targetMarketFit.topUntappedCities.map((c) => `${c.city} (${n(c.sessions)})`).join(', ')}. Consider adding any you can serve to Target Cities above.`,
    );
  }
  if (audienceInsights.length === 0 && facts.traffic?.countries.length) {
    audienceInsights.push(
      `Primary geography: ${facts.traffic.countries.slice(0, 3).map((c) => `${c.country} (${n(c.sessions)})`).join(', ')}.`,
    );
  }

  const gscPoints: string[] = [];
  if (facts.searchConsole.hasData) {
    gscPoints.push(
      `${n(clicks)} organic clicks (${clicksDelta ?? 'no prior baseline'}) from ${n(impressions)} impressions — average CTR ${pct(avgCtr)} at position ${avgPos != null ? pos(avgPos) : 'not measured'}.`,
    );
    if (facts.topQueries.length > 0) {
      gscPoints.push(
        `Top query: "${facts.topQueries[0].key}" (${n(facts.topQueries[0].clicks)} clicks, ${n(facts.topQueries[0].impressions)} impressions, position ${pos(facts.topQueries[0].position)}).`,
      );
    }
    if (facts.strikingDistance.length > 0) {
      gscPoints.push(
        `${facts.strikingDistance.length} striking-distance quer${facts.strikingDistance.length === 1 ? 'y' : 'ies'} ranking in positions 4–20 ready to push onto top Page 1 (led by "${facts.strikingDistance[0].key}" at #${pos(facts.strikingDistance[0].position)}).`,
      );
    }
    if (facts.index) {
      gscPoints.push(
        `Index coverage: ${facts.index.indexed} of ${facts.index.asked} inspected URLs indexed${facts.index.indexableButNotIndexed > 0 ? ` (${facts.index.indexableButNotIndexed} indexable pages still waiting for Google)` : ''}.`,
      );
    }
  } else {
    gscPoints.push('Connect and sync Google Search Console to unlock query positions, CTR gaps, and index diagnostics.');
  }

  const gaPoints: string[] = [];
  if (facts.traffic) {
    gaPoints.push(
      `${n(facts.traffic.sessions)} total sessions (${n(facts.traffic.users)} active users) with ${pct(facts.traffic.engagementRate)} engagement rate.`,
    );
    if (diag.botAndNoise.suspectedBotSessions > 0) {
      gaPoints.push(
        `Datacenter noise alert: ${n(diag.botAndNoise.suspectedBotSessions)} sessions (${pct(diag.botAndNoise.noiseShare)}) came from ${diag.botAndNoise.suspectedBotCities.map((c) => c.city).join(', ')} — estimated non-datacenter traffic is ${n(diag.botAndNoise.estimatedHumanSessions)} sessions.`,
      );
    }
    gaPoints.push(diag.conversionTracking.diagnosis);
    if (facts.traffic.landingPages.length > 0) {
      const topLp = facts.traffic.landingPages[0];
      gaPoints.push(`Top landing page: ${topLp.page} (${n(topLp.sessions)} sessions, ${pct(topLp.engagementRate)} engagement).`);
    }
  } else {
    gaPoints.push('Connect or refresh Google Analytics 4 to measure visitor cities, channels, engagement, and conversions.');
  }

  const headlineBottleneck =
    diag.conversionTracking.status !== 'ACTIVE' && sessions > 0
      ? `0 GA4 key events are recorded across ${n(sessions)} sessions (so conversions are currently invisible)`
      : gaps.length > 0
        ? `target cities (${gaps.map((g) => g.location).join(', ')}) have 0 or low Google search clicks`
        : facts.strikingDistance.length > 0
          ? `${facts.strikingDistance.length} keywords sit just below top-3 rankings`
          : `search click-through rate (${pct(avgCtr)}) leaves impressions unconverted`;

  const firstMove =
    diag.conversionTracking.status !== 'ACTIVE' && sessions > 0
      ? `configure GA4 conversion tracking (${diag.conversionTracking.recommendedEvents.slice(0, 2).join(' & ')}) alongside dedicated local search capture for ${offering}`
      : gaps.length > 0
        ? `publish and optimize dedicated local landing pages and schema for ${offering} in ${gaps[0].location}`
        : facts.strikingDistance[0]
          ? `upgrade the landing page for "${facts.strikingDistance[0].key}" (position ${pos(facts.strikingDistance[0].position)})`
          : `upgrade titles and meta descriptions on high-impression pages to lift CTR`;

  const base: GoogleReportAnalysis = existing ?? {
    executiveSummary:
      `${brand}${business?.industry ? ` (${stripLocationFromOffering(business.industry, targetCities)})` : ''} recorded ${n(sessions)} GA4 sessions` +
      (diag.botAndNoise.suspectedBotSessions > 0
        ? ` (${n(diag.botAndNoise.estimatedHumanSessions)} excluding ${n(diag.botAndNoise.suspectedBotSessions)} suspected datacenter hits)`
        : '') +
      `, ${n(clicks)} Google search clicks${clicksDelta ? ` (${clicksDelta})` : ''}, and ${n(impressions)} impressions over the last ${facts.days} days. ` +
      `The primary bottleneck holding growth back is that ${headlineBottleneck}. ` +
      `Focus immediately on the ranked queue below: ${firstMove}.`,
    whereWeAre: {
      searchConsole: {
        verdict: facts.searchConsole.hasData
          ? `${n(clicks)} clicks from ${n(impressions)} search impressions (${pct(avgCtr)} CTR, avg position ${avgPos != null ? pos(avgPos) : '—'}) in the last ${facts.days} days.`
          : 'Search Console needs active query data to measure keyword positions.',
        points: gscPoints,
      },
      analytics: {
        verdict: facts.traffic
          ? `${n(facts.traffic.sessions)} sessions (${n(facts.traffic.users)} active users, ${pct(facts.traffic.engagementRate)} engagement)${
              diag.botAndNoise.suspectedBotSessions > 0 ? ` — ${pct(diag.botAndNoise.noiseShare)} from suspected datacenter traffic` : ''
            }.`
          : 'Connect or refresh Google Analytics 4 to measure visitor cities and channels.',
        points: gaPoints,
      },
    },
    priorities: [],
    quickWins: [],
    marketingStrategy: {
      summary:
        facts.traffic && facts.traffic.channels.length > 0
          ? `${facts.traffic.channels[0].channel} currently represents ${pct(facts.traffic.channels[0].share)} of recorded sessions${
              diag.attributionHealth.status === 'DARK_TRAFFIC_HIGH'
                ? ', signaling heavy dark/untagged traffic alongside repeat visits'
                : ''
            }. Diversifying into high-intent Organic Search${business?.primaryCity ? ` across ${targetCities.join(' & ')}` : ''} and UTM-tagged local social/GBP channels will create measurable, compounding acquisition for ${offering}.`
          : `Align organic search and UTM-tracked local channels with ${brand}'s ${offering}${targetCities.length ? ` in ${targetCities.join(', ')}` : ''}.`,
      whereTrafficComesFrom: facts.traffic?.channels.length
        ? facts.traffic.channels.map(
            (c) =>
              `${c.channel}: ${n(c.sessions)} sessions (${pct(c.share)})${c.engagementRate != null ? ` · ${pct(c.engagementRate)} engagement` : ''}`,
          )
        : ['Traffic channel breakdown will populate as GA4 records visitor sessions.'],
      channels: channelStrategies,
      audience: audienceInsights,
    },
    plan: [
      {
        week: 'Week 1',
        actions: [
          diag.conversionTracking.status !== 'ACTIVE'
            ? `Enable GA4 key events (${diag.conversionTracking.recommendedEvents.slice(0, 2).join(', ')}) and filter datacenter traffic.`
            : `Audit GA4 conversion funnel drop-offs on top landing pages.`,
          diag.attributionHealth.status === 'DARK_TRAFFIC_HIGH'
            ? `Apply UTM-tagged links across Google Business Profile, WhatsApp, and Instagram bio to shrink Direct dark traffic (${pct(diag.attributionHealth.directShare)}).`
            : `Optimize title tags and H1s on primary ${offering} commercial pages.`,
        ],
      },
      {
        week: 'Week 2',
        actions: [
          gaps[0]
            ? `Launch/upgrade dedicated local page & LocalBusiness JSON-LD (areaServed: "${gaps[0].location}") for ${offering} in ${gaps[0].location}.`
            : `Deploy LocalBusiness and Product/Service JSON-LD schema across commercial pages.`,
          facts.strikingDistance[0]
            ? `Expand on-page depth & internal links for "${facts.strikingDistance[0].key}" (pos ${pos(facts.strikingDistance[0].position)}) to reach top 3.`
            : `Add internal links from informational/blog pages to core commercial pages.`,
        ],
      },
      {
        week: 'Week 3',
        actions: [
          gaps[1]
            ? `Build localized landing copy, trust proof, and FAQ schema for ${offering} in ${gaps[1].location} via Content Studio.`
            : `Publish 2 grounded buyer-intent articles in Content Studio answering top local questions for ${offering}.`,
          facts.ctrOpportunities[0]
            ? `Upgrade title & meta snippet on ${facts.ctrOpportunities[0].key} to capture missed clicks.`
            : `Upgrade meta descriptions on 0-click impression pages and submit updated URLs in Search Console.`,
        ],
      },
      {
        week: 'Week 4',
        actions: [
          `Compare 28-day GSC local query clicks, GA4 key events, and clean non-datacenter city sessions.`,
          `Verify all deployed Fix Engine changes via re-crawl proof and lock your Monthly White-Label Report snapshot.`,
        ],
      },
    ],
    dataGaps: [
      ...facts.notMeasured,
      ...(diag.conversionTracking.status !== 'ACTIVE'
        ? [`GA4 Key Events are ${diag.conversionTracking.status === 'MISSING' ? 'not configured' : 'at 0'} — set up conversion events (${diag.conversionTracking.recommendedEvents.slice(0, 3).join(', ')}) to measure revenue/lead ROI.`]
        : []),
      ...(facts.traffic && facts.traffic.sources.length === 0
        ? ['Named GA4 source/medium breakdown is empty — run a GA4 refresh so exact referring sites and campaigns appear.']
        : []),
    ],
  };

  /* ── Ensure every critical measured opportunity is represented in Priorities (no silent drops!) ── */
  const priorities: PriorityItem[] = [...base.priorities];
  const hasTopic = (re: RegExp) => priorities.some((p) => re.test(`${p.title} ${p.evidence}`));

  // A. Target City Gaps — use word-boundary matching masking longer target cities so Mumbai is NEVER dropped when Navi Mumbai is present!
  const allLocNames = (facts.locationGaps ?? []).map((g) => g.location);
  for (const gap of gaps) {
    const alreadyCovered = priorities.some((p) => queryMatchesLocation(p.title, gap.location, allLocNames));
    if (!alreadyCovered) {
      priorities.push({
        rank: 0,
        title:
          gap.status === 'NO_CLICKS'
            ? `Capture local search clicks in ${gap.location} for ${offering} (0 clicks recorded)`
            : `Grow local search clicks in ${gap.location} for ${offering}`,
        platform: 'BOTH',
        priority: 'high',
        impact: 'high',
        effort: 'medium',
        evidence: gap.finding,
        whyItMatters: `Website Audit confirms you operate in ${gap.location}, so 0 search clicks means high-intent local buyers are finding competitors first.`,
        steps: gap.recommendedSteps,
        measureBy: `Search Console clicks for "${gap.location}" queries and non-datacenter GA4 sessions from ${gap.location}.`,
      });
    }
  }

  // B. GA4 Conversion Tracking (Key Events = 0 or missing)
  if (diag.conversionTracking.status !== 'ACTIVE' && sessions > 0 && !hasTopic(/key event|conversion tracking|conversion event/i)) {
    priorities.push({
      rank: 0,
      title: `Configure GA4 conversion tracking (Key Events) — currently ${diag.conversionTracking.keyEvents ?? 0} recorded`,
      platform: 'GA4',
      priority: 'high',
      impact: 'high',
      effort: 'low',
      evidence: diag.conversionTracking.diagnosis,
      whyItMatters: `Without GA4 Key Events, you can count visits (${n(sessions)} sessions) but cannot prove which keywords, pages, or cities generate real orders or leads.`,
      steps: [
        `In GA4 Admin → Events, mark core business actions as Key Events: ${diag.conversionTracking.recommendedEvents.join(', ')}.`,
        `Fire an event on your primary conversion CTA (subscription checkout, WhatsApp order click, or lead form submission).`,
        `Test with GA4 DebugView and confirm conversions attribute cleanly by channel and city.`,
      ],
      measureBy: 'GA4 Key Events count and per-channel conversion rate in Traffic.',
    });
  }

  // C. Bot/Datacenter Filtering & Direct Dark-Traffic Attribution
  if (
    (diag.botAndNoise.suspectedBotSessions >= 10 || diag.attributionHealth.status === 'DARK_TRAFFIC_HIGH') &&
    !hasTopic(/datacenter|council bluffs|utm|dark traffic|direct.*attribution/i)
  ) {
    priorities.push({
      rank: 0,
      title:
        diag.botAndNoise.suspectedBotSessions > 0
          ? `Filter datacenter noise (${diag.botAndNoise.suspectedBotCities[0]?.city}) & tag Direct dark traffic (${pct(diag.attributionHealth.directShare)})`
          : `Untangle Direct dark traffic (${pct(diag.attributionHealth.directShare)}) with UTM campaign links`,
      platform: 'GA4',
      priority: 'high',
      impact: 'high',
      effort: 'low',
      evidence: `${diag.attributionHealth.diagnosis} ${diag.botAndNoise.suspectedBotSessions > 0 ? diag.botAndNoise.diagnosis : ''}`.trim(),
      whyItMatters: `Clean attribution stops marketing spend and SEO decisions from being distorted by datacenter pings or untagged WhatsApp/Instagram/GBP visits.`,
      steps: [
        `Replace your Google Business Profile, WhatsApp, and Instagram bio URLs with the ready-to-copy UTM links in the Attribution Audit panel.`,
        ...(diag.botAndNoise.suspectedBotSessions > 0
          ? [`In GA4 Data Streams → Configure Tag Settings → Define Internal Traffic, exclude internal/monitoring IPs and monitor non-datacenter sessions separately.`]
          : []),
        `Verify redirects preserve ?utm_source and ?utm_medium query parameters across all entry pages.`,
      ],
      measureBy: 'Drop in Direct traffic share % and rise in properly attributed Organic Social / Local / Referral sessions.',
    });
  }

  // D. Striking-Distance Page-1 Push (Positions 4-20)
  if (facts.strikingDistance.length > 0 && !hasTopic(/striking|page 1|position [4-9]|position 1\d/i)) {
    const top3 = facts.strikingDistance.slice(0, 3);
    priorities.push({
      rank: 0,
      title: `Push "${top3[0].key}" (pos #${pos(top3[0].position)}) and ${Math.max(0, facts.strikingDistance.length - 1)} striking-distance queries into Top 3`,
      platform: 'GSC',
      priority: 'high',
      impact: 'high',
      effort: 'low',
      evidence: top3.map((q) => `"${q.key}" (pos ${pos(q.position)}, ${n(q.impressions)} imp, ${n(q.clicks)} clicks)`).join('; '),
      whyItMatters: `Queries ranking in positions 4–20 already have Google's trust — moving them into the top 3 typically delivers the fastest organic click growth without building new domain authority.`,
      steps: [
        `Upgrade the target landing page for "${top3[0].key}" with clear H2 sections answering buyer questions, pricing/delivery details, and FAQPage JSON-LD.`,
        `Add 3–5 descriptive internal links from your homepage and related pages pointing to the "${top3[0].key}" landing page.`,
        `Draft supporting local/buyer content in Reigel Content Studio and track position movement over the next 28 days.`,
      ],
      measureBy: `Average position moving below 5.0 and organic clicks rising for "${top3[0].key}" in Search Console.`,
    });
  }

  // E. CTR Snippet Opportunities
  if (facts.ctrOpportunities.length > 0 && !hasTopic(/ctr|click-through|snippet/i)) {
    const topCtr = facts.ctrOpportunities[0];
    priorities.push({
      rank: 0,
      title: `Upgrade search snippet CTR on ${topCtr.key} (${n(topCtr.impressions)} impressions at ${pct(topCtr.ctr)} CTR)`,
      platform: 'GSC',
      priority: 'high',
      impact: 'high',
      effort: 'low',
      evidence: `${topCtr.key}: ${n(topCtr.clicks)} clicks from ${n(topCtr.impressions)} impressions at position ${pos(topCtr.position)}${topCtr.extra ? ` (${topCtr.extra})` : ''}.`,
      whyItMatters: `You already earned visibility on Google — improving the title hook and meta description turns existing impressions into immediate free clicks.`,
      steps: [
        `Rewrite the <title> tag on ${topCtr.key} to lead with the exact buyer benefit, city coverage, and differentiator (50–60 chars).`,
        `Write an action-focused meta description with clear proof and next step (135–155 chars).`,
        `Deploy via Fix Engine (WordPress / Shopify / Webflow / GitHub) and re-check CTR after 14 days.`,
      ],
      measureBy: `Search Console CTR and clicks on ${topCtr.key}.`,
    });
  }

  // F. GSC Indexation Rescue
  if (facts.index && facts.index.indexableButNotIndexed > 0 && !hasTopic(/index|not indexed|crawl/i)) {
    priorities.push({
      rank: 0,
      title: `Fix ${facts.index.indexableButNotIndexed} indexable pages that Google has not indexed yet`,
      platform: 'GSC',
      priority: 'high',
      impact: 'high',
      effort: 'medium',
      evidence: `${facts.index.indexed} of ${facts.index.asked} checked pages are indexed; ${facts.index.indexableButNotIndexed} are allowed in search but not indexed (${facts.index.topReasons.map((r) => `${r.state}: ${r.count}`).join(', ') || 'crawled/discovered not indexed'}).`,
      whyItMatters: `Unindexed commercial pages cannot appear in Google Search or AI citations regardless of how good their copy is.`,
      steps: [
        `Inspect unindexed commercial URLs in Search Console and ensure every page is linked from primary navigation or internal hubs.`,
        `Verify self-referencing canonicals, XML sitemap inclusion, and unique non-thin copy (>400 words).`,
        `Submit priority URLs for indexing and monitor index coverage weekly.`,
      ],
      measureBy: `Indexed page count rising from ${facts.index.indexed}/${facts.index.asked} in Search Console.`,
    });
  }

  // G. Declining Query Defense
  if (facts.decliningQueries.length > 0 && !hasTopic(/declin|losing ground|drop/i)) {
    const d = facts.decliningQueries[0];
    priorities.push({
      rank: 0,
      title: `Defend declining query "${d.query}" (dropped #${pos(d.previousPosition)} → #${pos(d.currentPosition)})`,
      platform: 'GSC',
      priority: 'high',
      impact: 'medium',
      effort: 'low',
      evidence: `"${d.query}" moved from position ${pos(d.previousPosition)} (${d.previousClicks} clicks) to ${pos(d.currentPosition)} (${d.currentClicks} clicks).`,
      whyItMatters: `Recovering a page that previously ranked well is faster than ranking a brand-new URL from scratch.`,
      steps: [
        `Refresh the page answering "${d.query}" with updated proof, clearer headings, and structured FAQ schema.`,
        `Check Competitor Intelligence to see if a rival launched a fresher page targeting "${d.query}".`,
        `Add internal links from your highest-traffic landing pages and monitor weekly recovery.`,
      ],
      measureBy: `Position and weekly clicks recovering for "${d.query}" in Search Console.`,
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      rank: 1,
      title: `Improve Google search click-through rate and commercial keyword targeting for ${offering}`,
      platform: 'GSC',
      priority: 'high',
      impact: 'high',
      effort: 'low',
      evidence: `Search Console recorded ${n(clicks)} clicks from ${n(impressions)} impressions in the last ${facts.days} days.`,
      whyItMatters: `Aligning your page titles and descriptions with what buyers search for ${offering} turns existing impressions into qualified clicks.`,
      steps: [
        `Update the homepage and primary commercial page titles to name ${offering}${business?.primaryCity ? ` in ${business.primaryCity}` : ''}.`,
        'Write action-oriented meta descriptions with a clear value proposition and call to action.',
        'Request re-indexing in Google Search Console and monitor click growth.',
      ],
      measureBy: 'Organic clicks and average CTR in Google Search Console.',
    });
  }

  // Sort high priority -> high impact -> low effort first, then re-rank cleanly
  const ranked = priorities
    .sort(
      (a, b) =>
        LEVELS.indexOf(a.priority) - LEVELS.indexOf(b.priority) ||
        LEVELS.indexOf(a.impact) - LEVELS.indexOf(b.impact) ||
        LEVELS.indexOf(b.effort) - LEVELS.indexOf(a.effort),
    )
    .slice(0, 8)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const quickWins =
    base.quickWins.length > 0
      ? base.quickWins
      : [
          ...(diag.conversionTracking.status !== 'ACTIVE'
            ? [`Mark "${diag.conversionTracking.recommendedEvents[0]}" and "${diag.conversionTracking.recommendedEvents[1]}" as Key Events in GA4 Admin → Events.`]
            : []),
          ...(diag.attributionHealth.status === 'DARK_TRAFFIC_HIGH'
            ? [`Update your Google Business Profile and WhatsApp/Instagram links with the UTM-tagged URLs generated in the Attribution Audit panel.`]
            : []),
          ...(facts.strikingDistance[0]
            ? [`Optimize the title tag & opening paragraph for "${facts.strikingDistance[0].key}" (currently #${pos(facts.strikingDistance[0].position)}, ${n(facts.strikingDistance[0].impressions)} impressions).`]
            : []),
          ...(gaps[0]
            ? [`Add "${offering} in ${gaps[0].location}" to your primary landing page title, H1, and LocalBusiness areaServed JSON-LD on ${facts.site || 'your site'}.`]
            : [`Add LocalBusiness / Organization JSON-LD schema with areaServed on ${facts.site || 'your homepage'}.`]),
          `Add clear internal links from your top GA4 landing page (${facts.traffic?.landingPages[0]?.page || '/'}) straight to your core ${offering} conversion page.`,
        ].slice(0, 5);

  return {
    ...base,
    priorities: ranked,
    quickWins,
  };
}
