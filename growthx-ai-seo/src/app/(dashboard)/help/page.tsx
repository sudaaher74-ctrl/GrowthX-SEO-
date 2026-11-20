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
  HelpCircle,
  Mail,
  Search,
  Shield,
} from "lucide-react";
import { resetTour } from "@/hooks/use-tour";
import { cn } from "@/lib/utils";

type Category = "all" | "getting_started" | "agents" | "ai_visibility" | "reports" | "billing";

interface FaqItem {
  q: string;
  a: string;
  category: Category;
}

const FAQS: FaqItem[] = [
  {
    category: "getting_started",
    q: "How do I connect Google Search Console and GA4?",
    a: "Navigate to Settings → Integrations and select 'Connect Google' next to Google Search Console or Google Analytics 4. You will be redirected to Google's official OAuth screen. Choose the target property and grant read-only permissions. Reigel never requires write or administrative rights to your Google properties.",
  },
  {
    category: "getting_started",
    q: "What does 'Run full pipeline' do on the Dashboard?",
    a: "Clicking 'Run full pipeline' orchestrates all 5 SEO stages automatically in one run: Website Technical Audit, Competitor Intelligence, AI Visibility checks, Backlink Discovery, and Fix Engine synchronization. Every tab remains 100% available manually whenever you want to run a single step on its own.",
  },
  {
    category: "getting_started",
    q: "How often is search performance and ranking data updated?",
    a: "Search Console data refreshes on Google's rolling export window (typically with a 2–3 day lag). Traffic refreshes automatically every 5 minutes when viewing the Traffic tab. Scheduled audits and 5-stage pipelines run automatically on the server cadence you configure in Settings → Automation & Webhooks (Daily, Weekly, Bi-weekly, or Monthly).",
  },
  {
    category: "agents",
    q: "How does Fix Engine ship changes via GitHub, WordPress, Shopify, and Webflow?",
    a: "Fix Engine prepares safe SEO improvements (titles, meta descriptions, H1s, canonicals, JSON-LD schema) for your review. You can ship a single fix or select up to 15 findings in Batch Safe Fixes to open 1 unified GitHub Pull Request or push 1 CMS batch to WordPress, Shopify, or Webflow (as Draft or Publish Live). Every CMS change stores a BEFORE snapshot so you can trigger a 1-click rollback anytime, and Regression Guard automatically reopens any defect that reappears on a later crawl.",
  },
  {
    category: "agents",
    q: "What is Grounded SEO Content Studio?",
    a: "Inside Fix Engine → Content Studio (or by clicking 'Draft in Content Studio' on any Fix Engine finding or Organic Search keyword), Reigel drafts full SEO articles, briefs, FAQs, local landing page outlines, and JSON-LD schema grounded strictly in your crawled site pages and Search Console data—with zero invented stats. You can edit inline, approve, download Markdown/HTML, open a GitHub PR, or publish directly to WordPress, Shopify, or Webflow.",
  },
  {
    category: "agents",
    q: "How do server webhooks and alerts work?",
    a: "In Settings → Automation & Webhooks, you can save SSRF-validated Slack, Discord, or Custom REST webhook URLs (optionally signed with HMAC-SHA256 via X-Reigel-Signature). Reigel sends real HTTP POST notifications when Regression Guard catches a regression, a fix is rolled back, a crawl finishes, or a Monthly Report snapshot is frozen.",
  },
  {
    category: "agents",
    q: "How does Lost-Link Recovery & Backlink Outreach work?",
    a: "Open Backlink Intelligence → Lost-Link Recovery & Outreach to see confirmed lost backlinks and competitor referring domain gaps. Generate grounded outreach emails citing the exact source and target URLs, copy or open them in your mail client, and track status from IDENTIFIED → DRAFTED → CONTACTED → RECOVERED. Recovered links automatically log to your Impact Ledger and Monthly Reports.",
  },
  {
    category: "ai_visibility",
    q: "What is AI Visibility and Generative Engine Optimization (GEO)?",
    a: "AI Visibility measures how often and in what context AI search assistants (ChatGPT, Perplexity, Google Gemini, and Claude) cite and recommend your brand for buyer prompts. The SERP Visualizer previews captured responses with real clickable cited sources and your live crawled page snippet.",
  },
  {
    category: "reports",
    q: "How do Frozen Monthly Snapshots & Zero-Login White-Label Client Links work?",
    a: "On Monthly Report (or in bulk from Clients → Lock & Share All Clients), locking a month freezes all KPIs, AI Visibility, Backlinks, Keywords, Fixes, and Account Manager Commentary so past months never drift. Sharing mints a revocable zero-login /share/report/[token] link stamped with your Agency White-Label logo, contact line, and footer, plus 1-click Server A4 PDF and CSV export across every report.",
  },
  {
    category: "billing",
    q: "How do I manage websites, quotas, or upgrade my plan?",
    a: "Navigate to Settings → Subscription to inspect your active limits (websites, crawl page depth, competitors, and AI visibility cycles) or switch between Founder, Starter, Growth, and Agency tiers. Manage tracked client websites anytime under Clients or Settings → Websites.",
  },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "All Questions" },
  { id: "getting_started", label: "Getting Started" },
  { id: "agents", label: "Fix Engine, CMS & Automation" },
  { id: "ai_visibility", label: "AI Visibility & GEO" },
  { id: "reports", label: "Reports & Agency Portals" },
  { id: "billing", label: "Plans & Quotas" },
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
            Guides, FAQs, and support channels.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-400/20 px-3 py-1 font-mono text-xs font-bold text-brand-950 border border-brand-200">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
          <span>Online</span>
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
            <h3 className="mt-3 font-bold text-brand-950 text-sm">Interactive Tour</h3>
            <p className="mt-1 text-xs text-brand-500 leading-relaxed">
              Step-by-step walkthrough covering crawler, fix engine, and AI visibility.
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
              1 website, 5,000 crawl pages, and 2 monthly AI audit cycles through Dec 2026.
            </p>
          </div>
          <Link
            href="/settings?tab=subscription"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-surface-2 px-3.5 py-2 text-xs font-semibold text-brand-700 hover:bg-surface-3 hover:text-brand-950 transition"
          >
            <span>View Quotas</span>
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
              Direct technical assistance from our engineering team.
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
              Setup guide for spider crawls, GitHub PRs, and CMS publishing.
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
