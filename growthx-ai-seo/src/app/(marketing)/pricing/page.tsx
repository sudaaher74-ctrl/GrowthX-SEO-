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
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingFooter } from "@/components/marketing/landing-footer";

interface PricingPlan {
  id: string;
  name: string;
  badge: string;
  icon: typeof Sprout;
  iconColor: string;
  iconBg: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  popular?: boolean;
  features: string[];
}

const PRICING_TIERS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    badge: "For small businesses",
    icon: Sprout,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    description: "Everything you need to get started with AI-powered SEO.",
    monthlyPrice: "₹2,999",
    yearlyPrice: "₹2,399",
    features: [
      "1 Website / Domain",
      "Full Website Audit",
      "Basic Competitor Analysis (up to 5)",
      "AI Visibility Tracking (ChatGPT, Claude, Gemini)",
      "Prioritized 30-Day Plan",
      "Manual Implementation Guide",
      "Email Support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    badge: "For growing businesses",
    icon: Crown,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-50",
    description: "Go beyond insights — get a complete growth plan and automated execution.",
    monthlyPrice: "₹4,999",
    yearlyPrice: "₹3,999",
    popular: true,
    features: [
      "5 Websites / Domains",
      "Everything in Starter",
      "Advanced Competitor Intelligence (up to 20)",
      "AI Visibility Tracking (multiple AI platforms)",
      "Prioritized 30-Day Plan with auto-execution",
      "Fix Engine (Automatic Implementation)",
      "Performance Tracking & Verification",
      "Weekly Progress Reports",
      "Priority Support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    badge: "For large businesses",
    icon: BarChart3,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
    description: "Advanced automation and intelligence for maximum growth.",
    monthlyPrice: "₹7,999",
    yearlyPrice: "₹6,399",
    features: [
      "20 Websites / Domains",
      "Everything in Growth",
      "Unlimited Competitor Tracking",
      "Deep AI Visibility & Brand Analysis",
      "Advanced Opportunity Engine",
      "Full Fix Engine with Verification",
      "Custom Reports & Integrations",
      "Dedicated Account Manager",
      "Priority Support",
    ],
  },
];

const ASSURANCE_PILLARS = [
  {
    icon: Zap,
    title: "No credit card required",
    desc: "Start with a free analysis",
  },
  {
    icon: Clock,
    title: "Setup in minutes",
    desc: "Get results quickly",
  },
  {
    icon: ShieldCheck,
    title: "Cancel anytime",
    desc: "No long-term contracts",
  },
  {
    icon: Headphones,
    title: "Expert support",
    desc: "We're here to help",
  },
];

