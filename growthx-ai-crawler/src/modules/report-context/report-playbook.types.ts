/**
 * Shared business-grounded 7-layer report schema, prompt builder, normalizer,
 * and deterministic fallback engine used across all four Reigel intelligence
 * reports: Website Audit, Traffic & Organic Growth, Competitor Intelligence,
 * and AI Visibility.
 */

export type ReportKind = 'audit' | 'traffic' | 'competitor' | 'ai-visibility';

export interface CatalogHighlight {
  name: string;
  price: string | null;
  stock: string | null;
  url: string;
}

export interface LocalPresenceSummary {
  rating: number | null;
  reviewCount: number | null;
  address: string | null;
  businessName: string | null;
}

export interface CrossModuleSnapshot {
  auditHealthScore: number | null;
  pagesAudited: number;
  openHighIssues: number;
  aiCitationSharePct: number | null;
  rivalCount: number;
}

/**
 * Shared business & hyper-local dossier injected into every report so each
 * report speaks the exact language of the customer's industry, offerings,
 * service areas, micro-localities, and local trust signals.
 */
export interface BusinessContextSummary {
  businessName: string;
  domain: string | null;
  industry: string | null;
  businessModel: string | null;
  summary: string | null;
  targetAudience: string | null;
  businessGoal: string | null;
  offerings: string[];
  primaryCity: string | null;
  state: string | null;
  country: string | null;
  /** Target cities and service regions detected from profile + crawl. */
  serviceAreas: string[];
  /** Micro-areas / neighborhoods already covered by a dedicated crawled page. */
  coveredAreas: string[];
  /** High-demand sibling neighborhoods in the same city with no dedicated page yet. */
  missingAreas: string[];
  /** Commercial pages read on the site (excluding cart/login/legal utility pages). */
  keyPages: Array<{ path: string; title: string; pageType: string }>;
  catalogHighlights: CatalogHighlight[];
  trustSignals: string[];
  localPresence: LocalPresenceSummary | null;
  crossModuleSnapshot: CrossModuleSnapshot;
}

export type ScenarioTier = 'conservative' | 'realistic' | 'aggressive';

export interface PossibilityScenario {
  tier: ScenarioTier;
  timeframe: string;
  headline: string;
  expectedOutcome: string;
  assumptions: string[];
  unlocksBy: string[];
}

export type GrowthMethodCategory =
  | 'TECHNICAL'
  | 'HYPER_LOCAL'
  | 'CONTENT'
  | 'CONVERSION'
  | 'OFF_SITE_AUTHORITY'
  | 'AI_CITATIONS'
  | 'ANALYTICS';

export interface GrowthMethodPlaybook {
  category: GrowthMethodCategory;
  title: string;
  objective: string;
  whyForThisBusiness: string;
  howToApply: string[];
  owner: 'you' | 'developer' | 'both';
  effort: 'low' | 'medium' | 'high';
  expectedImpact: 'high' | 'medium' | 'low';
  verifyWith: string;
}

export type ReadyAssetKind =
  | 'TITLE_META'
  | 'LANDING_PAGE_BRIEF'
  | 'FAQ_BLOCK'
  | 'AI_QUOTABLE_SUMMARY'
  | 'GBP_POST'
  | 'SCHEMA_SNIPPET'
  | 'CONVERSION_CTA'
  | 'OUTREACH_TEMPLATE';

export interface ReadyToUseAsset {
  kind: ReadyAssetKind;
  title: string;
  targetUrlOrChannel: string;
  copyText: string;
  usageNote: string;
}

export interface RoadmapMilestone {
  phase: string;
  goal: string;
  ownerTasks: string[];
  developerTasks: string[];
  kpiTarget: string;
}

