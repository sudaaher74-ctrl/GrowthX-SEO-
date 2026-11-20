"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, Hand, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The three fix classes, as the Fix Engine really routes them
 * (growthx-ai-crawler/src/modules/issues/fix-class.ts). Keep the examples in
 * step with that table.
 */
const FIX_RULES = [
  {
    icon: Eye,
    title: "Low risk, invisible to visitors",
    examples: "Titles, meta descriptions, alt text, canonicals, JSON-LD schema, sitemap",
    how: "Ship individually or batch up to 15 fixes to GitHub PRs, WordPress, Shopify, or Webflow — with automatic BEFORE snapshots & 1-click rollback.",
    tone: "text-success-500 bg-surface-1 border-brand-200",
  },
  {
    icon: Hand,
    title: "Visible to visitors, so you review it",
    examples: "Headings, broken links, redirects, robots rules, Grounded Content Studio drafts",
    how: "Shown as a before/after diff or CMS Draft preview. Nothing goes live until you approve it.",
    tone: "text-warning-500 bg-surface-1 border-brand-200",
  },
  {
    icon: PenLine,
    title: "Needs your judgement",
    examples: "Thin content, server errors, HTTPS, lost-link outreach, pages that should be retired",
    how: "Reigel explains the evidence, drafts the recovery email or grounded replacement, and tracks your decision in the ledger.",
    tone: "text-brand-800 bg-surface-1 border-brand-200",
  },
];

type AudienceId = "agencies" | "founders" | "teams";

const AUDIENCE_PROFILES: readonly {
  id: AudienceId;
  tabLabel: string;
  headline: string;
  summary: string;
  highlights: readonly string[];
  ctaLabel: string;
  ctaHref: string;
}[] = [
  {
    id: "agencies",
    tabLabel: "Agencies (up to 20 sites)",
    headline: "Run more client retainers without hiring more analysts.",
    summary:
      "Manage up to 20 client sites in one Agency Hub with 1-click per-client pipelines, bulk Lock & Share month-end delivery, and zero-login white-label portals.",
    highlights: [
      "Lock frozen monthly snapshots and share agency-branded portal links with zero client logins",
      "Export server-rendered A4 PDF executive decks and 1-click CSV tables in seconds",
      "Get instant HMAC-signed Slack, Discord, or REST alerts if any client site regresses",
    ],
    ctaLabel: "See Agency plan",
    ctaHref: "/pricing",
  },
  {
    id: "founders",
    tabLabel: "Business Owners",
    headline: "Fix technical & AI SEO issues without waiting on dev sprints.",
    summary:
      "Paste your URL, review plain-language priorities, and publish safe fixes or fact-grounded articles straight to WordPress, Shopify, Webflow, or GitHub.",
    highlights: [
      "Publish single or batch safe fixes with automatic BEFORE snapshots and 1-click rollback",
      "Turn declining keywords and AI citation gaps into grounded articles in Content Studio",
      "Track real rankings, AI visibility across 5 models, and recovered backlinks in one place",
    ],
    ctaLabel: "Run free audit",
    ctaHref: "/login",
  },
  {
    id: "teams",
    tabLabel: "In-House SEO Teams",
    headline: "Replace five disconnected SEO tools with one verified loop.",
    summary:
      "Unify Playwright technical crawls, scheduled 5-stage pipelines, competitor counter-moves, lost-link recovery outreach, and verifiable GitHub PR workflows.",
    highlights: [
      "Batch up to 15 low-risk fixes into a single clean pull request that never auto-merges",
      "Run Daily, Weekly, Bi-weekly, or Monthly pipelines with automatic Regression Guard",
      "Measure ChatGPT, Claude, Gemini, Perplexity & Sarvam through each vendor's official API",
    ],
    ctaLabel: "Test interactive demo",
    ctaHref: "/#interactive-demo",
  },
];