const PRICING_FAQS = [
  {
    q: "Can I change or cancel my plan at any time?",
    a: "Yes. You can upgrade, downgrade, or cancel your subscription directly from your billing settings at any time without penalty or cancellation fees.",
  },
  {
    q: "How does the Fix Engine implement changes automatically?",
    a: "GrowthX connects securely with your CMS or repository (WordPress, Webflow, Shopify, GitHub). Once you review and approve recommended fixes, our engine deploys the structured schema, meta tags, and content updates with zero developer backlog.",
  },
  {
    q: "What AI platforms are monitored under AI Visibility?",
    a: "We continuously track multi-turn conversational prompt share and brand citation prominence across OpenAI ChatGPT, Anthropic Claude, Perplexity AI, and Google Gemini.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We support UPI, Net Banking, credit/debit cards (Visa, MasterCard, RuPay, Amex), and international cards via secure encrypted checkout.",
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isYearly = billingCycle === "yearly";

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 via-white to-slate-50 flex flex-col text-slate-900">
      <LandingHeader />

      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-1.5 bg-violet-100/70 border border-violet-200/80 text-violet-700 text-[11px] font-extrabold uppercase tracking-wider px-4 py-1 rounded-full mb-4">
            Simple Pricing. Serious Growth.
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.15] mb-3">
            Choose the plan that fits{" "}
            <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
              your growth
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Get powerful SEO and AI visibility tools with automated execution — at a price that grows with you.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="mt-8 flex items-center justify-center relative">
            <div className="bg-slate-100/90 p-1 rounded-full inline-flex items-center border border-slate-200/70 shadow-inner">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  !isYearly
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  isYearly
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Yearly</span>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Save 20%
                </span>
              </button>
            </div>

            {/* Handwritten Note Annotation with Arrow */}
            <div className="hidden sm:flex items-center gap-1.5 absolute -right-2 top-0 lg:right-16 text-violet-600">
              <svg
                className="w-8 h-8 text-violet-500 transform -rotate-12 translate-y-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span
                className="text-xs font-bold whitespace-nowrap text-violet-600"
                style={{ fontFamily: "cursive", transform: "rotate(4deg)" }}
              >
                More value with yearly billing
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch mb-12">
          {PRICING_TIERS.map((tier) => {
            const Icon = tier.icon;
            const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice;

            return (
              <div
                key={tier.id}
                className={`bg-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 relative ${
                  tier.popular
                    ? "border-2 border-violet-600 shadow-xl shadow-violet-100/80 ring-4 ring-violet-50"
                    : "border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300"
                }`}
              >
                {/* Most Popular Ribbon */}
                {tier.popular && (
                  <div className="absolute -top-3.5 right-6 bg-violet-600 text-white text-[11px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md">
                    Most Popular
                  </div>
                )}

                <div>
                  {/* Icon & Title Row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${tier.iconBg} ${tier.iconColor}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 leading-tight">
                        {tier.name}
                      </h3>
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                        {tier.badge}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 leading-relaxed min-h-[36px] mb-5">
                    {tier.description}
                  </p>

                  {/* Price Block */}
                  <div className="mb-5 pb-5 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
                        {price}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-500">
                        / month
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-400 mt-1">
                      {isYearly ? "Billed annually (save 20%)" : "Billed monthly"}
                    </p>
                  </div>

                  {/* CTA Button */}
                  <Link
                    href={`/register?plan=${tier.id}&cycle=${billingCycle}`}
                    className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all mb-6 cursor-pointer ${
                      tier.popular
                        ? "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200 hover:shadow-lg"
                        : "bg-white hover:bg-violet-50/60 text-slate-800 border border-slate-200 hover:border-violet-300 hover:text-violet-700"
                    }`}
                  >
                    <span>Get Started</span>
                    <ArrowRight size={14} />
                  </Link>

                  {/* Feature Checklist */}
                  <div className="space-y-2.5">
                    {tier.features.map((feat) => (
                      <div key={feat} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <div className="w-4 h-4 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={11} strokeWidth={3} />
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
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {ASSURANCE_PILLARS.map((pillar) => {
              const PillarIcon = pillar.icon;
              return (
                <div key={pillar.title} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <PillarIcon size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                      {pillar.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{pillar.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Still Not Sure? Talk to Our Team Banner */}
        <div className="bg-gradient-to-r from-violet-50 via-indigo-50/50 to-white rounded-2xl border border-violet-100 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-violet-600 bg-violet-100/70 px-2.5 py-0.5 rounded-full">
              Still Not Sure?
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5">
              Talk to our team
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Get a personalized recommendation based on your business goals.
            </p>
          </div>

          <Link
            href="/help"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-violet-700 bg-white border border-violet-200 hover:border-violet-300 hover:bg-violet-50 shadow-sm transition-all shrink-0 cursor-pointer"
          >
            <span>Contact Sales</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* FAQ Accordion Prompt */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setOpenFaq(openFaq === null ? 0 : null)}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-violet-600 transition-colors cursor-pointer"
          >
            <span>Have more questions?</span>
            <span className="text-violet-600 underline underline-offset-4">View our FAQs →</span>
          </button>

          {/* Interactive FAQ list if expanded */}
          {openFaq !== null && (
            <div className="mt-6 max-w-2xl mx-auto text-left space-y-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm transition-all">
              {PRICING_FAQS.map((faq, i) => (
                <div key={i} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-1">{faq.q}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{faq.a}</p>
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
