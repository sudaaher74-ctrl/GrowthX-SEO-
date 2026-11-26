"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  GitPullRequest,
  Globe,
  Layers,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, type GrowthOpportunity } from "@/lib/api-client";
import type { BatchCmsFixItem, BatchCmsFixResponse } from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";

type CmsPlatform = "WORDPRESS" | "SHOPIFY" | "WEBFLOW";

function inferField(finding: GrowthOpportunity): string {
  const hay = `${finding.title} ${finding.recommendedAction}`.toLowerCase();
  if (hay.includes("meta description") || hay.includes("description")) return "META_DESCRIPTION";
  if (hay.includes("schema") || hay.includes("json-ld") || hay.includes("structured data")) return "JSON_LD";
  if (hay.includes("canonical")) return "CANONICAL";
  if (hay.includes("h1") || hay.includes("heading")) return "H1";
  return "META_TITLE";
}

function defaultTargetUrl(finding: GrowthOpportunity, domain: string | null): string {
  const first = finding.affectedPages?.[0];
  if (first && /^https?:\/\//i.test(first)) return first;
  if (first && domain) {
    const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return `https://${cleanDomain}${first.startsWith("/") ? first : `/${first}`}`;
  }
  return domain ? `https://${domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "")}/` : "";
}

export function BatchFixModal({
  projectId,
  domain,
  findings,
  onClose,
  onSuccessGitHub,
}: {
  projectId: string;
  domain: string | null;
  findings: GrowthOpportunity[];
  onClose: () => void;
  onSuccessGitHub?: () => void;
}) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<"GITHUB" | CmsPlatform>("GITHUB");
  const [publishMode, setPublishMode] = useState<"draft" | "publish">("draft");
  const [cmsResult, setCmsResult] = useState<BatchCmsFixResponse | null>(null);
  const [githubDone, setGithubDone] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [edits, setEdits] = useState<Record<string, { targetUrl: string; field: string; afterValue: string }>>(() => {
    const map: Record<string, { targetUrl: string; field: string; afterValue: string }> = {};
    for (const f of findings) {
      map[f.id] = {
        targetUrl: defaultTargetUrl(f, domain),
        field: inferField(f),
        afterValue: f.recommendedAction.slice(0, 300),
      };
    }
    return map;
  });

  const repoQuery = useQuery({
    queryKey: ["automation-repo", projectId],
    queryFn: () => api.getRepository(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

  const cmsQuery = useQuery({
    queryKey: ["cms-connections", projectId],
    queryFn: () => api.getAllCmsConnections(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

  const repository = repoQuery.data;
  const githubConnected = repository?.tokenConfigured === true && repository.reconnectRequired !== true;
  const githubReconnectRequired = Boolean(repository) && !githubConnected;
  const wpConnected = Boolean(cmsQuery.data?.wordpress?.connected);
  const shopifyConnected = Boolean(cmsQuery.data?.shopify?.connected);
  const webflowConnected = Boolean(cmsQuery.data?.webflow?.connected);

  const runGitHubBatch = useMutation({
    mutationFn: () =>
      api.runPlanFixes(projectId, {
        findingIds: findings.map((f) => f.id),
      }),
    onSuccess: (run) => {
      setErrorText(null);
      setGithubDone(
        `Queued unified GitHub PR run (${run.id.slice(0, 8)}) for ${findings.length} selected findings.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["automation-runs", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["findings", projectId] });
    },
    onError: (err) => setErrorText(errorMessage(err)),
  });

  const runCmsBatch = useMutation({
    mutationFn: (platform: CmsPlatform) => {
      const items: BatchCmsFixItem[] = findings.map((f) => {
        const draft = edits[f.id] ?? {
          targetUrl: defaultTargetUrl(f, domain),
          field: inferField(f),
          afterValue: f.recommendedAction.slice(0, 300),
        };
        return {
          findingId: f.id,
          targetUrl: draft.targetUrl,
          field: draft.field,
          afterValue: draft.afterValue,
          findingTitle: f.title,
          publishMode,
        };
      });
      return api.batchApplyCmsFixes(projectId, {
        platform,
        publishMode,
        items,
      });
    },
    onSuccess: (res) => {
      setErrorText(null);
      setCmsResult(res);
      void queryClient.invalidateQueries({ queryKey: ["findings", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["fix-proof-cards", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["fix-impact-ledger", projectId] });
    },
    onError: (err) => setErrorText(errorMessage(err)),
  });

  const isBusy = runGitHubBatch.isPending || runCmsBatch.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Batch apply selected SEO fixes"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-200 bg-surface-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-200 bg-surface-2 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
              <Layers size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-brand-950">
                Batch Safe Fix Execution ({findings.length} Selected)
              </h2>
              <p className="text-[11px] text-brand-500">
                Bundle selected findings into 1 unified GitHub Pull Request or 1 CMS batch with BEFORE snapshots &amp; 1-click rollback.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-brand-500 hover:bg-surface-3 hover:text-brand-950 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Deployment Target Selector */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
              1. Choose Deployment Target
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: "GITHUB", label: "GitHub (1 PR)", connected: githubConnected, icon: GitPullRequest },
                  { id: "WORDPRESS", label: "WordPress CMS", connected: wpConnected, icon: Globe },
                  { id: "SHOPIFY", label: "Shopify Admin", connected: shopifyConnected, icon: Globe },
                  { id: "WEBFLOW", label: "Webflow CMS", connected: webflowConnected, icon: Globe },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = target === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTarget(opt.id)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition cursor-pointer ${
                      active
                        ? "border-brand-950 bg-brand-50 shadow-2xs"
                        : "border-brand-200 bg-surface-1 hover:bg-surface-2"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <Icon size={14} className={active ? "text-brand-950" : "text-brand-500"} />
                      <span
                        className={`h-2 w-2 rounded-full ${
                          opt.connected ? "bg-success-500" : "bg-brand-300"
                        }`}
                      />
                    </div>
                    <span className="text-xs font-bold text-brand-950">{opt.label}</span>
                    <span className="text-[10px] font-mono text-brand-500">
                      {opt.id === "GITHUB" && githubReconnectRequired
                        ? "Reconnect required"
                        : opt.connected ? "Connected" : "Not connected"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {target === "GITHUB" && githubReconnectRequired && (
            <p className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-xs text-brand-800">
              Reconnect this repository with a fresh GitHub token to create pull requests.{" "}
              <Link href="/fix-engine?tab=github-fixes" onClick={onClose} className="font-semibold underline">
                Open GitHub setup
              </Link>
            </p>
          )}

          {/* CMS Draft / Publish selector */}
          {target !== "GITHUB" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-surface-2/70 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-brand-800">
                <ShieldCheck size={14} className="text-success-600" />
                <span>
                  Every CMS update stores a <strong>BEFORE snapshot</strong> so you can roll back any page in 1 click.
                </span>
              </div>
              <div className="inline-flex rounded-lg border border-brand-200 bg-surface-1 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setPublishMode("draft")}
                  className={`rounded-md px-2.5 py-1 cursor-pointer ${
                    publishMode === "draft" ? "bg-signal-400 text-signal-ink font-bold" : "text-brand-600"
                  }`}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode("publish")}
                  className={`rounded-md px-2.5 py-1 cursor-pointer ${
                    publishMode === "publish" ? "bg-signal-400 text-signal-ink font-bold" : "text-brand-600"
                  }`}
                >
                  Publish &amp; Verify Live
                </button>
              </div>
            </div>
          )}

          {/* Selected Findings Preview / Per-Item CMS Payload Editor */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
              2. Review Findings in This Batch ({findings.length})
            </p>
            <div className="divide-y divide-brand-200/70 rounded-xl border border-brand-200 bg-surface-1">
              {findings.map((f) => {
                const draft = edits[f.id] ?? {
                  targetUrl: defaultTargetUrl(f, domain),
                  field: inferField(f),
                  afterValue: f.recommendedAction.slice(0, 300),
                };
                return (
                  <div key={f.id} className="p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-brand-950">{f.title}</span>
                      <span className="rounded bg-surface-2 border border-brand-200 px-1.5 py-0.5 font-mono text-[10px] text-brand-600">
                        {f.fixClass || "AUTO"} · {f.potential}
                      </span>
                    </div>
                    {target !== "GITHUB" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={draft.targetUrl}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [f.id]: { ...draft, targetUrl: e.target.value },
                            }))
                          }
                          placeholder="https://example.com/page"
                          className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] text-brand-900"
                        />
                        <select
                          value={draft.field}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [f.id]: { ...draft, field: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1.5 text-[11px] font-semibold text-brand-900"
                        >
                          <option value="META_TITLE">Meta Title</option>
                          <option value="META_DESCRIPTION">Meta Description</option>
                          <option value="H1">H1 Heading</option>
                          <option value="CANONICAL">Canonical URL</option>
                          <option value="JSON_LD">JSON-LD Schema</option>
                        </select>
                        <input
                          type="text"
                          value={draft.afterValue}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [f.id]: { ...draft, afterValue: e.target.value },
                            }))
                          }
                          placeholder="Exact value to apply"
                          className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1.5 text-[11px] text-brand-900"
                        />
                      </div>
                    ) : (
                      <p className="text-[11px] text-brand-500 line-clamp-2">{f.recommendedAction}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {errorText && (
            <div className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 p-3 text-xs text-error-800">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-error-600" />
              <span>{errorText}</span>
            </div>
          )}

          {githubDone && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-success-200 bg-success-50 p-3 text-xs text-success-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-success-600 shrink-0" />
                <span>{githubDone}</span>
              </div>
              {onSuccessGitHub && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSuccessGitHub();
                  }}
                  className="rounded-lg bg-signal-400 px-2.5 py-1 text-[11px] font-bold text-signal-ink hover:bg-signal-500 cursor-pointer"
                >
                  Open Fixes &amp; Log →
                </button>
              )}
            </div>
          )}

          {cmsResult && (
            <div className="rounded-xl border border-brand-200 bg-surface-2/60 p-3.5 space-y-2 text-xs">
              <p className="font-bold text-brand-950">
                {cmsResult.platform} Batch Complete: {cmsResult.applied}/{cmsResult.total} applied
                {cmsResult.failed > 0 ? ` (${cmsResult.failed} failed)` : ""}
              </p>
              <div className="space-y-1">
                {cmsResult.results.map((r, idx) => (
                  <div
                    key={`${r.targetUrl}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-brand-200/70 bg-surface-1 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="truncate font-mono text-brand-800">
                      {r.field} · {r.targetUrl}
                    </span>
                    <span
                      className={`font-semibold shrink-0 ${
                        r.status === "APPLIED" ? "text-success-700" : "text-error-700"
                      }`}
                    >
                      {r.status === "APPLIED" ? "Applied ✓" : r.error || "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-brand-200 bg-surface-2 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-brand-200 bg-surface-1 px-3.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-surface-2 cursor-pointer"
          >
            Close
          </button>

          {target === "GITHUB" ? (
            <button
              type="button"
              disabled={isBusy || !githubConnected}
              onClick={() => runGitHubBatch.mutate()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-2 text-xs font-bold text-signal-ink hover:bg-signal-500 transition cursor-pointer disabled:opacity-50"
            >
              {runGitHubBatch.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <GitPullRequest size={13} />
              )}
              <span>
                {runGitHubBatch.isPending
                  ? "Preparing Unified PR…"
                  : `Create 1 Unified PR (${findings.length} Fixes)`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={
                isBusy ||
                (target === "WORDPRESS" && !wpConnected) ||
                (target === "SHOPIFY" && !shopifyConnected) ||
                (target === "WEBFLOW" && !webflowConnected)
              }
              onClick={() => runCmsBatch.mutate(target)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-2 text-xs font-bold text-signal-ink hover:bg-signal-500 transition cursor-pointer disabled:opacity-50"
            >
              {runCmsBatch.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Globe size={13} />
              )}
              <span>
                {runCmsBatch.isPending
                  ? `Applying to ${target}…`
                  : `Apply ${findings.length} Fixes to ${target} (${publishMode})`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
