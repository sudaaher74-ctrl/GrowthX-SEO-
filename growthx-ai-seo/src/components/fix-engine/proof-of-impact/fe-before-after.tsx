"use client";

import { useState } from "react";
import {
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  GitPullRequest,
  FileCode,
  Layout,
  FileText,
  Sliders,
} from "lucide-react";
import { Panel, Pill, Tabs, Table, Th } from "@/components/ui/console";
import type { FixDetailData } from "@/lib/api-types";

export function FixEngineBeforeAfterView({
  detail,
  onVerifyDeployment,
  isVerifying,
}: {
  detail: FixDetailData | null;
  onVerifyDeployment: (runId: string) => void;
  isVerifying: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"VISUAL" | "CONTENT" | "TECHNICAL" | "CODE">("CONTENT");

  if (!detail) {
    return (
      <Panel title="Before &amp; After Comparison" subtitle="Select a fix to inspect evidence" padded>
        <div className="p-12 text-center text-xs text-brand-500">
          Please select a fix from the Fix History tab or Overview dashboard to inspect before-and-after evidence.
        </div>
      </Panel>
    );
  }

  const { run, visual, content, technical, code, attribution, aiSummary, regressions } = detail;

  return (
    <div className="space-y-6">
      {/* Fix Header & Deployment Verification Status */}
      <div className="rounded-xl border bg-white p-4 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-brand-950">{run.affectedUrl}</h2>
              <Pill tone={run.status === "MERGED" ? "good" : "warn"}>{run.status}</Pill>
            </div>
            <p className="mt-0.5 text-xs text-brand-500">
              Run ID: <span className="font-mono">{run.id}</span> · Started:{" "}
              {new Date(run.startedAt).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {run.pullRequestUrl && (
              <a
                href={run.pullRequestUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              >
                <GitPullRequest size={13} /> View PR
              </a>
            )}
            <button
              onClick={() => onVerifyDeployment(run.id)}
              disabled={isVerifying}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
            >
              <RefreshCw size={13} className={isVerifying ? "animate-spin" : ""} />
              {isVerifying ? "Verifying..." : "Verify Live Website"}
            </button>
          </div>
        </div>

        {/* AI Synthesis Summary */}
        {aiSummary && (
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-800">
            <span className="font-semibold text-brand-950">Evidence Synthesis: </span>
            {aiSummary}
          </div>
        )}
      </div>

      {/* 4 Comparison Tabs */}
      <Tabs
        tabs={[
          { id: "VISUAL", label: "Visual", icon: Layout },
          { id: "CONTENT", label: "Content", icon: FileText },
          { id: "TECHNICAL", label: "Technical SEO", icon: Sliders },
          { id: "CODE", label: "Code Changes", icon: FileCode },
        ]}
        active={activeTab}
        onChange={(tab) => setActiveTab(tab)}
      />

      {/* Tab 1: Visual Comparison */}
      {activeTab === "VISUAL" && (
        <Panel
          title="Visual Side-by-Side Comparison"
          subtitle="Screenshots captured by the crawler before and after technical modification"
          padded
        >
          {visual.available && (visual.before.screenshotUrl || visual.after.screenshotUrl) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-brand-700">
                  <span>Before Fix</span>
                  <span className="text-[10px] text-brand-400 font-mono">
                    {visual.before.capturedAt ? new Date(visual.before.capturedAt).toLocaleString() : "Crawl baseline"}
                  </span>
                </div>
                {visual.before.screenshotUrl ? (
                  <img
                    src={visual.before.screenshotUrl}
                    alt="Before fix screenshot"
                    className="w-full rounded border bg-brand-50 object-contain max-h-96"
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-brand-400 border border-dashed rounded">
                    Historical before-fix screenshot unavailable
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-brand-700">
                  <span>After Fix (Live Verified)</span>
                  <span className="text-[10px] text-brand-400 font-mono">
                    {visual.after.capturedAt ? new Date(visual.after.capturedAt).toLocaleString() : "Latest crawl"}
                  </span>
                </div>
                {visual.after.screenshotUrl ? (
                  <img
                    src={visual.after.screenshotUrl}
                    alt="After fix screenshot"
                    className="w-full rounded border bg-brand-50 object-contain max-h-96"
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-brand-400 border border-dashed rounded">
                    Live verification screenshot unavailable
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-brand-500 border border-dashed rounded-lg">
              Visual comparison unavailable for this fix. (Static code/metadata fixes don&apos;t alter layout).
            </div>
          )}
        </Panel>
      )}

      {/* Tab 2: Content Comparison */}
      {activeTab === "CONTENT" && (
        <Panel
          title="Content Difference Breakdown"
          subtitle="Verifiable diff across page title, meta description, H1 heading, and robots directives"
          padded
        >
          <div className="space-y-4">
            {content.map((item) => (
              <div key={item.field} className="rounded-lg border p-3 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-brand-900">{item.label}</span>
                  <Pill tone={item.status === "MODIFIED" ? "good" : "default"}>{item.status}</Pill>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded bg-error-50/70 border border-error-100 p-2 font-mono text-error-800 break-words">
                    <span className="block font-sans text-[10px] font-bold text-error-600 uppercase mb-1">
                      Before Fix
                    </span>
                    {item.before || "<not set>"}
                  </div>
                  <div className="rounded bg-success-50/70 border border-success-100 p-2 font-mono text-success-800 break-words">
                    <span className="block font-sans text-[10px] font-bold text-success-600 uppercase mb-1">
                      After Fix
                    </span>
                    {item.after || "<not set>"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Tab 3: Technical SEO Comparison */}
      {activeTab === "TECHNICAL" && (
        <Panel
          title="Technical SEO Signals"
          subtitle="Audit results comparing pre-fix crawl baseline with post-deployment verification"
          padded
        >
          <Table minWidth={600}>
            <thead>
              <tr>
                <Th>Technical SEO Metric</Th>
                <Th>Before Fix</Th>
                <Th>After Fix (Verified)</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {technical.map((metric, i) => (
                <tr key={i} className="hover:bg-brand-50/50">
                  <td className="px-4 py-3 font-medium text-brand-900">{metric.metric}</td>
                  <td className="px-4 py-3 font-mono text-brand-600">{metric.before}</td>
                  <td className="px-4 py-3 font-mono text-brand-900 font-semibold">{metric.after}</td>
                  <td className="px-4 py-3 text-right">
                    <Pill
                      tone={
                        metric.status === "IMPROVED"
                          ? "good"
                          : metric.status === "REGRESSED"
                          ? "bad"
                          : "default"
                      }
                    >
                      {metric.status}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {regressions.length > 0 && (
            <div className="mt-4 rounded-lg border border-error-200 bg-error-50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-error-800">
                <AlertTriangle size={14} /> Regression Detected Post-Fix
              </div>
              {regressions.map((reg) => (
                <p key={reg.id} className="text-xs text-error-700">
                  {reg.title}: {reg.description}
                </p>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Tab 4: Code Comparison */}
      {activeTab === "CODE" && (
        <Panel
          title="GitHub Code Diff &amp; Commit Record"
          subtitle="Transparent repository history committed by Reigel Fix Engine"
          padded
        >
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap gap-4 text-brand-700 border-b pb-3 font-mono text-[11px]">
              {code.branch && (
                <div>
                  <span className="text-brand-400">Branch: </span>
                  {code.branch}
                </div>
              )}
              {code.commitSha && (
                <div>
                  <span className="text-brand-400">Commit: </span>
                  {code.commitSha.slice(0, 7)}
                </div>
              )}
              {code.filesChanged && code.filesChanged.length > 0 && (
                <div>
                  <span className="text-brand-400">Files: </span>
                  {code.filesChanged.join(", ")}
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-brand-950 p-4 font-mono text-[11px] text-brand-100 overflow-x-auto whitespace-pre">
              {code.diffSummary}
            </div>

            {code.pullRequestUrl && (
              <div className="pt-2">
                <a
                  href={code.pullRequestUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary-600 font-semibold hover:underline"
                >
                  Inspect Pull Request on GitHub <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Evidence & Impact Attribution Summary */}
      <Panel
        title="3-Level Impact Attribution"
        subtitle="Transparent boundary between verified facts, observed changes, and causal modeling"
        padded
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-brand-800">Level 1: Technical</span>
              <Pill tone={attribution.level1.status === "VERIFIED" ? "good" : "default"}>
                {attribution.level1.status}
              </Pill>
            </div>
            <p className="text-[11px] text-brand-600">{attribution.level1.detail}</p>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-brand-800">Level 2: Observed</span>
              <Pill tone={attribution.level2.status === "OBSERVED" ? "good" : "default"}>
                {attribution.level2.status}
              </Pill>
            </div>
            <p className="text-[11px] text-brand-600">{attribution.level2.detail}</p>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-brand-800">Level 3: Causal</span>
              <Pill tone="default">{attribution.level3.status}</Pill>
            </div>
            <p className="text-[11px] text-brand-600">{attribution.level3.detail}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