export interface ReportGrowthPlaybook {
  /** 2-3 sentences explaining the winning angle tailored to this exact business & market. */
  businessAngle: string;
  /** 3 transparent possibility scenarios: conservative (30d), realistic (60d), aggressive (90d). */
  possibilities: PossibilityScenario[];
  /** Concrete methods & playbooks across technical, hyper-local, content, conversion & off-site levers. */
  methods: GrowthMethodPlaybook[];
  /** Copy-paste-ready rewrites, page briefs, FAQ blocks, GBP posts, and AI-quotable summaries. */
  readyToUseAssets: ReadyToUseAsset[];
  /** 30 / 60 / 90-day step-by-step roadmap splitting Owner vs. Developer tasks. */
  roadmap90Day: RoadmapMilestone[];
}

/* ─────────────────────────── Normalization Helpers ─────────────────────────── */

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const strList = (v: unknown, max = 8): string[] =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => str(x)).filter(Boolean))].slice(0, max)
    : [];
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

const VALID_TIERS: ScenarioTier[] = ['conservative', 'realistic', 'aggressive'];
const VALID_CATEGORIES = new Set<GrowthMethodCategory>([
  'TECHNICAL',
  'HYPER_LOCAL',
  'CONTENT',
  'CONVERSION',
  'OFF_SITE_AUTHORITY',
  'AI_CITATIONS',
  'ANALYTICS',
]);
const VALID_ASSET_KINDS = new Set<ReadyAssetKind>([
  'TITLE_META',
  'LANDING_PAGE_BRIEF',
  'FAQ_BLOCK',
  'AI_QUOTABLE_SUMMARY',
  'GBP_POST',
  'SCHEMA_SNIPPET',
  'CONVERSION_CTA',
  'OUTREACH_TEMPLATE',
]);

function normLevel(v: unknown, fallback: 'high' | 'medium' | 'low' = 'medium'): 'high' | 'medium' | 'low' {
  const s = str(v).toLowerCase();
  if (s === 'critical' || s === 'high') return 'high';
  if (s === 'low') return 'low';
  if (s === 'medium') return 'medium';
  return fallback;
}

function normOwner(v: unknown): 'you' | 'developer' | 'both' {
  const s = str(v).toLowerCase();
  if (s.includes('both') || (s.includes('you') && s.includes('dev'))) return 'both';
  if (s.includes('dev')) return 'developer';
  return 'you';
}

function normCategory(v: unknown): GrowthMethodCategory {
  const s = str(v).toUpperCase().replace(/[\s-]+/g, '_');
  if (VALID_CATEGORIES.has(s as GrowthMethodCategory)) return s as GrowthMethodCategory;
  if (s.includes('LOCAL') || s.includes('GEO') || s.includes('MAP')) return 'HYPER_LOCAL';
  if (s.includes('CONV') || s.includes('CRO') || s.includes('CTA')) return 'CONVERSION';
  if (s.includes('OFF') || s.includes('AUTH') || s.includes('LINK') || s.includes('REVIEW')) return 'OFF_SITE_AUTHORITY';
  if (s.includes('AI') || s.includes('CIT')) return 'AI_CITATIONS';
  if (s.includes('ANALYT') || s.includes('TRACK') || s.includes('UTM')) return 'ANALYTICS';
  if (s.includes('TECH') || s.includes('SPEED') || s.includes('SCHEMA')) return 'TECHNICAL';
  return 'CONTENT';
}

function normAssetKind(v: unknown): ReadyAssetKind {
  const s = str(v).toUpperCase().replace(/[\s-]+/g, '_');
  if (VALID_ASSET_KINDS.has(s as ReadyAssetKind)) return s as ReadyAssetKind;
  if (s.includes('TITLE') || s.includes('META')) return 'TITLE_META';
  if (s.includes('FAQ')) return 'FAQ_BLOCK';
  if (s.includes('AI') || s.includes('QUOT')) return 'AI_QUOTABLE_SUMMARY';
  if (s.includes('GBP') || s.includes('MAP') || s.includes('POST')) return 'GBP_POST';
  if (s.includes('SCHEMA') || s.includes('JSON')) return 'SCHEMA_SNIPPET';
  if (s.includes('CTA') || s.includes('CONV')) return 'CONVERSION_CTA';
  if (s.includes('OUTREACH') || s.includes('REVIEW') || s.includes('EMAIL')) return 'OUTREACH_TEMPLATE';
  return 'LANDING_PAGE_BRIEF';
}

