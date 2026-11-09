"use client";

import { useSyncExternalStore } from "react";
import type { Currency, BillingCycle } from "./pricing";

export type SubscriptionTierId = "founder_free" | "starter" | "growth" | "agency";

export interface SubscriptionPlanDef {
  id: SubscriptionTierId;
  name: string;
  badge: string;
  blurb: string;
  monthlyPrice: Record<Currency, number>;
  websiteLimit: number;
  crawlPageLimit: number;
  aiCyclesMonthly: number;
  competitorsLimit: number;
  creditsMonthly: number;
  features: string[];
  popular?: boolean;
  isPromotionalFree?: boolean;
}

export interface ClaimedSubscription {
  tierId: SubscriptionTierId;
  tierName: string;
  claimedAt: string;
  expiresAt: string;
  status: "active" | "expired";
  billingCycle: BillingCycle;
  currency: Currency;
  limits: {
    websites: number;
    crawlPages: number;
    aiCycles: number;
    competitors: number;
    credits: number;
  };
}

export const DEFAULT_SUBSCRIPTION_LIMITS = {
  websites: 1,
  crawlPages: 5000,
  aiCycles: 2,
  competitors: 5,
  credits: 500000,
} as const;

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlanDef[] = [
  {
    id: "founder_free",
    name: "Founder Early Access Pass",
    badge: "100% Free Access",
    blurb: "Complimentary access for founders & marketing teams through December 31, 2026.",
    monthlyPrice: { INR: 0, USD: 0 },
    websiteLimit: 1,
    crawlPageLimit: 5000,
    aiCyclesMonthly: 2,
    competitorsLimit: 5,
    creditsMonthly: 500000,
    isPromotionalFree: true,
    popular: true,
    features: [
      "1 Monitored Website",
      "5,000 Crawl Pages per audit cycle",
      "2 Monthly AI Visibility Audits (ChatGPT, Perplexity, Claude, Gemini)",
      "Ranked Fix Engine pull request patches",
      "5 Tracked Competitors & Rival Radar",
      "500,000 monthly credits allowance",
      "Zero card required · Zero auto-renew",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    badge: "Solo Business",
    blurb: "Audit your site, watch your rivals and see how AI assistants talk about you.",
    monthlyPrice: { INR: 2999, USD: 39 },
    websiteLimit: 1,
    crawlPageLimit: 5000,
    aiCyclesMonthly: 2,
    competitorsLimit: 5,
    creditsMonthly: 500000,
    isPromotionalFree: false,
    features: [
      "1 Monitored Website",
      "5,000 Crawl Pages per audit cycle",
      "2 Monthly AI Visibility Audits",
      "Up to 5 competitors tracked",
      "Google Search Console & GA4 reports",
      "Fix Engine pull requests for low-risk fixes",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    badge: "Growing Brands",
    blurb: "More sites, Google Business rankings, and the complete fix-and-verify loop.",
    monthlyPrice: { INR: 7999, USD: 99 },
    websiteLimit: 5,
    crawlPageLimit: 25000,
    aiCyclesMonthly: 10,
    competitorsLimit: 15,
    creditsMonthly: 2000000,
    isPromotionalFree: false,
    features: [
      "Up to 5 Monitored Websites",
      "25,000 Crawl Pages capacity",
      "10 Monthly AI Visibility Audits",
      "Daily rival page tracking with counter-move drafts",
      "Google Business Profile: audit, reviews & local map grid",
      "Before/after re-crawl proof for every fix",
      "2,000,000 monthly credits allowance",
      "Priority support",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    badge: "Agencies & Enterprise",
    blurb: "Run many client workspaces, export client reports, and white-label your portal.",
    monthlyPrice: { INR: 14999, USD: 189 },
    websiteLimit: 20,
    crawlPageLimit: 100000,
    aiCyclesMonthly: 50,
    competitorsLimit: 50,
    creditsMonthly: 10000000,
    isPromotionalFree: false,
    features: [
      "Up to 20 Monitored Websites",
      "100,000 Crawl Pages capacity",
      "50 Monthly AI Visibility Audits",
      "White-Label Client Portal & Branding Suite",
      "Multiple Google Business Profile locations",
      "Client-ready PDF executive reports",
      "10,000,000 monthly credits allowance",
      "Dedicated 24/7 priority support",
    ],
  },
] as const;

const STORAGE_PREFIX = "growthx_subscription_claim_";
const PROMO_END_DATE = "2026-12-31T23:59:59.999Z";

function getStorageKey(orgId: string | null | undefined): string {
  return `${STORAGE_PREFIX}${orgId || "default"}`;
}

const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith(STORAGE_PREFIX)) {
      notifyListeners();
    }
  });
}

