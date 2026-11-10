/**
 * The one price list. The landing page, /pricing and the site metadata all read
 * from here, so a price is changed in exactly one place.
 *
 * Yearly is 20% off the monthly price, rounded to the nearest rupee/dollar.
 * Only list what the product does today: no plan line may promise a feature
 * that is not built.
 */

export type PlanId = "starter" | "growth" | "agency";
export type Currency = "INR" | "USD";
export type BillingCycle = "monthly" | "yearly";

interface Plan {
  id: PlanId;
  name: string;
  audience: string;
  blurb: string;
  /** Monthly price, whole units of each currency. */
  monthly: Record<Currency, number>;
  popular?: boolean;
  features: string[];
}

export const YEARLY_DISCOUNT = 0.2;

/** Every plan tracks up to this many rivals per website (the product's hard cap). */
const COMPETITORS_PER_SITE = 5;

export const PLANS: readonly Plan[] = [
  {
    id: "starter",
    name: "Starter",
    audience: "One business",
    blurb: "Audit your site, watch your rivals and see how AI assistants talk about you.",
    monthly: { INR: 2999, USD: 39 },
    features: [
      "1 monitored website",
      "5,000 crawl pages per audit",
      "Up to 5 competitors tracked",
      "2 monthly AI Visibility cycles",
      "Google Search Console and Analytics 4 reports",
      "Ranked Fix Engine code patches",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    audience: "Growing brands",
    blurb: "More sites, Google Maps tracking and the full fix-and-verify loop.",
    monthly: { INR: 7999, USD: 99 },
    popular: true,
    features: [
      "Up to 5 monitored websites",
      "25,000 crawl pages per audit",
      "Up to 15 competitors tracked",
      "10 monthly AI Visibility cycles",
      "Daily rival page tracking with counter-move drafts",
      "Google Business Profile audit and local map grid",
      "Before/after re-crawl proof for every fix",
      "Priority support",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    audience: "Agencies and multi-location brands",
    blurb: "Run many clients from one workspace and hand them reports they can read.",
    monthly: { INR: 14999, USD: 189 },
    features: [
      "Up to 20 monitored websites",
      "100,000 crawl pages per audit",
      "Up to 50 competitors tracked",
      "50 monthly AI Visibility cycles",
      "White-label client portal & PDF reports",
      "Multi-location Google Business oversight",
      "Priority executive support",
    ],
  },
] as const;

function priceFor(plan: Plan, currency: Currency, cycle: BillingCycle): number {
  const monthly = plan.monthly[currency];
  return cycle === "yearly" ? Math.round(monthly * (1 - YEARLY_DISCOUNT)) : monthly;
}

function formatPrice(amount: number, currency: Currency): string {
  return currency === "INR" ? `₹${amount.toLocaleString("en-IN")}` : `$${amount.toLocaleString("en-US")}`;
}

export function planPrice(id: PlanId, currency: Currency, cycle: BillingCycle): string {
  const plan = PLANS.find((p) => p.id === id)!;
  return formatPrice(priceFor(plan, currency, cycle), currency);
}

/** The cheapest plan, for "from ₹X" copy and structured data. */
const _ENTRY_PLAN = PLANS[0];
