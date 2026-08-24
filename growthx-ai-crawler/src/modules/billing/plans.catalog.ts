import { PlanType, UsageMetric } from '@prisma/client';

/**
 * Capabilities a plan can unlock. Adding a feature here and forgetting to grant
 * it in PLAN_CATALOG means it is denied by default, which is the safe direction.
 */
export enum Feature {
  /** Run website crawls and read the technical SEO audit. */
  CRAWL = 'CRAWL',
  /** Scheduled / recurring re-crawls rather than manual only. */
  SCHEDULED_CRAWLS = 'SCHEDULED_CRAWLS',

  /** AI explanation of each issue: why it matters, SEO + business impact. */
  AI_RECOMMENDATIONS = 'AI_RECOMMENDATIONS',
  MODEL_GEMINI = 'MODEL_GEMINI',
  MODEL_GPT = 'MODEL_GPT',
  MODEL_CLAUDE = 'MODEL_CLAUDE',
  /** Groq-hosted Llama 3.1 8B Instant — fast, cost-efficient fallback available on all plans. */
  MODEL_GROQ = 'MODEL_GROQ',
  /** OpenRouter — routes to whichever free/low-cost model is configured; available on all plans. */
  MODEL_OPENROUTER = 'MODEL_OPENROUTER',
  /** Sarvam AI — Indian-language-first models, served from India; available on all plans. */
  MODEL_SARVAM = 'MODEL_SARVAM',

  /** Generate a concrete code/content patch for an issue. */
  AUTO_FIX_PATCH = 'AUTO_FIX_PATCH',
  /** Push that patch to the customer's repo as a pull request. */
  AUTO_FIX_DEPLOY = 'AUTO_FIX_DEPLOY',

  /** Track whether assistants cite the customer's domain (AEO / GEO). */
  AI_VISIBILITY = 'AI_VISIBILITY',
  COMPETITOR_TRACKING = 'COMPETITOR_TRACKING',

  /** Market analysis + SEO / social media strategy generation. */
  MARKET_STRATEGY = 'MARKET_STRATEGY',

  WHITE_LABEL_REPORTS = 'WHITE_LABEL_REPORTS',
  API_ACCESS = 'API_ACCESS',
}

/** `null` means unlimited. */
export type QuotaLimits = Record<UsageMetric, number | null>;

export interface PlanDefinition {
  plan: PlanType;
  name: string;
  /** Price in paise. Razorpay works in the smallest currency unit. */
  amountPaise: number;
  currency: 'INR';
  interval: 'monthly';
  /** Marketing blurb shown on the pricing page. */
  tagline: string;
  /** Hard cap on how many websites the org may register. */
  maxSites: number | null;
  maxSeats: number | null;
  features: ReadonlySet<Feature>;
  quotas: QuotaLimits;
}

const noQuota: QuotaLimits = {
  CRAWL_PAGES: 0,
  AI_ANALYSES: 0,
  AUTO_FIXES: 0,
  AI_VISIBILITY_CHECKS: 0,
  STRATEGY_REPORTS: 0,
};