function FixRules() {
  return (
    <div className="bg-surface-1 border border-brand-200 rounded-3xl p-5 sm:p-6 shadow-card">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-500 mb-1">
        Safety rules
      </p>
      <h3 className="text-xl sm:text-2xl font-black text-brand-950 leading-tight tracking-tight mb-1">
        It changes your site only when you say so.
      </h3>
      <p className="text-sm text-brand-500 leading-relaxed mb-5">
        Fixes are sorted by risk class. GitHub PRs never auto-merge, every CMS push saves a BEFORE snapshot for 1-click rollback, and Regression Guard watches every deployment after it ships.
      </p>
      <div className="space-y-3">
        {FIX_RULES.map((rule) => {
          const Icon = rule.icon;
          return (
            <div key={rule.title} className="bg-surface-2 border border-brand-200 rounded-2xl p-4 flex gap-3">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${rule.tone}`}>
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-brand-950 leading-tight">{rule.title}</h4>
                <p className="text-xs text-brand-700 mt-1 leading-snug">{rule.examples}</p>
                <p className="text-xs text-brand-500 mt-1.5 leading-snug">{rule.how}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ValueSection() {
  const baseId = useId();
  const [audience, setAudience] = useState<AudienceId>("agencies");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeAudience =
    AUDIENCE_PROFILES.find((item) => item.id === audience) ?? AUDIENCE_PROFILES[0];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const ids = AUDIENCE_PROFILES.map((item) => item.id);
    const idx = ids.indexOf(audience);
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % ids.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = ids.length - 1;
    else return;

    e.preventDefault();
    const nextId = ids[nextIdx];
    setAudience(nextId);
    tabRefs.current[nextId]?.focus();
  };

  return (
    <section id="who-its-for" className="py-20 border-t border-brand-200 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-500 mb-2">
                FOR AGENCIES, FOUNDERS &amp; SEO TEAMS
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-brand-950 leading-tight tracking-tight">
                Real crawls. Real data.<br />
                <span className="text-signal-400">No guesswork.</span>
              </h2>
            </div>
            <p className="text-base text-brand-500 leading-relaxed">
              The crawler renders every page the way Google does, snapshots your CMS before every publish for 1-click rollback, and locks verified month-end proof into zero-login white-label client portals.
            </p>

            {/* Interactive Role Switcher */}
            <div className="space-y-3">
              <div
                role="tablist"
                aria-label="Choose your team role"
                className="flex flex-nowrap overflow-x-auto border-b border-brand-200 gap-1"
              >
                {AUDIENCE_PROFILES.map((item) => {
                  const selected = item.id === audience;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        tabRefs.current[item.id] = el;
                      }}
                      id={`${baseId}-role-${item.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setAudience(item.id)}
                      onKeyDown={handleKeyDown}
                      className={cn(
                        "relative shrink-0 px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap",
                        selected
                          ? "text-brand-950 after:absolute after:inset-x-0 after:bottom-0 after:border-b-[3px] after:border-signal-400"
                          : "text-brand-500 hover:text-brand-900",
                      )}
                    >
                      {item.tabLabel}
                    </button>
                  );
                })}
              </div>

              <div
                role="tabpanel"
                aria-labelledby={`${baseId}-role-${activeAudience.id}`}
              >
                <div className="bg-surface-1 border border-brand-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-brand-950 leading-snug">
                      {activeAudience.headline}
                    </h3>
                    <p className="text-xs text-brand-500 leading-relaxed mt-1">
                      {activeAudience.summary}
                    </p>
                  </div>
                  <ul className="space-y-2 pt-1">
                    {activeAudience.highlights.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-xs text-brand-700">
                        <CheckCircle2 size={14} className="text-success-500 shrink-0 mt-0.5" />
                        <span className="leading-snug">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-1">
                    <Link
                      href={activeAudience.ctaHref}
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-950 underline decoration-signal-400 underline-offset-4 hover:gap-2 transition-all"
                    >
                      <span>{activeAudience.ctaLabel}</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical cards */}
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                {
                  title: "Headless Playwright crawler",
                  desc: "Renders Next.js, React, Shopify & Webflow on demand or on Daily, Weekly, Bi-weekly, or Monthly schedules.",
                },
                {
                  title: "Direct CMS & GitHub publishing",
                  desc: "Batch up to 15 safe fixes at once, save automatic BEFORE snapshots, and guard against regressions.",
                },
                {
                  title: "5 official AI vendor APIs",
                  desc: "ChatGPT, Claude, Gemini, Perplexity & Sarvam queried directly — unmeasured fields always say so.",
                },
                {
                  title: "Encrypted & HMAC-signed",
                  desc: "Tokens encrypted at rest, workspaces isolated, and outgoing Slack/Discord/REST alerts HMAC-SHA256 verified.",
                },
              ].map((card) => (
                <div key={card.title} className="bg-surface-1 border border-brand-200 rounded-xl p-3.5 space-y-0.5 shadow-2xs">
                  <h4 className="text-xs sm:text-sm font-bold text-brand-950">{card.title}</h4>
                  <p className="text-xs text-brand-500 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-signal-400 hover:bg-signal-500 active:scale-[0.98] text-signal-ink font-extrabold text-sm px-6 py-3 rounded-full transition-all shadow-xs cursor-pointer"
              >
                <span>Start free audit</span>
                <ArrowRight size={15} />
              </Link>
              <Link href="/pricing" className="text-sm font-bold text-brand-900 hover:text-brand-950 underline decoration-signal-400 underline-offset-4 transition-colors">
                See pricing &rarr;
              </Link>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:sticky lg:top-24">
            <FixRules />
          </div>
        </div>
      </div>
    </section>
  );
}
