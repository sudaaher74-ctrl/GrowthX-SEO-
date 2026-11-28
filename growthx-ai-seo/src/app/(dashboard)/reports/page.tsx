"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Code2, Download, FileText, Loader2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { buildAllInOnePlaybookMarkdown } from "@/lib/implementation-specs";

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
    about: "Master cross-module execution report with priority matrix, universal implementation briefs, Markdown/CSV/PDF exports, and Fix Engine sync.",
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
    href: "/google?tab=report",
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
];

export default function ReportsPage() {
  const { projectId, projects } = useWorkspace();
  const domain = projects.find((p) => p.id === projectId)?.name ?? "website";
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleDownloadMasterPlaybook = async () => {
    if (!projectId || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const [
        auditRes,
        googleRes,
        compRes,
        visRes,
        visInsightsRes,
        questionRes,
        backlinksRes,
        outreachRes,
        findingsRes,
      ] = await Promise.allSettled([
        api.getLatestAuditReport(projectId),
        api.getLatestGoogleReport(projectId),
        api.getLatestCompetitorReport(projectId),
        api.getVisibility(projectId, 28),
        api.getVisibilityInsights(projectId),
        api.getQuestionAnalysis(projectId),
        api.backlinks.report(projectId, 0),
        api.backlinkOutreach.list(projectId),
        api.findings(projectId, { limit: 200 }),
      ]);

      const md = buildAllInOnePlaybookMarkdown({
        domain,
        auditReport: auditRes.status === "fulfilled" ? auditRes.value : null,
        googleReport: googleRes.status === "fulfilled" ? googleRes.value : null,
        competitorReport: compRes.status === "fulfilled" ? compRes.value : null,
        visibilityReport: visRes.status === "fulfilled" ? visRes.value : null,
        visibilityInsights: visInsightsRes.status === "fulfilled" ? visInsightsRes.value : null,
        questionAnalysis: questionRes.status === "fulfilled" ? questionRes.value : null,
        backlinkReport: backlinksRes.status === "fulfilled" ? backlinksRes.value : null,
        backlinkOutreach: outreachRes.status === "fulfilled" ? outreachRes.value?.items ?? [] : null,
        findings: findingsRes.status === "fulfilled" ? findingsRes.value.items : null,
      });

      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${domain.replace(/[^a-z0-9.-]+/gi, "-")}-complete-seo-playbook.md`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Could not assemble master playbook.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Reports & Implementation Guides"
        subtitle="Executive-ready and developer-ready reports built strictly from your live measured data. Download as PDF, Markdown, or CSV — every report works standalone even if Fix Engine is not connected."
        actions={
          <button
            type="button"
            disabled={!projectId || exporting}
            onClick={handleDownloadMasterPlaybook}
            className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 px-4 py-2 text-[12px] font-bold text-signal-ink shadow-xs transition hover:bg-signal-500 disabled:opacity-50 cursor-pointer"
          >
            {exporting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Bundling Playbook…</span>
              </>
            ) : exported ? (
              <>
                <Check size={13} />
                <span>Playbook Downloaded</span>
              </>
            ) : (
              <>
                <Download size={13} />
                <span>Download All-in-One Playbook (.md)</span>
              </>
            )}
          </button>
        }
      />

      {exportError && (
        <div role="alert" className="rounded-xl border border-error-500/40 bg-error-50 px-4 py-2.5 text-xs font-medium text-error-700">
          {exportError}
        </div>
      )}

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
              Every report below includes a <strong>Universal Implementation &amp; Handoff Guide</strong> using standard HTML, JSON-LD, HTTP 301 redirect maps, <code className="font-mono">/llms.txt</code>, and QA checklists — with zero framework lock-in and zero fabricated figures. Use <strong>Download All-in-One Playbook (.md)</strong> above to bundle all modules into one master document.
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