export function normalisePlaybook(raw: unknown): ReportGrowthPlaybook | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;

  const possibilities: PossibilityScenario[] = arr(r.possibilities)
    .map((p, idx): PossibilityScenario => {
      const tierRaw = str(p?.tier).toLowerCase() as ScenarioTier;
      const tier = VALID_TIERS.includes(tierRaw) ? tierRaw : VALID_TIERS[Math.min(idx, 2)];
      return {
        tier,
        timeframe: str(p?.timeframe, tier === 'conservative' ? '30 days' : tier === 'realistic' ? '60 days' : '90 days'),
        headline: str(p?.headline),
        expectedOutcome: str(p?.expectedOutcome),
        assumptions: strList(p?.assumptions, 4),
        unlocksBy: strList(p?.unlocksBy, 4),
      };
    })
    .filter((p) => p.headline && p.expectedOutcome)
    .slice(0, 3);

  const methods: GrowthMethodPlaybook[] = arr(r.methods)
    .map((m): GrowthMethodPlaybook => ({
      category: normCategory(m?.category),
      title: str(m?.title),
      objective: str(m?.objective),
      whyForThisBusiness: str(m?.whyForThisBusiness),
      howToApply: strList(m?.howToApply, 6),
      owner: normOwner(m?.owner),
      effort: normLevel(m?.effort, 'medium'),
      expectedImpact: normLevel(m?.expectedImpact, 'high'),
      verifyWith: str(m?.verifyWith),
    }))
    .filter((m) => m.title && m.howToApply.length > 0)
    .slice(0, 6);

  const readyToUseAssets: ReadyToUseAsset[] = arr(r.readyToUseAssets)
    .map((a): ReadyToUseAsset => ({
      kind: normAssetKind(a?.kind),
      title: str(a?.title),
      targetUrlOrChannel: str(a?.targetUrlOrChannel, 'Website'),
      copyText: str(a?.copyText),
      usageNote: str(a?.usageNote),
    }))
    .filter((a) => a.title && a.copyText)
    .slice(0, 6);

  const roadmap90Day: RoadmapMilestone[] = arr(r.roadmap90Day)
    .map((m, idx): RoadmapMilestone => ({
      phase: str(
        m?.phase,
        idx === 0
          ? 'Days 1–30 · Foundation & Quick Wins'
          : idx === 1
            ? 'Days 31–60 · Local Expansion & Authority'
            : 'Days 61–90 · Scale & Compounding',
      ),
      goal: str(m?.goal),
      ownerTasks: strList(m?.ownerTasks, 5),
      developerTasks: strList(m?.developerTasks, 5),
      kpiTarget: str(m?.kpiTarget),
    }))
    .filter((m) => m.goal || m.ownerTasks.length > 0 || m.developerTasks.length > 0)
    .slice(0, 3);

  const businessAngle = str(r.businessAngle);
  if (!businessAngle && !possibilities.length && !methods.length && !readyToUseAssets.length && !roadmap90Day.length) {
    return undefined;
  }

  return {
    businessAngle,
    possibilities,
    methods,
    readyToUseAssets,
    roadmap90Day,
  };
}

/* ─────────────────────────── Shared Prompt Formatting ─────────────────────────── */

