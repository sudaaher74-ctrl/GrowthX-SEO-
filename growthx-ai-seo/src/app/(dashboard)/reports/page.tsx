"use client";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/console";

/**
 * Every report in one place. Each one is a document you can read here and save
 * as a PDF, and each works on its own, so a report is available even when the
 * Fix Engine is not.
 */
const REPORTS: { title: string; about: string; href: string; step?: number }[] = [
  { title: "Complete improvement plan", about: "Everything found across all tabs, ranked by impact, with the evidence and what to do.", href: "/reports/plan" },
  { title: "Website Audit", about: "Your crawl: health score, problems by severity, and the pages affected.", href: "/website?tab=report", step: 1 },
  { title: "Google", about: "Search Console and Analytics: traffic, queries, channels, alerts and index status.", href: "/reports/google", step: 2 },
  { title: "Competitor Intelligence", about: "How your competitors compare and where they are ahead.", href: "/competitor-intelligence?tab=report", step: 3 },
  { title: "AI Visibility", about: "Whether ChatGPT, Gemini, Perplexity and Claude name you, and how to improve.", href: "/reports/ai-visibility", step: 4 },
];

export default function ReportsPage() {
  return (
    <div className="space-y-4 pb-12">
      <PageHeader title="Reports" subtitle="Read or save as PDF. Each report uses your latest data and shows what could not be measured instead of guessing." />
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="group flex items-start gap-3 rounded-xl border bg-white p-4 shadow-card transition-colors hover:border-primary-300">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><FileText size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-brand-950">
                {r.title}
                {r.step && <span className="rounded-full bg-brand-100 px-1.5 py-px font-mono text-[9.5px] text-brand-500">step {r.step}</span>}
              </span>
              <span className="mt-0.5 block text-[12px] text-brand-500">{r.about}</span>
            </span>
            <ArrowRight size={14} className="mt-1 shrink-0 text-brand-300 group-hover:text-primary-600" />
          </Link>
        ))}
      </div>
    </div>
  );
}
