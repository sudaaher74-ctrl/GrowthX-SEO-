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
    blurb: "Audit your site, track rivals & AI visibility, and follow plain-English step-by-step fix guides.",
    monthly: { INR: 2999, USD: 39 },
    features: [
      "1 monitored website",
      "5,000 crawl pages per audit",
      "Up to 5 competitors tracked",
      "2 monthly AI Visibility cycles",
      "Google Search Console & Analytics 4 reports",
      "Plain-English Action Plan & 5-platform step-by-step fix guides",
      "1-click developer handoff briefs & live URL verification",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    audience: "Growing brands",
    blurb: "Multi-site audits, Local & Maps rank tracking, AI Content Writer, and verified proof.",
    monthly: { INR: 7999, USD: 99 },
    popular: true,
    features: [
      "Up to 5 monitored websites",
      "25,000 crawl pages per audit",
      "Up to 15 competitors tracked",
      "10 monthly AI Visibility cycles",
      "Plain-English Action Plan, platform guides & live verification proof",
      "Grounded AI Content Writer & rival counter-moves",
      "Backlink Intelligence & lost-link recovery outreach",
      "Local & Maps street rank grid, QR review kit & directory checklist",
      "Priority support",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    audience: "Agencies & multi-site teams",
    blurb: "Automated Fix Engine for GitHub & CMS, up to 20 client sites, and white-label client portals.",
    monthly: { INR: 14999, USD: 189 },
    features: [
      "Up to 20 monitored websites",
      "100,000 crawl pages per audit",
      "Up to 50 competitors tracked",
      "50 monthly AI Visibility cycles",
      "Automated Fix Engine: GitHub PRs, WordPress/Shopify/Webflow auto-apply & batch fixes",
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
