"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  FileCode2,
  HelpCircle,
  Mail,
  Radar,
  Search,
  Shield,
  Zap,
} from "lucide-react";
import { resetTour } from "@/hooks/use-tour";
import { cn } from "@/lib/utils";

type Category = "all" | "getting_started" | "agents" | "ai_visibility" | "billing";

interface FaqItem {
  q: string;
  a: string;
  category: Category;
}

const FAQS: FaqItem[] = [
  {
    category: "getting_started",
    q: "How do I connect Google Search Console and GA4?",
    a: "Navigate to Settings > Integrations and select 'Connect Google' next to Google Search Console or Google Analytics 4. You will be redirected to Google's official OAuth screen. Choose the target property and grant read permissions. Reigel never requires write or administrative rights to your Google properties.",
  },
  {
    category: "getting_started",
    q: "How often is search performance and ranking data updated?",
    a: "Search Console data is refreshed on a rolling cadence based on Google's export pipeline (typically with Google's standard 2-3 day lag). Rank tracking and competitor checks run daily for all tracked queries in your active workspace.",
  },
  {
    category: "agents",
    q: "How does the Fix Engine open pull requests on GitHub?",
    a: "When you connect a GitHub repository in Settings > Integrations or from the Fix Engine, Reigel inspects your codebase for SEO issues (missing schema JSON-LD, duplicate titles, broken canonicals). It drafts a new Git branch and opens a pull request with code diffs for your engineering team to review. Reigel never commits directly to main or merges pull requests autonomously.",
  },
  {
    category: "agents",
    q: "What is the Continuous Website Audit Agent?",
    a: "The Website Audit Agent is an autonomous spider that crawls your site on a configurable schedule (Weekly, Every 3 Days, Daily, or On-Demand). It checks HTTP status codes, meta tags, Core Web Vitals, duplicate content, and sitemap health for up to 5,000 pages per cycle.",
  },
  {
    category: "ai_visibility",
    q: "What is AI Visibility and Generative Engine Optimization (GEO)?",
    a: "AI Visibility measures how often and in what context leading AI search engines (ChatGPT, Perplexity, Gemini, and Claude) cite and recommend your brand for relevant customer queries. GEO is the practice of structuring brand content so AI assistants accurately recommend your products.",
  },
  {
    category: "ai_visibility",
    q: "Which AI search engines does Reigel sample?",
    a: "We query ChatGPT (OpenAI), Perplexity Sonar, Google Gemini, and Anthropic Claude directly through their official developer APIs. Every answer is analyzed for brand sentiment, domain mentions, and citation share.",
  },
  {
    category: "billing",
    q: "Is Reigel really 100% free through December 31, 2026?",
    a: "Yes! Early access founders and marketing teams receive full platform access at ₹0 through December 31, 2026. No credit card is required, and there are zero automatic renewal debits.",
  },
  {
    category: "billing",
    q: "What are the 3 conditions of the free founder tier?",
    a: "Each account can monitor 1 active website, utilize up to 5,000 pages crawl capacity per technical spider run, and receive 2 complete AI Search Visibility audit cycles per month across all assistants.",
  },
  {
    category: "billing",
    q: "What happens when the promotion ends on January 1, 2027?",
    a: "Your account will not be charged. You will be invited to choose whether you wish to stay on the standard single-site free tier or upgrade to Growth or Agency plans if you require multi-domain or higher crawl volume support.",
  },
  {
    category: "billing",
    q: "How do I upgrade or change my subscription plan?",
    a: "Navigate to Settings > Subscription and click 'Change Plan'. You can select between Founder Early Access, Starter, Growth, or Agency tiers. Your workspace limits (websites, crawl capacity, competitors, and AI visibility cycles) update immediately.",
  },
  {
    category: "getting_started",
    q: "Can I replace or change my monitored website?",
    a: "Yes. Head to Settings > Websites to view your currently active domain. You can switch or manage your tracked website anytime.",
  },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "All Questions" },
  { id: "getting_started", label: "Getting Started" },
  { id: "agents", label: "Autonomous Agents" },
  { id: "ai_visibility", label: "AI Visibility & GEO" },
  { id: "billing", label: "Credits & Free Tier" },
];