export function formatBusinessContextForPrompt(ctx: BusinessContextSummary | null | undefined): string {
  if (!ctx) return '';
  const lines: string[] = [
    'BUSINESS & HYPER-LOCAL MARKET CONTEXT',
    `  business: ${ctx.businessName}${ctx.domain ? ` (${ctx.domain})` : ''}`,
  ];
  if (ctx.industry) lines.push(`  industry: ${ctx.industry}`);
  if (ctx.businessModel) lines.push(`  business model: ${ctx.businessModel}`);
  if (ctx.summary) lines.push(`  what they sell: ${ctx.summary}`);
  if (ctx.targetAudience) lines.push(`  target buyers: ${ctx.targetAudience}`);
  if (ctx.businessGoal) lines.push(`  owner goal: ${ctx.businessGoal}`);
  if (ctx.offerings.length) lines.push(`  core products/offerings: ${ctx.offerings.join(', ')}`);
  const geo = [ctx.primaryCity, ctx.state, ctx.country].filter(Boolean).join(', ');
  if (geo) lines.push(`  primary location: ${geo}`);
  if (ctx.serviceAreas.length) lines.push(`  service areas detected: ${ctx.serviceAreas.join(', ')}`);
  if (ctx.coveredAreas.length) {
    lines.push(`  neighborhoods/micro-areas already covered by pages: ${ctx.coveredAreas.join(', ')}`);
  }
  if (ctx.missingAreas.length) {
    lines.push(`  high-demand nearby neighborhoods with NO dedicated page yet: ${ctx.missingAreas.join(', ')}`);
  }
  if (ctx.catalogHighlights.length) {
    lines.push(
      `  catalog items detected: ${ctx.catalogHighlights
        .slice(0, 8)
        .map((c) => `${c.name}${c.price ? ` (${c.price})` : ''}`)
        .join('; ')}`,
    );
  }
  if (ctx.trustSignals.length) {
    lines.push(`  existing trust/offer signals on site: ${ctx.trustSignals.slice(0, 6).join('; ')}`);
  }
  if (ctx.localPresence) {
    const lp = ctx.localPresence;
    lines.push(
      `  Google Maps / Local listing: ${lp.rating != null ? `${lp.rating}★` : 'rating not measured'}` +
        `${lp.reviewCount != null ? ` from ${lp.reviewCount} reviews` : ''}` +
        `${lp.address ? ` (${lp.address})` : ''}`,
    );
  }
  const xm = ctx.crossModuleSnapshot;
  const crossBits: string[] = [];
  if (xm.auditHealthScore != null) crossBits.push(`audit health ${xm.auditHealthScore}/100 across ${xm.pagesAudited} pages`);
  if (xm.openHighIssues > 0) crossBits.push(`${xm.openHighIssues} urgent/high audit issues`);
  if (xm.aiCitationSharePct != null) crossBits.push(`AI citation share ${xm.aiCitationSharePct}%`);
  if (xm.rivalCount > 0) crossBits.push(`${xm.rivalCount} tracked rivals`);
  if (crossBits.length) lines.push(`  cross-platform signals: ${crossBits.join('; ')}`);
  if (ctx.keyPages.length) {
    lines.push(
      `  key commercial pages: ${ctx.keyPages
        .slice(0, 10)
        .map((p) => `${p.path} (${p.title})`)
        .join('; ')}`,
    );
  }
  return `\n${lines.join('\n')}\n`;
}