export const PLAN_CATALOG: Readonly<Record<PlanType, PlanDefinition>> = Object.freeze({
  [PlanType.FREE]: {
    plan: PlanType.FREE,
    name: 'Free audit',
    amountPaise: 0,
    currency: 'INR',
    interval: 'monthly',
    tagline: 'One-off crawl of a single site so you can see what is broken.',
    maxSites: 1,
    maxSeats: 1,
    features: new Set([Feature.CRAWL]),
    quotas: { ...noQuota, CRAWL_PAGES: 100 },
  },

  // The INR 1,999 tier: crawl the site and tell them, using Gemini, what to
  // fix. Basic competitor visibility, no code shipped, no market/strategy work.
  [PlanType.STARTER]: {
    plan: PlanType.STARTER,
    name: 'Starter',
    amountPaise: 199_900,
    currency: 'INR',
    interval: 'monthly',
    tagline: 'Technical SEO crawl, weekly re-crawls, basic competitor visibility, and Gemini fix suggestions.',
    maxSites: 1,
    maxSeats: 2,
    features: new Set([
      Feature.CRAWL,
      Feature.SCHEDULED_CRAWLS,
      Feature.AI_RECOMMENDATIONS,
      Feature.MODEL_GEMINI,
      Feature.MODEL_GROQ,
      Feature.MODEL_OPENROUTER,
      Feature.MODEL_SARVAM,
      Feature.COMPETITOR_TRACKING,
    ]),
    quotas: {
      ...noQuota,
      CRAWL_PAGES: 5_000,
      AI_ANALYSES: 200,
    },
  },

  // The INR 4,999 tier: daily crawls, GPT added, AI-assistant citation
  // tracking, and the market/strategy/content-plan engine. Still no code
  // shipped to the customer's repo — that starts at Pro.
  [PlanType.GROWTH]: {
    plan: PlanType.GROWTH,
    name: 'Growth',
    amountPaise: 499_900,
    currency: 'INR',
    interval: 'monthly',
    tagline:
      'Everything in Starter, plus daily crawls, GPT, advanced competitor analysis, market intelligence, and a full marketing & content strategy.',
    maxSites: 3,
    maxSeats: 3,
    features: new Set([
      Feature.CRAWL,
      Feature.SCHEDULED_CRAWLS,
      Feature.AI_RECOMMENDATIONS,
      Feature.MODEL_GEMINI,
      Feature.MODEL_GPT,
      Feature.MODEL_GROQ,
      Feature.MODEL_OPENROUTER,
      Feature.MODEL_SARVAM,
      Feature.COMPETITOR_TRACKING,
      Feature.AI_VISIBILITY,
      Feature.MARKET_STRATEGY,
    ]),
    quotas: {
      ...noQuota,
      CRAWL_PAGES: 15_000,
      AI_ANALYSES: 600,
      AI_VISIBILITY_CHECKS: 1_500,
      STRATEGY_REPORTS: 2,
    },
  },

  // The INR 6,999 tier: everything above, plus Claude, repository analysis,
  // automated fix patches shipped as pull requests, and API access.
  [PlanType.PRO]: {
    plan: PlanType.PRO,
    name: 'Pro',
    amountPaise: 699_900,
    currency: 'INR',
    interval: 'monthly',
    tagline:
      'Everything in Growth, plus Claude, repository analysis, AI-generated pull requests, team collaboration, and API access.',
    maxSites: 5,
    maxSeats: 5,
    features: new Set([
      Feature.CRAWL,
      Feature.SCHEDULED_CRAWLS,
      Feature.AI_RECOMMENDATIONS,
      Feature.MODEL_GEMINI,
      Feature.MODEL_GPT,
      Feature.MODEL_CLAUDE,
      Feature.MODEL_GROQ,
      Feature.MODEL_OPENROUTER,
      Feature.MODEL_SARVAM,
      Feature.COMPETITOR_TRACKING,
      Feature.AI_VISIBILITY,
      Feature.MARKET_STRATEGY,
      Feature.AUTO_FIX_PATCH,
      Feature.AUTO_FIX_DEPLOY,
      Feature.API_ACCESS,
    ]),
    quotas: {
      CRAWL_PAGES: 25_000,
      AI_ANALYSES: 1_000,
      AUTO_FIXES: 50,
      AI_VISIBILITY_CHECKS: 3_000,
      STRATEGY_REPORTS: 4,
    },
  },

  [PlanType.ENTERPRISE]: {
    plan: PlanType.ENTERPRISE,
    name: 'Enterprise',
    amountPaise: 0, // negotiated; ~₹75,000+/month modelled, provisioned manually
    currency: 'INR',
    interval: 'monthly',
    tagline: 'Unlimited projects, distributed crawling, white-label reporting, dedicated infrastructure, SSO, and priority support.',
    maxSites: null,
    maxSeats: null,
    features: new Set(Object.values(Feature)),
    quotas: {
      CRAWL_PAGES: null,
      AI_ANALYSES: null,
      AUTO_FIXES: null,
      AI_VISIBILITY_CHECKS: null,
      STRATEGY_REPORTS: null,
    },
  },
});

/** Plans a customer can buy themselves, cheapest first. */
export const SELF_SERVE_PLANS: readonly PlanType[] = [PlanType.STARTER, PlanType.GROWTH, PlanType.PRO];

export function getPlan(plan: PlanType): PlanDefinition {
  return PLAN_CATALOG[plan];
}

export function planHasFeature(plan: PlanType, feature: Feature): boolean {
  return PLAN_CATALOG[plan].features.has(feature);
}

export function quotaFor(plan: PlanType, metric: UsageMetric): number | null {
  return PLAN_CATALOG[plan].quotas[metric];
}

/** Cheapest self-serve plan that includes `feature`, for upgrade prompts. */
export function cheapestPlanWith(feature: Feature): PlanDefinition | null {
  for (const plan of SELF_SERVE_PLANS) {
    if (planHasFeature(plan, feature)) return PLAN_CATALOG[plan];
  }
  return null;
}

export function formatInr(amountPaise: number): string {
  return `₹${(amountPaise / 100).toLocaleString('en-IN')}`;
}
