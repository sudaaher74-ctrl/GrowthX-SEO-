"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Lock,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { PublicSharedReportResponse } from "@/lib/api-types";
import { downloadCsvFile } from "@/lib/report-csv";

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat().format(value);
}

/**
 * Zero-Login White-Labeled Client Portal View.
 * Renders a frozen monthly snapshot by cryptographic share token without
 * exposing any internal workspace UI, navigation, or login prompts.
 */
export default function SharedMonthlyReportPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";

  const [report, setReport] = useState<PublicSharedReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void api.monthlyReports
      .getPublicShared(token)
      .then((res) => {
        if (!cancelled) {
          setReport(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "This shared report link is invalid or expired.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-8">
        <div className="rounded-2xl border border-brand-200 bg-surface-1 px-6 py-5 text-sm font-medium text-brand-600 shadow-card">
          Loading executive report…
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-brand-200 bg-surface-1 p-6 text-center shadow-card space-y-2">
          <AlertTriangle className="mx-auto h-8 w-8 text-warning-600" />
          <h1 className="text-base font-bold text-brand-950">Report Unavailable</h1>
          <p className="text-xs text-brand-600">{error || "This shared report could not be found."}</p>
        </div>
      </div>
    );
  }

  const { payload, agencyNotes, monthLabel, lockedAt } = report;
  const wl = payload.whiteLabel;
  const brandName = wl?.enabled && wl.agencyName ? wl.agencyName : "GrowthX / Reigel AI";
  const accent = wl?.enabled && wl.brandColor ? wl.brandColor : undefined;
  const kpis = payload.kpis ?? {};

  const handleExportCsv = () => {
    downloadCsvFile(`${payload.domain}-${payload.month}-executive-report.csv`, [
      {
        title: "Monthly KPIs",
        headers: ["Metric", "Value"],
        rows: [
          ["Search Clicks", kpis.clicks ?? ""],
          ["Impressions", kpis.impressions ?? ""],
          ["Website Sessions", kpis.sessions ?? ""],
          ["Site Health Score", kpis.healthScore ?? ""],
          ["AI Mention Share (%)", kpis.aiCitationSharePct ?? ""],
          ["Referring Domains", kpis.referringDomains ?? ""],
          ["Verified Fixes", kpis.verifiedFixes ?? payload.fixes?.length ?? 0],
          ["Regressions Caught", kpis.regressions ?? 0],
          ["Rollbacks", kpis.rollbacks ?? 0],
        ],
      },
      {
        title: "Top Keywords",
        headers: ["Query", "Clicks", "Impressions", "Avg Position"],
        rows: (payload.topKeywords ?? []).map((k) => [k.query, k.clicks, k.impressions, k.position]),
      },
      {
        title: "Verified Fixes",
        headers: ["Fix", "URL", "Element", "Status", "Verified At"],
        rows: (payload.fixes ?? []).map((f) => [f.title, f.url, f.field, f.status, f.verifiedAt ?? ""]),
      },
      {
        title: "Next Month Top Priorities",
        headers: ["Action", "Source", "Impact", "Effort", "Historical ROI"],
        rows: (payload.nextMonthPriorities ?? []).map((p) => [
          p.title,
          p.source,
          p.potential,
          p.effort,
          p.roiNote ?? "",
        ]),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-surface-2 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Action strip (hidden in print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-1 px-3 py-1 text-[11px] font-semibold text-brand-700 shadow-2xs">
            <Lock size={12} className="text-success-600" />
            <span>
              Frozen Client Snapshot · {new Date(lockedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-surface-2 cursor-pointer"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3.5 py-1.5 text-xs font-bold text-brand-50 hover:bg-brand-800 cursor-pointer"
            >
              <Printer size={13} />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Report Document */}
        <article
          id="report-root"
          className="rounded-2xl border border-brand-200 bg-surface-1 p-6 sm:p-10 shadow-card space-y-7"
          style={accent ? { borderTopWidth: "5px", borderTopColor: accent } : undefined}
        >
          {/* Header */}
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-200 pb-6">
            <div>
              {wl?.enabled && wl.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wl.logoUrl}
                  alt={brandName}
                  className="mb-3 max-h-10 max-w-[180px] object-contain"
                />
              )}
              <p
                className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-500"
                style={accent ? { color: accent } : undefined}
              >
                {brandName} · Monthly Executive Report
              </p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-brand-950">
                {payload.domain}
              </h1>
              <p className="mt-1 text-xs text-brand-500">{monthLabel}</p>
            </div>
            {wl?.enabled && wl.contactLine && (
              <p className="text-xs font-medium text-brand-600">{wl.contactLine}</p>
            )}
          </header>

          {/* KPI Strip */}
          <section className="report-section grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Search Clicks", value: fmt(kpis.clicks) },
              { label: "Impressions", value: fmt(kpis.impressions) },
              { label: "Website Sessions", value: fmt(kpis.sessions) },
              { label: "Site Health", value: kpis.healthScore != null ? `${kpis.healthScore}/100` : "—" },
              { label: "AI Mention Share", value: kpis.aiCitationSharePct != null ? `${kpis.aiCitationSharePct}%` : "—" },
              { label: "Referring Domains", value: fmt(kpis.referringDomains) },
              { label: "Verified Fixes", value: fmt(kpis.verifiedFixes ?? payload.fixes?.length ?? 0) },
              { label: "Regressions Caught", value: fmt(kpis.regressions ?? 0) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-500">{item.label}</p>
                <p className="mt-1 font-mono text-xl font-bold text-brand-950">{item.value}</p>
              </div>
            ))}
          </section>

          {/* 3-Column Executive Summary */}
          {payload.executiveSummary && (
            <section className="report-section grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: "Wins This Month", items: payload.executiveSummary.wins },
                { title: "Work Verified Live", items: payload.executiveSummary.workCompleted },
                { title: "Next Month Focus", items: payload.executiveSummary.nextMonthFocus },
              ].map((col) => (
                <div key={col.title} className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-brand-950">{col.title}</h2>
                  {col.items.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-brand-700 list-disc pl-4">
                      {col.items.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-brand-400">No measured entries recorded for this period.</p>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Account Manager Notes */}
          {agencyNotes.trim() && (
            <section className="report-section rounded-xl border border-brand-200 bg-surface-2/50 p-4 space-y-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand-950">Account Manager Commentary</h2>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-brand-700">{agencyNotes}</p>
            </section>
          )}

          {/* Top Keywords */}
          {payload.topKeywords && payload.topKeywords.length > 0 && (
            <section className="report-section space-y-2">
              <h2 className="text-sm font-bold text-brand-950">Top Search Keywords</h2>
              <div className="overflow-x-auto rounded-xl border border-brand-200">
                <table className="report-table w-full text-left text-xs">
                  <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-brand-500">
                    <tr>
                      <th className="px-3 py-2">Keyword</th>
                      <th className="px-3 py-2 text-right">Clicks</th>
                      <th className="px-3 py-2 text-right">Impressions</th>
                      <th className="px-3 py-2 text-right">Avg Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-200/60">
                    {payload.topKeywords.slice(0, 12).map((k) => (
                      <tr key={k.query}>
                        <td className="px-3 py-2 font-medium text-brand-950">{k.query}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(k.clicks)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(k.impressions)}</td>
                        <td className="px-3 py-2 text-right font-mono">#{Number(k.position).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Backlinks */}
          {payload.backlinks && (
            <section className="report-section space-y-2.5">
              <h2 className="text-sm font-bold text-brand-950">Backlinks &amp; Authority</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-lg border border-brand-200 p-3">
                  <p className="text-[10px] uppercase text-brand-500">Verified Links</p>
                  <p className="font-mono text-base font-bold text-brand-950">{fmt(payload.backlinks.totalVerified)}</p>
                </div>
                <div className="rounded-lg border border-brand-200 p-3">
                  <p className="text-[10px] uppercase text-brand-500">Referring Domains</p>
                  <p className="font-mono text-base font-bold text-brand-950">{fmt(payload.backlinks.referringDomains)}</p>
                </div>
                <div className="rounded-lg border border-brand-200 p-3">
                  <p className="text-[10px] uppercase text-brand-500">New Links</p>
                  <p className="font-mono text-base font-bold text-success-700">{fmt(payload.backlinks.newCount)}</p>
                </div>
                <div className="rounded-lg border border-brand-200 p-3">
                  <p className="text-[10px] uppercase text-brand-500">Lost Links</p>
                  <p className="font-mono text-base font-bold text-error-700">{fmt(payload.backlinks.lostCount)}</p>
                </div>
              </div>
            </section>
          )}

          {/* Verified Fixes */}
          {payload.fixes && payload.fixes.length > 0 && (
            <section className="report-section space-y-2">
              <h2 className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-success-600" />
                <span>Verified Website Changes</span>
              </h2>
              <div className="space-y-2">
                {payload.fixes.slice(0, 15).map((fix, idx) => (
                  <div
                    key={`${fix.url}-${fix.field}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200/80 bg-surface-2/40 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-brand-950">{fix.title}</p>
                      <p className="font-mono text-[11px] text-brand-500">{fix.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-success-50 border border-success-200 px-2 py-0.5 font-mono text-[10px] font-bold text-success-700">
                        {fix.status}
                      </span>
                      {fix.pullRequestUrl && (
                        <a
                          href={fix.pullRequestUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-700 hover:underline"
                        >
                          <span>PR</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Next Month Priorities */}
          {payload.nextMonthPriorities && payload.nextMonthPriorities.length > 0 && (
            <section className="report-section space-y-2">
              <h2 className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-primary-600" />
                <span>Next Month&apos;s Top 5 Highest-ROI Priorities</span>
              </h2>
              <div className="space-y-2">
                {payload.nextMonthPriorities.slice(0, 5).map((p, idx) => (
                  <div
                    key={`${p.title}-${idx}`}
                    className="rounded-xl border border-brand-200/80 bg-surface-1 p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-brand-950">{idx + 1}. {p.title}</p>
                      {p.roiNote && <p className="text-[11px] text-success-700 mt-0.5">{p.roiNote}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-brand-700">{p.source}</span>
                      <span className="rounded-md bg-success-50 px-2 py-0.5 font-bold text-success-700">{p.potential} IMPACT</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <footer className="border-t border-brand-200 pt-4 text-[11px] text-brand-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              {wl?.enabled && wl.footerText
                ? wl.footerText
                : `${brandName} — Verified telemetry deliverable. "—" means unmeasured, never zero.`}
            </span>
            <span>{payload.domain} · {payload.month}</span>
          </footer>
        </article>
      </div>
    </div>
  );
}