export const subscriptionEngine = {
  getClaimedSubscription(orgId: string | null | undefined): ClaimedSubscription | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(getStorageKey(orgId));
      if (!raw) return null;
      const parsed: ClaimedSubscription = JSON.parse(raw);
      if (!parsed.tierId || !parsed.limits) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  claimSubscription(
    orgId: string | null | undefined,
    tierId: SubscriptionTierId,
    options?: {
      cycle?: BillingCycle;
      currency?: Currency;
    }
  ): ClaimedSubscription {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === tierId) ?? SUBSCRIPTION_PLANS[0];
    const now = new Date().toISOString();

    const claimed: ClaimedSubscription = {
      tierId: plan.id,
      tierName: plan.name,
      claimedAt: now,
      expiresAt: PROMO_END_DATE,
      status: "active",
      billingCycle: options?.cycle ?? "monthly",
      currency: options?.currency ?? "INR",
      limits: {
        websites: plan.websiteLimit,
        crawlPages: plan.crawlPageLimit,
        aiCycles: plan.aiCyclesMonthly,
        competitors: plan.competitorsLimit,
        credits: plan.creditsMonthly,
      },
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(getStorageKey(orgId), JSON.stringify(claimed));
        notifyListeners();
      } catch {
        // ignore storage errors
      }
    }

    return claimed;
  },

  hasClaimedSubscription(orgId: string | null | undefined): boolean {
    const sub = this.getClaimedSubscription(orgId);
    return Boolean(sub && sub.status === "active");
  },

  checkQuota(
    orgId: string | null | undefined,
    metric: "websites" | "crawlPages" | "aiCycles" | "competitors",
    currentUsage: number
  ): { allowed: boolean; limit: number; remaining: number } {
    const sub = this.getClaimedSubscription(orgId);
    const limit = sub ? sub.limits[metric] : DEFAULT_SUBSCRIPTION_LIMITS[metric];
    const remaining = Math.max(0, limit - currentUsage);
    const allowed = currentUsage < limit;

    return {
      allowed,
      limit,
      remaining,
    };
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/**
 * React hook to observe and interact with the workspace's subscription state.
 */
export function useSubscription(orgId: string | null | undefined) {
  const subscription = useSyncExternalStore(
    (onStoreChange) => subscriptionEngine.subscribe(onStoreChange),
    () => subscriptionEngine.getClaimedSubscription(orgId),
    () => null
  );

  const isClaimed = Boolean(subscription && subscription.status === "active");
  const plan = subscription
    ? SUBSCRIPTION_PLANS.find((p) => p.id === subscription.tierId) ?? SUBSCRIPTION_PLANS[0]
    : null;

  return {
    subscription,
    isClaimed,
    plan,
    allPlans: SUBSCRIPTION_PLANS,
    claim: (tierId: SubscriptionTierId, options?: { cycle?: BillingCycle; currency?: Currency }) =>
      subscriptionEngine.claimSubscription(orgId, tierId, options),
    checkQuota: (metric: "websites" | "crawlPages" | "aiCycles" | "competitors", currentUsage: number) =>
      subscriptionEngine.checkQuota(orgId, metric, currentUsage),
  };
}
