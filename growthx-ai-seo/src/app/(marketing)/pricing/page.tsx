"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sprout,
  Crown,
  BarChart3,
  Check,
  Zap,
  Clock,
  ShieldCheck,
  Headphones,
  ArrowRight,
} from "lucide-react";
import { PLANS, planPrice, YEARLY_DISCOUNT, type PlanId } from "@/lib/pricing";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingFooter } from "@/components/marketing/landing-footer";

const PLAN_STYLE: Record<PlanId, { icon: typeof Sprout; iconColor: string }> = {
  starter: { icon: Sprout, iconColor: "text-success-500" },
  growth: { icon: Crown, iconColor: "text-brand-950" },
  agency: { icon: BarChart3, iconColor: "text-brand-800" },
};

const ASSURANCE_PILLARS = [
  {
    icon: Zap,
    title: "No card to start",
    desc: "Free account, free audit",
  },
  {
    icon: Clock,
    title: "Setup in minutes",
    desc: "Paste your URL and go",
  },
  {
    icon: ShieldCheck,
    title: "Cancel anytime",
    desc: "No long-term contracts",
  },
  {
    icon: Headphones,
    title: "Real support",
    desc: "Email for all, priority on Growth and Agency",
  },
];

const PRICING_FAQS = [
  {
    q: "Is Reigel really 100% free through December 31, 2026?",
    a: "Yes! Early access founders and marketing teams receive full platform capabilities at ₹0 through December 31, 2026. No credit card is required, and there are zero automatic renewal debits.",
  },
  {
    q: "What are the 3 conditions of the free founder tier?",
    a: "Every registered user can monitor 1 active website, utilize up to 5,000 pages crawl capacity per technical spider run, and receive 2 complete AI Search Visibility audit cycles per month across ChatGPT, Perplexity, Claude, and Gemini.",
  },
  {
    q: "What happens when the promotion ends on January 1, 2027?",
    a: "Your account will not be automatically billed. In January 2027, you can choose whether you wish to stay on the standard single-site free tier or upgrade to Growth or Agency plans if you require multi-domain support.",
  },
  {
    q: "Can I change or cancel my plan at any time?",
    a: "Yes. You can upgrade, downgrade, or cancel from your billing settings at any time, with zero cancellation fees.",
  },
  {
    q: "How does the Fix Engine ship changes?",
    a: "Reigel prepares code patches and opens a pull request on your website's GitHub repository, with a before/after diff. Nothing is published until you review and merge it. Reigel never merges for you.",
  },
  {
    q: "Which AI assistants do you measure?",
    a: "ChatGPT, Claude, Gemini, and Perplexity, each queried through its official developer API. We measure brand citation share, source mentions, and competitor share of voice.",
  },
  {
    q: "What are credits?",
    a: "Platform actions (spider page audits, AI assistant queries, code patches) draw from a generous credit balance that refills monthly. You can monitor your balance anytime in Settings > Credits.",
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isYearly = billingCycle === "yearly";

  return (
    <div className="min-h-screen flex flex-col text-brand-950 relative overflow-hidden">
      <LandingHeader />

      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full relative z-10">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 bg-surface-1 border border-brand-200 text-brand-700 text-[11px] font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full mb-4 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-signal-400" />
            Simple Pricing. Serious Growth.
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl font-black text-brand-950 tracking-tight leading-[1.15] mb-3">
            Choose the plan that fits{" "}
            <span className="text-signal-400">
              your growth
            </span>
          </h1>

          <p className="text-sm sm:text-base text-brand-500 leading-relaxed max-w-2xl mx-auto">
            Audit, rivals, AI answers and Google Maps in one place, with fixes you approve and we prove. Priced in rupees.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="mt-8 flex items-center justify-center relative">
            <div className="bg-surface-2 p-1 rounded-full inline-flex items-center border border-brand-200">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  !isYearly
                    ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                    : "text-brand-600 hover:text-brand-950"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  isYearly
                    ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                    : "text-brand-600 hover:text-brand-950"
                }`}
              >
                <span>Yearly</span>
                <span className="bg-surface-1 text-success-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-brand-200">
                  Save {Math.round(YEARLY_DISCOUNT * 100)}%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Promotional Launch Banner: Free Through December */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-signal-400 bg-surface-1 p-6 sm:p-8 shadow-card mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-3 py-1 font-mono text-xs font-black text-signal-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal-ink animate-pulse" />
                  FOUNDER LAUNCH PROMOTION
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700 border border-success-200">
                  <Check size={12} strokeWidth={3} />
                  100% Free Through Dec 31, 2026
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-brand-950 tracking-tight">
                  Full Platform Access · ₹0 Until December 31, 2026
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-brand-600 leading-relaxed">
                  We are offering complimentary early access to founders and SEO teams. Every registered user can monitor <strong>1 website</strong> with up to <strong>5,000 pages crawl capacity</strong> and <strong>2 complete AI Visibility audit cycles</strong> per month.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-semibold text-brand-900">
                <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-2 p-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-signal-400/20 text-brand-950 font-bold">1</span>
                  <span>1 Monitored Website</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-2 p-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-signal-400/20 text-brand-950 font-bold">5K</span>
                  <span>5,000 Crawl Pages / Cycle</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-2 p-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-signal-400/20 text-brand-950 font-bold">2×</span>
                  <span>2 AI Visibility Cycles / Mo</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <Link
                href="/analyze"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-signal-400 px-6 py-3.5 text-sm font-extrabold text-signal-ink shadow-xs hover:bg-signal-500 transition cursor-pointer"
              >
                <span>Claim Free Early Access</span>
                <ArrowRight size={15} />
              </Link>
              <span className="text-center text-[11px] font-medium text-brand-400">
                No credit card required · Zero auto-renew
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch mb-12">
          {PLANS.map((tier) => {
            const Icon = PLAN_STYLE[tier.id].icon;
            const price = planPrice(tier.id, "INR", billingCycle);

            return (
              <div
                key={tier.id}
                className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 relative ${
                  tier.popular
                    ? "bg-surface-1 border-2 border-signal-400 shadow-card"
                    : "bg-surface-1 border border-brand-200 shadow-2xs hover:border-brand-300"
                }`}
              >
                {/* Most Popular Ribbon */}
                {tier.popular && (
                  <div className="absolute -top-3.5 right-6 bg-signal-400 text-signal-ink text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-xs">
                    Most Popular
                  </div>
                )}

                <div>
                  {/* Icon & Title Row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-surface-2 border border-brand-200 ${PLAN_STYLE[tier.id].iconColor}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-brand-950 leading-tight">
                        {tier.name}
                      </h3>
                      <span className="text-[11px] font-semibold text-brand-600 bg-surface-2 px-2 py-0.5 rounded-full inline-block mt-0.5 border border-brand-200">
                        {tier.audience}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-brand-500 leading-relaxed min-h-[36px] mb-5">
                    {tier.blurb}
                  </p>

                  {/* Price Block */}
                  <div className="mb-5 pb-5 border-b border-brand-200">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-brand-950 tracking-tight">
                        {price}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-brand-500">
                        / month
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-brand-400 mt-1">
                      {isYearly ? `Billed annually (save ${Math.round(YEARLY_DISCOUNT * 100)}%)` : "Billed monthly"}
                    </p>
                  </div>

                  {/* CTA Button */}
                  <Link
                    href={`/login?plan=${tier.id}&cycle=${billingCycle}`}
                    className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-full text-xs sm:text-sm font-bold transition-all mb-6 cursor-pointer ${
                      tier.popular
                        ? "bg-signal-400 hover:bg-signal-500 text-signal-ink shadow-xs"
                        : "bg-surface-2 hover:bg-surface-3 hover:text-brand-950 text-brand-900 border border-brand-200"
                    }`}
                  >
                    <span>Get Started with {tier.name}</span>
                    <ArrowRight size={14} />
                  </Link>

                  {/* Feature Checklist */}
                  <div className="space-y-2.5">
                    {tier.features.map((feat) => (
                      <div key={feat} className="flex items-start gap-2.5 text-xs text-brand-700">
                        <div className="w-4 h-4 rounded-full bg-surface-2 text-success-500 flex items-center justify-center shrink-0 mt-0.5 border border-brand-200">
                          <Check size={10} strokeWidth={3} />
                        </div>
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Assurance / Trust Strip */}
        <div className="bg-surface-1 rounded-2xl border border-brand-200 p-5 sm:p-6 shadow-2xs mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {ASSURANCE_PILLARS.map((pillar) => {
              const PillarIcon = pillar.icon;
              return (
                <div key={pillar.title} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-2 text-brand-900 flex items-center justify-center shrink-0 border border-brand-200">
                    <PillarIcon size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-brand-950 leading-tight">
                      {pillar.title}
                    </h4>
                    <p className="text-[11px] text-brand-500 mt-0.5">{pillar.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Point visitors to the pricing answers available on this public page. */}
        <div className="bg-surface-1 rounded-2xl border border-brand-200 p-6 sm:p-8 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-700 bg-surface-2 border border-brand-200 px-2.5 py-0.5 rounded-full">
              Still Not Sure?
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-brand-950 tracking-tight mt-1.5">
              Still have questions?
            </h3>
            <p className="text-xs sm:text-sm text-brand-500 mt-0.5">
              Read the answers to common plan and billing questions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpenFaq(0);
              document.getElementById("pricing-faq")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-brand-950 bg-surface-2 border border-brand-200 hover:bg-surface-3 transition-all shrink-0 cursor-pointer"
          >
            <span>View pricing FAQs</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* FAQ Accordion Prompt */}
        <div id="pricing-faq" className="text-center">
          <button
            type="button"
            onClick={() => setOpenFaq(openFaq === null ? 0 : null)}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-950 transition-colors cursor-pointer"
          >
            <span>Have more questions?</span>
            <span className="text-brand-950 underline decoration-signal-400 underline-offset-4">View our FAQs →</span>
          </button>

          {openFaq !== null && (
            <div className="mt-6 max-w-2xl mx-auto text-left space-y-3 bg-surface-1 p-5 rounded-2xl border border-brand-200 shadow-card transition-all">
              {PRICING_FAQS.map((faq, i) => (
                <div key={i} className="border-b border-brand-200 pb-3 last:border-0 last:pb-0">
                  <h4 className="text-xs sm:text-sm font-bold text-brand-950 mb-1">{faq.q}</h4>
                  <p className="text-xs text-brand-500 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
