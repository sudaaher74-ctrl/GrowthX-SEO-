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
    q: "Can I change or cancel my plan at any time?",
    a: "Yes. You can upgrade, downgrade, or cancel from your billing settings at any time, with no cancellation fee.",
  },
  {
    q: "How does the Fix Engine ship changes?",
    a: "Reigel prepares the fixes and opens a pull request on your website's GitHub repository, with a before/after diff. Nothing is published until you review and merge it. Reigel never merges for you.",
  },
  {
    q: "Which AI assistants do you measure?",
    a: "ChatGPT, Claude, Gemini, Perplexity and Sarvam, each asked through its own official API. Google AI Overviews and Copilot have no public API, so we tell you we could not ask instead of showing a zero.",
  },
  {
    q: "What are tokens?",
    a: "AI analysis and map-grid scans draw from a token balance that refills every month. You can see your balance and what each feature costs on the Tokens screen.",
  },
  {
    q: "What payment methods do you accept?",
    a: "UPI, net banking, and Visa, MasterCard, RuPay and Amex cards.",
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
                        : "bg-surface-2 hover:bg-brand-100 text-brand-950 border border-brand-200"
                    }`}
                  >
                    <span>Start free</span>
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
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-brand-950 bg-surface-2 border border-brand-200 hover:bg-brand-100 transition-all shrink-0 cursor-pointer"
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