export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [tourNotice, setTourNotice] = useState(false);

  const filteredFaqs = useMemo(() => {
    let list = FAQS;
    if (activeCategory !== "all") {
      list = list.filter((f) => f.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
    }
    return list;
  }, [activeCategory, search]);

  const handleRestartTour = () => {
    resetTour();
    setTourNotice(true);
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-950 sm:text-2xl">
            Help &amp; Knowledge Base
          </h1>
          <p className="mt-1 text-xs text-brand-500">
            Answers, tutorials, and support channels for the Reigel autonomous SEO platform
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-400/20 px-3 py-1 font-mono text-xs font-bold text-brand-950 border border-brand-200">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
          <span>Support Center Online</span>
        </span>
      </div>

      {tourNotice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-brand-200 bg-surface-2 px-4 py-3 text-xs text-brand-900 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-success-600" />
            <span>Tour reset! Redirecting to dashboard…</span>
          </div>
        </div>
      )}

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {/* Card 1: Interactive Guided Tour */}
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs flex flex-col justify-between space-y-3">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
              <Compass size={18} />
            </span>
            <h3 className="mt-3 font-bold text-brand-950 text-sm">Interactive Product Tour</h3>
            <p className="mt-1 text-xs text-brand-500 leading-relaxed">
              Step-by-step walkthrough covering the site switcher, spider crawler, and AI visibility tracker.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRestartTour}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-signal-400 px-3.5 py-2 text-xs font-extrabold text-signal-ink shadow-xs hover:bg-signal-500 transition cursor-pointer"
          >
            <span>Restart Tour</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Card 2: Founder Free Access */}
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs flex flex-col justify-between space-y-3">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-brand-700 border border-brand-200 font-bold">
              <Shield size={18} />
            </span>
            <h3 className="mt-3 font-bold text-brand-950 text-sm">Free Founder Access</h3>
            <p className="mt-1 text-xs text-brand-500 leading-relaxed">
              100% Free through Dec 31, 2026. Includes 1 website, 5,000 crawl pages, and 2 AI audit cycles.
            </p>
          </div>
          <Link
            href="/settings?tab=subscription"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-surface-2 px-3.5 py-2 text-xs font-semibold text-brand-700 hover:bg-surface-3 hover:text-brand-950 transition"
          >
            <span>View Subscription Quotas</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Card 3: Direct Email Support */}
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs flex flex-col justify-between space-y-3">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-brand-700 border border-brand-200 font-bold">
              <Mail size={18} />
            </span>
            <h3 className="mt-3 font-bold text-brand-950 text-sm">Email Support</h3>
            <p className="mt-1 text-xs text-brand-500 leading-relaxed">
              Reach our engineering and SEO team directly for technical assistance and onboarding help.
            </p>
          </div>
          <a
            href="mailto:support@reigel.ai"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-surface-2 px-3.5 py-2 text-xs font-semibold text-brand-700 hover:bg-surface-3 hover:text-brand-950 transition"
          >
            <span>support@reigel.ai</span>
            <ArrowRight size={12} />
          </a>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search FAQs, documentation, and troubleshooting guides…"
            className="w-full rounded-2xl border border-brand-200 bg-surface-1 py-2.5 pl-9 pr-8 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-none focus:border-brand-400 shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-400 hover:text-brand-950 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                activeCategory === cat.id
                  ? "border-signal-400 bg-signal-400 text-signal-ink font-bold shadow-xs"
                  : "border-brand-200 bg-surface-2 text-brand-700 hover:bg-surface-3 hover:text-brand-950",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* FAQs List */}
      <div className="rounded-2xl border border-brand-200 bg-surface-1 p-6 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle size={16} className="text-brand-500" />
          <h2 className="text-sm font-bold text-brand-950">
            Frequently Asked Questions ({filteredFaqs.length})
          </h2>
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs font-bold text-brand-950">No questions found matching &quot;{search}&quot;</p>
            <p className="text-xs text-brand-500">Try searching for &quot;crawler&quot;, &quot;GitHub&quot;, &quot;credits&quot;, or &quot;GSC&quot;.</p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setActiveCategory("all");
              }}
              className="mt-2 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-surface-3 transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-xl border border-brand-200 bg-surface-2 overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-4 text-left text-xs font-bold text-brand-950 hover:bg-surface-3 transition cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp size={14} className="shrink-0 text-brand-500" /> : <ChevronDown size={14} className="shrink-0 text-brand-500" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-brand-600 leading-relaxed border-t border-brand-200/80 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Documentation & Guides Banner */}
      <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brand-700 border border-brand-200">
            <BookOpen size={18} />
          </span>
          <div>
            <h3 className="text-xs font-bold text-brand-950">Autonomous SEO Playbook</h3>
            <p className="text-xs text-brand-500">
              Learn how to connect autonomous agents, run technical spider audits, and verify search results.
            </p>
          </div>
        </div>
        <Link
          href="/settings?tab=agents"
          className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-2 text-xs font-extrabold text-signal-ink shadow-xs hover:bg-signal-500 transition shrink-0"
        >
          <span>Configure Agents</span>
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
