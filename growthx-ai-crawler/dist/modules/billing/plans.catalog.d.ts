import { PlanType, UsageMetric } from '@prisma/client';
/**
 * Capabilities a plan can unlock. Adding a feature here and forgetting to grant
 * it in PLAN_CATALOG means it is denied by default, which is the safe direction.
 */
export declare enum Feature {
    /** Run website crawls and read the technical SEO audit. */
    CRAWL = "CRAWL",
    /** Scheduled / recurring re-crawls rather than manual only. */
    SCHEDULED_CRAWLS = "SCHEDULED_CRAWLS",
    /** AI explanation of each issue: why it matters, SEO + business impact. */
    AI_RECOMMENDATIONS = "AI_RECOMMENDATIONS",
    MODEL_GEMINI = "MODEL_GEMINI",
    MODEL_GPT = "MODEL_GPT",
    MODEL_CLAUDE = "MODEL_CLAUDE",
    /** Generate a concrete code/content patch for an issue. */
    AUTO_FIX_PATCH = "AUTO_FIX_PATCH",
    /** Push that patch to the customer's repo as a pull request. */
    AUTO_FIX_DEPLOY = "AUTO_FIX_DEPLOY",
    /** Track whether assistants cite the customer's domain (AEO / GEO). */
    AI_VISIBILITY = "AI_VISIBILITY",
    COMPETITOR_TRACKING = "COMPETITOR_TRACKING",
    /** Market analysis + SEO / social media strategy generation. */
    MARKET_STRATEGY = "MARKET_STRATEGY",
    WHITE_LABEL_REPORTS = "WHITE_LABEL_REPORTS",
    API_ACCESS = "API_ACCESS"
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
export declare const PLAN_CATALOG: Readonly<Record<PlanType, PlanDefinition>>;
/** Plans a customer can buy themselves, cheapest first. */
export declare const SELF_SERVE_PLANS: readonly PlanType[];
export declare function getPlan(plan: PlanType): PlanDefinition;
export declare function planHasFeature(plan: PlanType, feature: Feature): boolean;
export declare function quotaFor(plan: PlanType, metric: UsageMetric): number | null;
/** Cheapest self-serve plan that includes `feature`, for upgrade prompts. */
export declare function cheapestPlanWith(feature: Feature): PlanDefinition | null;
export declare function formatInr(amountPaise: number): string;
