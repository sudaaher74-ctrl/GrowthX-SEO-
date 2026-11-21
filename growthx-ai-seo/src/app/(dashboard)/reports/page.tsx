"use client";

import Link from "next/link";
import { ArrowRight, Code2, FileText } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/console";

/**
 * Every report in one place. Each document works completely standalone — with
 * executive scorecards, white-label PDF / Markdown / CSV exports, and a
 * universal stack-agnostic Implementation & Developer Handoff Guide so any
 * website owner, CMS editor, or web developer can ship every fix even without
 * Fix Engine.
 */
const REPORTS: { title: string; about: string; href: string; step?: number; badge?: string }[] = [
  {
    title: "Monthly Client Report",
    about: "Frozen historical monthly snapshots, executive commentary, zero-login white-label client portal links, and A4 PDF/CSV exports.",
    href: "/monthly-report",
    badge: "White-Label Portal",
  },
  {
    title: "Complete Improvement Plan",
    about: "Every verified opportunity across all modules ranked by impact, with evidence and clear execution steps.",
    href: "/reports/plan",
    badge: "Master Queue",
  },
  {
    title: "Website Audit Report",
    about: "Health scorecard, crawl diagnostics, and universal HTML / JSON-LD / 301 redirect implementation specs with QA verification checks.",
    href: "/website?tab=report",
    step: 1,
  },
  {
    title: "Traffic & Growth Intelligence",
    about: "Search Console + GA4 report with bot/datacenter noise detection, conversion blindspot audit, UTM kit, exact city gaps & evidence explorer.",
    href: "/google/report",
    step: 2,
  },
  {
    title: "Competitor Intelligence Report",
    about: "Rival comparison scorecard, copy-paste missing JSON-LD schema templates, and page-build content briefs with word-count benchmarks.",
    href: "/competitor-intelligence?tab=report",
    step: 3,
  },
  {
    title: "AI Visibility & Citation Report",
    about: "ChatGPT, Claude, Gemini, Perplexity & Sarvam citation matrix, question signal gaps, plus ready-to-deploy /llms.txt, robots.txt & FAQPage JSON-LD.",
    href: "/reports/ai-visibility",
    step: 4,
  },
  {
    title: "Backlinks & Authority Report",
    about: "Verified referring domains, broken target 301 redirect maps, lost-link recovery outreach emails, and link health verification.",
    href: "/reports/backlinks",
    step: 5,
  },
  {
    title: "Google Executive Summary (Printable)",
    about: "Compact client-ready Search Console & Analytics 4 overview formatted for instant white-label PDF printing.",
    href: "/reports/google",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Reports & Implementation Guides"
        subtitle="Executive-ready and developer-ready reports built strictly from your live measured data. Download as PDF, Markdown, or CSV — every report works standalone even if Fix Engine is not connected."
      />

      <Panel padded>
        <div className="flex items-start gap-3 text-[12px] text-brand-600">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
            <Code2 size={16} />
          </span>
          <div>
            <p className="font-bold text-brand-950">
              Built to hand directly to any developer, freelancer, or CMS editor
            </p>
            <p className="mt-0.5 leading-relaxed">
              Every report below includes a <strong>Universal Implementation &amp; Handoff Guide</strong> using standard HTML, JSON-LD, HTTP 301 redirect maps, <code className="font-mono">/llms.txt</code>, and QA checklists — with zero framework lock-in and zero fabricated figures.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group flex items-start gap-3 rounded-xl border border-brand-200 bg-surface-1 p-4 shadow-card transition-colors hover:border-primary-300"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <FileText size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-brand-950">
                {r.title}
                {r.step && (
                  <span className="rounded-full bg-brand-100 px-1.5 py-px font-mono text-[9.5px] text-brand-600">
                    step {r.step}
                  </span>
                )}
                {r.badge && (
                  <span className="rounded-full bg-primary-50 px-2 py-px font-mono text-[9.5px] font-semibold text-primary-700">
                    {r.badge}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-brand-500">{r.about}</span>
            </span>
            <ArrowRight size={14} className="mt-1 shrink-0 text-brand-300 group-hover:text-primary-600" />
          </Link>
        ))}
      </div>
    </div>
  );
}
