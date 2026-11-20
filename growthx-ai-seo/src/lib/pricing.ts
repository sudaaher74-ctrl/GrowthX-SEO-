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
    blurb: "Audit your site, track rivals & AI visibility, and ship safe fixes to GitHub or your CMS.",
    monthly: { INR: 2999, USD: 39 },
    features: [
      "1 monitored website",
      "5,000 crawl pages per audit",
      "Up to 5 competitors tracked",
      "2 monthly AI Visibility cycles",
      "Google Search Console & Analytics 4 reports",
      "Fix Engine for GitHub PRs, WordPress, Shopify & Webflow",
      "Automatic BEFORE snapshots & 1-click rollback",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    audience: "Growing brands",
    blurb: "Scheduled 5-stage pipelines, Grounded Content Studio, backlink recovery, and verified proof.",
    monthly: { INR: 7999, USD: 99 },
    popular: true,
    features: [
      "Up to 5 monitored websites",
      "25,000 crawl pages per audit",
      "Up to 15 competitors tracked",
      "10 monthly AI Visibility cycles",
      "Batch Safe Fixes (up to 15 in 1 PR or CMS push)",
      "Grounded SEO Content Studio & rival counter-moves",
      "Backlink Intelligence & lost-link recovery outreach",
      "Scheduled pipelines, Regression Guard & webhooks",
      "Priority support",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    audience: "Agencies & multi-site teams",
    blurb: "Run up to 20 client sites from one hub with frozen snapshots and zero-login white-label portals.",
    monthly: { INR: 14999, USD: 189 },
    features: [
      "Up to 20 monitored websites",
      "100,000 crawl pages per audit",
      "Up to 50 competitors tracked",
      "50 monthly AI Visibility cycles",
      "Zero-login white-label client portals & A4 PDF/CSV",
      "Frozen historical monthly snapshots & bulk delivery",
      "1-click per-client pipelines & Regression Guard alerts",
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
