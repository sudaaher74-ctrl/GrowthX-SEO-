"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELF_SERVE_PLANS = exports.PLAN_CATALOG = exports.Feature = void 0;
exports.getPlan = getPlan;
exports.planHasFeature = planHasFeature;
exports.quotaFor = quotaFor;
exports.cheapestPlanWith = cheapestPlanWith;
exports.formatInr = formatInr;
const client_1 = require("@prisma/client");
/**
 * Capabilities a plan can unlock. Adding a feature here and forgetting to grant
 * it in PLAN_CATALOG means it is denied by default, which is the safe direction.
 */
var Feature;
(function (Feature) {
    /** Run website crawls and read the technical SEO audit. */
    Feature["CRAWL"] = "CRAWL";
    /** Scheduled / recurring re-crawls rather than manual only. */
    Feature["SCHEDULED_CRAWLS"] = "SCHEDULED_CRAWLS";
    /** AI explanation of each issue: why it matters, SEO + business impact. */
    Feature["AI_RECOMMENDATIONS"] = "AI_RECOMMENDATIONS";
    Feature["MODEL_GEMINI"] = "MODEL_GEMINI";
    Feature["MODEL_GPT"] = "MODEL_GPT";
    Feature["MODEL_CLAUDE"] = "MODEL_CLAUDE";
    /** Generate a concrete code/content patch for an issue. */
    Feature["AUTO_FIX_PATCH"] = "AUTO_FIX_PATCH";
    /** Push that patch to the customer's repo as a pull request. */
    Feature["AUTO_FIX_DEPLOY"] = "AUTO_FIX_DEPLOY";
    /** Track whether assistants cite the customer's domain (AEO / GEO). */
    Feature["AI_VISIBILITY"] = "AI_VISIBILITY";
    Feature["COMPETITOR_TRACKING"] = "COMPETITOR_TRACKING";
    /** Market analysis + SEO / social media strategy generation. */
    Feature["MARKET_STRATEGY"] = "MARKET_STRATEGY";
    Feature["WHITE_LABEL_REPORTS"] = "WHITE_LABEL_REPORTS";
    Feature["API_ACCESS"] = "API_ACCESS";
})(Feature || (exports.Feature = Feature = {}));
const noQuota = {
    CRAWL_PAGES: 0,
    AI_ANALYSES: 0,
    AUTO_FIXES: 0,
    AI_VISIBILITY_CHECKS: 0,
    STRATEGY_REPORTS: 0,
};
exports.PLAN_CATALOG = Object.freeze({
    [client_1.PlanType.FREE]: {
        plan: client_1.PlanType.FREE,
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
    // The INR 2,000 tier: crawl the site and tell them, using Gemini, what to fix.
    // No code is written or shipped on this plan.
    [client_1.PlanType.STARTER]: {
        plan: client_1.PlanType.STARTER,
        name: 'Starter',
        amountPaise: 200_000,
        currency: 'INR',
        interval: 'monthly',
        tagline: 'Full website crawl plus Gemini recommendations on what to improve.',
        maxSites: 1,
        maxSeats: 2,
        features: new Set([
            Feature.CRAWL,
            Feature.SCHEDULED_CRAWLS,
            Feature.AI_RECOMMENDATIONS,
            Feature.MODEL_GEMINI,
        ]),
        quotas: {
            ...noQuota,
            CRAWL_PAGES: 5_000,
            AI_ANALYSES: 200,
        },
    },
    // The INR 5,000 tier: everything above, plus GPT and Claude, patches shipped
    // as pull requests, AI-assistant citation tracking, and strategy generation.
    [client_1.PlanType.PRO]: {
        plan: client_1.PlanType.PRO,
        name: 'Pro',
        amountPaise: 500_000,
        currency: 'INR',
        interval: 'monthly',
        tagline: 'Everything in Starter, plus Claude and GPT, automated fix pull requests, AI-assistant visibility tracking, and market strategy.',
        maxSites: 3,
        maxSeats: 5,
        features: new Set([
            Feature.CRAWL,
            Feature.SCHEDULED_CRAWLS,
            Feature.AI_RECOMMENDATIONS,
            Feature.MODEL_GEMINI,
            Feature.MODEL_GPT,
            Feature.MODEL_CLAUDE,
            Feature.AUTO_FIX_PATCH,
            Feature.AUTO_FIX_DEPLOY,
            Feature.AI_VISIBILITY,
            Feature.COMPETITOR_TRACKING,
            Feature.MARKET_STRATEGY,
        ]),
        quotas: {
            CRAWL_PAGES: 25_000,
            AI_ANALYSES: 1_000,
            AUTO_FIXES: 50,
            AI_VISIBILITY_CHECKS: 3_000,
            STRATEGY_REPORTS: 4,
        },
    },
    [client_1.PlanType.ENTERPRISE]: {
        plan: client_1.PlanType.ENTERPRISE,
        name: 'Enterprise',
        amountPaise: 0, // negotiated; provisioned manually
        currency: 'INR',
        interval: 'monthly',
        tagline: 'Unlimited sites, white-label reporting, and API access.',
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
exports.SELF_SERVE_PLANS = [client_1.PlanType.STARTER, client_1.PlanType.PRO];
function getPlan(plan) {
    return exports.PLAN_CATALOG[plan];
}
function planHasFeature(plan, feature) {
    return exports.PLAN_CATALOG[plan].features.has(feature);
}
function quotaFor(plan, metric) {
    return exports.PLAN_CATALOG[plan].quotas[metric];
}
/** Cheapest self-serve plan that includes `feature`, for upgrade prompts. */
function cheapestPlanWith(feature) {
    for (const plan of exports.SELF_SERVE_PLANS) {
        if (planHasFeature(plan, feature))
            return exports.PLAN_CATALOG[plan];
    }
    return null;
}
function formatInr(amountPaise) {
    return `₹${(amountPaise / 100).toLocaleString('en-IN')}`;
}
//# sourceMappingURL=plans.catalog.js.map