"use client";

import { useState } from "react";
import { CheckCircle2, TrendingUp, AlertTriangle, ArrowRight, ShieldCheck, Clock, ExternalLink } from "lucide-react";
import { Kpi, Panel, Pill } from "@/components/ui/console";
import type { FixEngineOverviewData, FixHistoryItem } from "@/lib/api-types";

export function FixEngineOverviewView({
  data,
  onSelectFix,
}: {
  data: FixEngineOverviewData;
  onSelectFix: (runId: string) => void;
}) {
  const { kpis, statusBreakdown, performanceTrend, recentFixes, opportunities, regressionAlerts } = data;
  const [activeWindow, setActiveWindow] = useState<"ALL" | "28D">("28D");

  return (
    <div className="space-y-6">
      {/* 6 Top KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Verified Fixes"
          value={String(kpis.verifiedFixes)}
          tone={kpis.verifiedFixes > 0 ? "good" : "default"}
          sub="Deployed & verified live"
        />
        <Kpi
          label="Pages Improved"
          value={String(kpis.pagesImproved)}
          tone="default"
          sub="Distinct live URLs fixed"
        />
        <Kpi
          label="Active Fixes"
          value={String(kpis.activeFixes)}
          tone="default"
          sub="In pipeline or review"
        />
        <Kpi
          label="Regressions"
          value={String(kpis.regressionsDetected)}
          tone={kpis.regressionsDetected > 0 ? "danger" : "good"}
          sub={kpis.regressionsDetected > 0 ? "Requires investigation" : "Zero defects detected"}
        />
        <Kpi
          label="Search Change"
          value={kpis.organicSearchChangePct != null ? `${kpis.organicSearchChangePct > 0 ? "+" : ""}${kpis.organicSearchChangePct}%` : "—"}
          tone={kpis.organicSearchChangePct && kpis.organicSearchChangePct > 0 ? "good" : "default"}
          sub={kpis.organicClicksDelta !== 0 ? `${kpis.organicClicksDelta > 0 ? "+" : ""}${kpis.organicClicksDelta} clicks` : "28d vs baseline"}
        />
        <Kpi
          label="AI Visibility"
          value={kpis.aiVisibilityChangePt != null ? `${kpis.aiVisibilityChangePt > 0 ? "+" : ""}${kpis.aiVisibilityChangePt} pt` : "—"}
          tone={kpis.aiVisibilityChangePt && kpis.aiVisibilityChangePt > 0 ? "good" : "default"}
          sub={kpis.aiVisibilityScore != null ? `Score: ${kpis.aiVisibilityScore}/100` : "5 model families"}
        />
      </div>

      {/* Main Content: Performance Trend (Left) & Fix Status Breakdown (Right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Observed Search Performance Trend"
            subtitle="Real Google Search Console daily clicks on fixed pages with deployment milestone markers"
            padded
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-brand-500">
                <span className="font-mono">Observed performance change (not statistical proof of causality)</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setActiveWindow("28D")}
                    className={`rounded-md px-2 py-0.5 font-medium transition ${activeWindow === "28D" ? "bg-primary-600 text-white" : "border text-brand-600 hover:bg-brand-50"}`}
                  >
                    Last 28 Days
                  </button>
                  <button
                    onClick={() => setActiveWindow("ALL")}
                    className={`rounded-md px-2 py-0.5 font-medium transition ${activeWindow === "ALL" ? "bg-primary-600 text-white" : "border text-brand-600 hover:bg-brand-50"}`}
                  >
                    All Monitored
                  </button>
                </div>
              </div>

              {performanceTrend.length > 0 ? (
                <div className="space-y-2">
                  <div className="h-44 w-full flex items-end gap-1.5 pt-4 pb-2 border-b">
                    {performanceTrend.slice(-28).map((point, idx) => {
                      const maxClicks = Math.max(...performanceTrend.map((p) => p.clicks), 10);
                      const heightPct = Math.round((point.clicks / maxClicks) * 100);
                      const hasMilestone = point.milestones && point.milestones.length > 0;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center group relative">
                          {hasMilestone && (
                            <div className="absolute -top-6 text-[10px] bg-primary-700 text-white font-mono px-1 py-0.5 rounded shadow whitespace-nowrap z-10 hidden group-hover:block">
                              🚀 Fix Deployed ({point.milestones.join(", ")})
                            </div>
                          )}
                          <div
                            className={`w-full rounded-t transition-all ${
                              hasMilestone
                                ? "bg-primary-600 ring-2 ring-primary-300 ring-offset-1"
                                : "bg-primary-100 hover:bg-primary-200"
                            }`}
                            style={{ height: `${Math.max(heightPct, 6)}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[11px] text-brand-400 font-mono">
                    <span>{performanceTrend[0]?.date || "Baseline"}</span>
                    <span>Recent (PST Google Grain)</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-xs text-brand-500">
                  Search Console metrics for affected pages will appear here once fixes are deployed and crawled.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div>
          <Panel title="Fix Status Breakdown" subtitle="Current distribution across deployment pipeline" padded>
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="flex items-center gap-2 text-xs font-medium text-brand-700">
                  <CheckCircle2 size={14} className="text-success-600" />
                  Verified on Live Site
                </span>
                <span className="font-mono text-xs font-bold text-success-700">{statusBreakdown.verified}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="flex items-center gap-2 text-xs font-medium text-brand-700">
                  <Clock size={14} className="text-warning-600" />
                  Awaiting PR Approval
                </span>
                <span className="font-mono text-xs font-bold text-warning-700">{statusBreakdown.awaitingApproval}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="flex items-center gap-2 text-xs font-medium text-brand-700">
                  <TrendingUp size={14} className="text-primary-600" />
                  In Progress / Deploying
                </span>
                <span className="font-mono text-xs font-bold text-primary-700">{statusBreakdown.inProgress}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="flex items-center gap-2 text-xs font-medium text-brand-700">
                  <AlertTriangle size={14} className="text-error-600" />
                  Active Regressions
                </span>
                <span className="font-mono text-xs font-bold text-error-700">{statusBreakdown.regressions}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-2 text-xs font-medium text-brand-500">
                  Failed Pipeline Runs
                </span>
                <span className="font-mono text-xs text-brand-500">{statusBreakdown.failed}</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* Row 2: Recent Fixes with quick drill-down */}
      <Panel
        title="Recent Fix Engine Actions"
        subtitle="Chronological trail from proposed PR to verified live deployment"
        padded
      >
        {recentFixes.length > 0 ? (
          <div className="divide-y">
            {recentFixes.slice(0, 5).map((fix: FixHistoryItem) => (
              <div key={fix.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-900">{fix.title}</span>
                    <Pill
                      tone={
                        fix.verificationStatus === "VERIFIED"
                          ? "good"
                          : fix.verificationStatus === "AWAITING_APPROVAL"
                          ? "warn"
                          : "default"
                      }
                    >
                      {fix.verificationStatus}
                    </Pill>
                    <span className="text-[11px] font-mono text-brand-400">
                      {fix.date ? new Date(fix.date).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  <div className="text-[11px] text-brand-500 flex items-center gap-2">
                    <span className="font-mono truncate max-w-sm">{fix.affectedPage}</span>
                    {fix.pullRequestUrl && (
                      <a
                        href={fix.pullRequestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-600 hover:underline flex items-center gap-1"
                      >
                        PR <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onSelectFix(fix.runId)}
                  className="inline-flex items-center gap-1 self-start sm:self-center text-xs font-semibold text-primary-600 hover:text-primary-700"
                >
                  View Evidence <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-brand-500">
            No fixes have been opened yet. Run the Autonomous Engineer to propose technical SEO improvements.
          </div>
        )}
      </Panel>

      {/* Row 3 & 4: Impact Opportunities & Regression Alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="High-ROI Impact Opportunities"
          subtitle="Identified SEO & structured data problems awaiting action"
          padded
        >
          {opportunities.length > 0 ? (
            <div className="space-y-2.5">
              {opportunities.slice(0, 4).map((opp) => (
                <div key={opp.id} className="flex items-start justify-between rounded-lg border p-3 bg-brand-50/50">
                  <div>
                    <div className="text-xs font-bold text-brand-900">{opp.title}</div>
                    <div className="text-[11px] text-brand-500 mt-0.5">{opp.potentialImpact}</div>
                  </div>
                  <Pill tone="warn">{opp.category}</Pill>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-brand-500">All current recommendations addressed.</p>
          )}
        </Panel>

        <Panel
          title="Regression Alerts"
          subtitle="Real-time post-deployment monitoring on live crawled pages"
          padded
        >
          {regressionAlerts.length > 0 ? (
            <div className="space-y-2.5">
              {regressionAlerts.map((alert) => (
                <div key={alert.id} className="rounded-lg border border-error-200 bg-error-50/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-error-800 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> {alert.title}
                    </span>
                    <Pill tone="bad">{alert.severity}</Pill>
                  </div>
                  <p className="text-[11px] text-error-700 mt-1">{alert.description}</p>
                  <div className="text-[10px] font-mono text-error-600 mt-1 truncate">{alert.url}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-xs text-success-700 p-2">
              <ShieldCheck size={16} className="text-success-600" />
              Zero regressions detected on verified pages. All SEO signals remain healthy.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