export function buildPlaybookSchemaSnippet(kind: ReportKind): string {
  const focusByKind: Record<ReportKind, string> = {
    audit:
      'technical speed/indexability, hyper-local neighborhood landing pages for missing areas, product/LocalBusiness schema, and mobile buyer conversion proof (pricing, delivery times, trust badges, WhatsApp/trial CTA)',
    traffic:
      'capturing striking-distance Google queries, fixing CTR snippets, launching missing neighborhood pages, untangling Direct dark traffic with UTMs, Google Business Profile Maps calls/reviews, and GA4 key event conversion tracking',
    competitor:
      'outmaneuvering national & local rivals via hyper-local neighborhood dominance, offer/pricing/trust differentiation, counter-attack pages for missing rival topics, FAQ/Product schema parity, and local Google review velocity',
    'ai-visibility':
      'winning ChatGPT/Gemini/Perplexity local buyer recommendations via AI-quotable answer blocks, direct FAQ answers for missed questions, LocalBusiness/Product/FAQ schema, and off-site local entity citations (Google Maps reviews, Justdial, Sulekha, IndiaMART, Reddit/local community mentions)',
  };

  return `"playbook": {
    "businessAngle": "2-3 sentences tailoring the entire strategy to this exact business, its real products/offerings, and its city/neighborhoods — explain the unfair advantage it can build.",
    "possibilities": [
      {
        "tier": "conservative",
        "timeframe": "30 days",
        "headline": "What unlocking quick wins achieves",
        "expectedOutcome": "Honest, transparent expectation grounded ONLY in the measured numbers and gaps above (NEVER invent fake revenue guarantees; clearly distinguish measured baseline from directional potential)",
        "assumptions": ["concrete prerequisite 1", "prerequisite 2"],
        "unlocksBy": ["specific lever 1", "specific lever 2"]
      },
      { "tier": "realistic", "timeframe": "60 days", "headline": "...", "expectedOutcome": "...", "assumptions": ["..."], "unlocksBy": ["..."] },
      { "tier": "aggressive", "timeframe": "90 days", "headline": "...", "expectedOutcome": "...", "assumptions": ["..."], "unlocksBy": ["..."] }
    ],
    "methods": [
      {
        "category": "TECHNICAL | HYPER_LOCAL | CONTENT | CONVERSION | OFF_SITE_AUTHORITY | AI_CITATIONS | ANALYTICS",
        "title": "Actionable method name tailored to this business",
        "objective": "Clear goal in 1 sentence",
        "whyForThisBusiness": "Specifically why this method works for this industry, products, and city/micro-areas",
        "howToApply": ["concrete step 1", "concrete step 2", "concrete step 3", "concrete step 4"],
        "owner": "you | developer | both",
        "effort": "low | medium | high",
        "expectedImpact": "high | medium | low",
        "verifyWith": "Exact metric or tool to verify success"
      }
    ],
    "readyToUseAssets": [
      {
        "kind": "TITLE_META | LANDING_PAGE_BRIEF | FAQ_BLOCK | AI_QUOTABLE_SUMMARY | GBP_POST | SCHEMA_SNIPPET | CONVERSION_CTA | OUTREACH_TEMPLATE",
        "title": "Descriptive title naming the exact page, missing neighborhood, or channel",
        "targetUrlOrChannel": "Exact URL path (e.g. /service-neighborhood-slug) or channel (e.g. Google Business Profile)",
        "copyText": "COMPLETE ready-to-paste copy/outline/FAQ/post written specifically for this business's real products and city — never generic placeholders",
        "usageNote": "Where and how to publish this today"
      }
    ],
    "roadmap90Day": [
      {
        "phase": "Days 1–30 · Foundation & Quick Wins",
        "goal": "Primary milestone outcome",
        "ownerTasks": ["business-owner task 1", "business-owner task 2"],
        "developerTasks": ["developer task 1", "developer task 2"],
        "kpiTarget": "Measurable checkpoint at Day 30"
      },
      { "phase": "Days 31–60 · Local Expansion & Authority", "goal": "...", "ownerTasks": ["..."], "developerTasks": ["..."], "kpiTarget": "..." },
      { "phase": "Days 61–90 · Scale & Compounding", "goal": "...", "ownerTasks": ["..."], "developerTasks": ["..."], "kpiTarget": "..." }
    ]
  }

Playbook requirements (MANDATORY):
- Tailor EVERY method, copy-paste asset, and roadmap task to this business's actual offerings, city, and micro-areas (focus on: ${focusByKind[kind]}).
- When a primary city/region is present in BUSINESS & HYPER-LOCAL MARKET CONTEXT, compare already-covered areas against major adjacent high-demand neighborhoods/sub-areas of that city (including any missing areas listed from competitor coverage) and include concrete hyper-local landing page briefs and local authority actions for uncovered neighborhoods.
- Include 3 possibilities (conservative 30d, realistic 60d, aggressive 90d), 4–5 distinct methods across multiple categories, 3–5 genuinely ready-to-paste assets (actual titles/descriptions, missing-area page outlines, FAQ answers, or GBP posts), and a 3-phase 90-day roadmap splitting ownerTasks vs developerTasks.
- Ground all numbers strictly in the provided facts; where baseline metrics are missing, state directional possibilities and transparent assumptions without fabricating traffic/revenue numbers.`;
}
