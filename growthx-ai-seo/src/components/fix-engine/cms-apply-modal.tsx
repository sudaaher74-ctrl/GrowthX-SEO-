"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Globe,
  Layers,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  WordPressConnectModal,
  type CmsConnectPlatform,
} from "@/components/settings/wordpress-connect-modal";
import { api, type GrowthOpportunity } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

type ApplyMode = "DIRECT_CMS_API" | "GUIDED_COPY";
type CmsPlatform = "WordPress" | "Shopify" | "Webflow" | "Custom CMS";

function inferDefaultField(finding?: GrowthOpportunity | null): string {
  const text = `${finding?.title || ""} ${finding?.recommendedAction || ""}`.toLowerCase();
  if (text.includes("sitemap") || text.includes("robots.txt")) {
    return "CODE_AND_SEO_UPDATE";
  }
  if (text.includes("schema") || text.includes("json-ld") || text.includes("faq")) {
    return "FAQ_SCHEMA";
  }
  if (text.includes("meta description") || text.includes("description")) {
    return "META_DESCRIPTION";
  }
  return "META_TITLE";
}

function inferDefaultProposal(
  finding?: GrowthOpportunity | null,
  domain?: string | null,
): string {
  if (!finding) return "";
  const text = `${finding.title || ""} ${finding.recommendedAction || ""}`.toLowerCase();
  if (text.includes("sitemap") && domain) {
    const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return `https://${cleanDomain}`;
  }
  const field = inferDefaultField(finding);
  if (field === "FAQ_SCHEMA") {
    return JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: finding.title,
            acceptedAnswer: {
              "@type": "Answer",
              text: finding.recommendedAction,
            },
          },
        ],
      },
      null,
      2,
    );
  }
  return finding.recommendedAction || finding.summary || finding.title || "";
}

export function CmsApplyModal({
  projectId,
  domain,
  finding,
  onClose,
  onApplied,
}: {
  projectId: string;
  domain?: string | null;
  finding?: GrowthOpportunity | null;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ApplyMode>("DIRECT_CMS_API");
  const [apiPlatform, setApiPlatform] = useState<CmsConnectPlatform>("wordpress");
  const [showConnectModal, setShowConnectModal] = useState(false);

  const defaultUrl =
    finding?.affectedPages?.[0] ||
    (domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "");

  const [targetUrl, setTargetUrl] = useState(defaultUrl);
  const [field, setField] = useState(inferDefaultField(finding));
  const [beforeValue] = useState(finding?.evidence?.[0]?.value || "");
  const [afterValue, setAfterValue] = useState(inferDefaultProposal(finding, domain));
  const [publishMode, setPublishMode] = useState<"draft" | "publish">("draft");
  const [platform, setPlatform] = useState<CmsPlatform>("WordPress");
  const [copied, setCopied] = useState(false);

  const wpConnection = useQuery({
    queryKey: ["wordpress-connection", projectId],
    queryFn: () => api.getWordPressConnection(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

  const shopifyConnection = useQuery({
    queryKey: ["shopify-connection", projectId],
    queryFn: () => api.getShopifyConnection(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

  const webflowConnection = useQuery({
    queryKey: ["webflow-connection", projectId],
    queryFn: () => api.getWebflowConnection(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["findings", projectId] });
    queryClient.invalidateQueries({ queryKey: ["impact-proof-cards", projectId] });
    queryClient.invalidateQueries({ queryKey: ["impact-ledger-stream", projectId] });
    queryClient.invalidateQueries({ queryKey: ["automation-runs", projectId] });
    onApplied?.();
  };

  const stageWpMutation = useMutation({
    mutationFn: () =>
      api.stageWordPressFix(projectId, {
        findingId: finding?.id,
        targetUrl,
        field,
        beforeValue: beforeValue || undefined,
        afterValue,
        findingTitle: finding?.title,
        publishMode,
      }),
    onSuccess: invalidateAll,
  });

  const stageShopifyMutation = useMutation({
    mutationFn: () =>
      api.stageShopifyFix(projectId, {
        findingId: finding?.id,
        targetUrl,
        field,
        beforeValue: beforeValue || undefined,
        afterValue,
        findingTitle: finding?.title,
      }),
    onSuccess: invalidateAll,
  });

  const stageWebflowMutation = useMutation({
    mutationFn: () =>
      api.stageWebflowFix(projectId, {
        findingId: finding?.id,
        targetUrl,
        field,
        beforeValue: beforeValue || undefined,
        afterValue,
        findingTitle: finding?.title,
      }),
    onSuccess: invalidateAll,
  });

  const verifyManualMutation = useMutation({
    mutationFn: () =>
      api.verifyManualCmsFix(projectId, {
        findingId: finding?.id,
        targetUrl,
        field,
        beforeValue: beforeValue || undefined,
        expectedAfterValue: afterValue,
        findingTitle: finding?.title,
        platform,
      }),
    onSuccess: invalidateAll,
  });

  const handleCopy = async () => {
    if (!afterValue) return;
    try {
      await navigator.clipboard.writeText(afterValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const isWpConnected = Boolean(wpConnection.data?.connected);
  const isShopifyConnected = Boolean(shopifyConnection.data?.connected);
  const isWebflowConnected = Boolean(webflowConnection.data?.connected);

  if (showConnectModal) {
    return (
      <WordPressConnectModal
        projectId={projectId}
        defaultSiteUrl={defaultUrl}
        existingSiteUrl={wpConnection.data?.siteUrl}
        existingUsername={wpConnection.data?.username}
        initialPlatform={apiPlatform}
        onClose={() => setShowConnectModal(false)}
        onConnected={(info) => {
          setShowConnectModal(false);
          if (info.platform) setApiPlatform(info.platform);
          wpConnection.refetch();
          shopifyConnection.refetch();
          webflowConnection.refetch();
        }}
      />
    );
  }

  const currentPlatformName =
    apiPlatform === "wordpress"
      ? "WordPress"
      : apiPlatform === "shopify"
        ? "Shopify"
        : "Webflow";

  const isCurrentPlatformConnected =
    apiPlatform === "wordpress"
      ? isWpConnected
      : apiPlatform === "shopify"
        ? isShopifyConnected
        : isWebflowConnected;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Deploy Fix to CMS"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        {/* Minimal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-brand-200/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
              <Globe size={15} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-brand-950">Deploy Fix to CMS</h2>
              <p className="text-[11px] text-brand-500 truncate max-w-xs sm:max-w-sm">
                {finding?.title || "Publish SEO update directly or copy verified snippet"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-brand-400 hover:bg-brand-50 hover:text-brand-950 transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Minimal Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-brand-50 border border-brand-200/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("DIRECT_CMS_API")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-semibold transition",
              mode === "DIRECT_CMS_API"
                ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                : "text-brand-400 hover:text-brand-950"
            )}
          >
            <Globe size={13} />
            <span>Connected CMS</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("GUIDED_COPY")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-semibold transition",
              mode === "GUIDED_COPY"
                ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                : "text-brand-400 hover:text-brand-950"
            )}
          >
            <Layers size={13} />
            <span>Copy Snippet</span>
          </button>
        </div>

        {/* Page URL & Field Inputs */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-brand-950 mb-1">
                Target Page URL
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com/page-slug"
                className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-3 py-1.5 font-mono text-xs text-brand-950 focus:outline-none focus:border-signal-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-950 mb-1">
                Field
              </label>
              <select
                value={field}
                onChange={(e) => setField(e.target.value)}
                className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-2.5 py-1.5 text-xs text-brand-950 focus:outline-none focus:border-signal-400"
              >
                <option value="META_TITLE">SEO Title</option>
                <option value="META_DESCRIPTION">Meta Description</option>
                <option value="FAQ_SCHEMA">FAQ Schema (JSON-LD)</option>
                <option value="CODE_AND_SEO_UPDATE">On-Page Copy</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-brand-950">
                SEO Snippet
              </label>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!afterValue}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-200/60 bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-brand-600 hover:bg-brand-100 hover:text-brand-950 transition disabled:opacity-40"
              >
                {copied ? <Check size={11} className="text-success-600" /> : <ClipboardCopy size={11} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={afterValue}
              onChange={(e) => setAfterValue(e.target.value)}
              placeholder={
                field === "META_TITLE"
                  ? "Enter optimized SEO page title..."
                  : field === "META_DESCRIPTION"
                    ? "Enter compelling meta description..."
                    : field === "FAQ_SCHEMA"
                      ? '{\n  "@context": "https://schema.org",\n  "@type": "FAQPage"...\n}'
                      : "Enter recommended content..."
              }
              className="w-full rounded-xl border border-brand-200/80 bg-surface-2 p-2.5 font-mono text-xs text-brand-950 focus:outline-none focus:border-signal-400 placeholder:text-brand-400"
            />
          </div>
        </div>

        {/* ── MODE 1: DIRECT CMS API ── */}
        {mode === "DIRECT_CMS_API" && (
          <div className="space-y-3 pt-1 border-t border-brand-200/60">
            {/* Connector Pills */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-brand-400 font-semibold mr-1">Platform:</span>
              {(
                [
                  { id: "wordpress", label: "WordPress", connected: isWpConnected },
                  { id: "shopify", label: "Shopify", connected: isShopifyConnected },
                  { id: "webflow", label: "Webflow", connected: isWebflowConnected },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setApiPlatform(item.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
                    apiPlatform === item.id
                      ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                      : "border border-brand-200/60 bg-surface-2 text-brand-500 hover:text-brand-950"
                  )}
                >
                  {item.connected && <span className="h-1.5 w-1.5 rounded-full bg-success-500" />}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* When current platform is NOT connected */}
            {!isCurrentPlatformConnected ? (
              <div className="flex items-center justify-between rounded-xl border border-brand-200/80 bg-surface-2 p-3 gap-3">
                <div>
                  <p className="text-xs font-bold text-brand-950">
                    {currentPlatformName} Not Connected
                  </p>
                  <p className="text-[11px] text-brand-500">
                    Connect credentials to publish fixes in 1 click.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConnectModal(true)}
                  className="rounded-xl bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition shadow-2xs shrink-0"
                >
                  Connect {currentPlatformName} →
                </button>
              </div>
            ) : (
              /* When connected */
              <div className="space-y-2.5">
                {apiPlatform === "wordpress" && (
                  <>
                    <div className="flex items-center justify-between rounded-xl border border-success-200/60 bg-success-50/40 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-success-600" />
                        <span className="font-semibold text-brand-950">
                          Connected to {wpConnection.data?.siteUrl}
                        </span>
                        <span className="rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-mono font-bold text-success-800">
                          {(wpConnection.data?.seoPlugin || "core").toUpperCase()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowConnectModal(true)}
                        className="text-[11px] font-semibold text-brand-400 hover:text-brand-950 underline"
                      >
                        Change
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPublishMode("draft")}
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition",
                          publishMode === "draft"
                            ? "border-signal-400 bg-signal-400/10"
                            : "border-brand-200/60 bg-surface-2 hover:border-brand-300"
                        )}
                      >
                        <span className="font-bold text-brand-950 block text-[11.5px]">Stage Revision</span>
                        <span className="text-[10.5px] text-brand-400">Review in WP Admin before live</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPublishMode("publish")}
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition",
                          publishMode === "publish"
                            ? "border-signal-400 bg-signal-400/10"
                            : "border-brand-200/60 bg-surface-2 hover:border-brand-300"
                        )}
                      >
                        <span className="font-bold text-brand-950 block text-[11.5px]">Publish Live</span>
                        <span className="text-[10.5px] text-brand-400">Direct update & immediate verification</span>
                      </button>
                    </div>
                  </>
                )}

                {apiPlatform === "shopify" && (
                  <div className="flex items-center justify-between rounded-xl border border-success-200/60 bg-success-50/40 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-success-600" />
                      <span className="font-semibold text-brand-950">
                        Connected to {shopifyConnection.data?.shopName || shopifyConnection.data?.shopDomain}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConnectModal(true)}
                      className="text-[11px] font-semibold text-brand-400 hover:text-brand-950 underline"
                    >
                      Change
                    </button>
                  </div>
                )}

                {apiPlatform === "webflow" && (
                  <div className="flex items-center justify-between rounded-xl border border-success-200/60 bg-success-50/40 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-success-600" />
                      <span className="font-semibold text-brand-950">
                        Connected to {webflowConnection.data?.siteName || webflowConnection.data?.siteId}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConnectModal(true)}
                      className="text-[11px] font-semibold text-brand-400 hover:text-brand-950 underline"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error & Success States */}
            {stageWpMutation.error && (
              <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-xs">
                {errorMessage(stageWpMutation.error)}
              </div>
            )}
            {stageShopifyMutation.error && (
              <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-xs">
                {errorMessage(stageShopifyMutation.error)}
              </div>
            )}
            {stageWebflowMutation.error && (
              <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-xs">
                {errorMessage(stageWebflowMutation.error)}
              </div>
            )}

            {stageWpMutation.data && (
              <div className="rounded-xl border border-success-200 bg-success-50/60 p-3 text-xs text-success-800 flex items-center justify-between">
                <span>
                  {stageWpMutation.data.publishMode === "publish"
                    ? "Published to WordPress & logged in Impact Ledger."
                    : "Revision staged in WordPress for review."}
                </span>
                {stageWpMutation.data.wpAdminEditUrl && (
                  <a
                    href={stageWpMutation.data.wpAdminEditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold underline"
                  >
                    Open WP Admin <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-brand-200/60 bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-100 hover:text-brand-950 transition"
              >
                Close
              </button>
              {isCurrentPlatformConnected && (
                <button
                  type="button"
                  disabled={!targetUrl.trim() || !afterValue.trim() || stageWpMutation.isPending || stageShopifyMutation.isPending || stageWebflowMutation.isPending}
                  onClick={() => {
                    if (apiPlatform === "wordpress") stageWpMutation.mutate();
                    else if (apiPlatform === "shopify") stageShopifyMutation.mutate();
                    else if (apiPlatform === "webflow") stageWebflowMutation.mutate();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition shadow-2xs disabled:opacity-50"
                >
                  <span>
                    {apiPlatform === "wordpress"
                      ? stageWpMutation.isPending
                        ? "Sending to WordPress…"
                        : publishMode === "draft"
                          ? "Stage Revision in WordPress"
                          : "Publish to WordPress"
                      : apiPlatform === "shopify"
                        ? stageShopifyMutation.isPending
                          ? "Updating Shopify…"
                          : "Apply in Shopify"
                        : stageWebflowMutation.isPending
                          ? "Updating Webflow…"
                          : "Apply in Webflow"}
                  </span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── MODE 2: GUIDED COPY & LIVE HTML CHECK ── */}
        {mode === "GUIDED_COPY" && (
          <div className="space-y-3 pt-1 border-t border-brand-200/60">
            {/* Platform Filter Pills */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-brand-400 font-semibold mr-1">Platform:</span>
              {(["WordPress", "Shopify", "Webflow", "Custom CMS"] as CmsPlatform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition",
                    platform === p
                      ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                      : "border border-brand-200/60 bg-surface-2 text-brand-500 hover:text-brand-950"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Ultra-minimal 2-step instruction */}
            <div className="rounded-xl border border-brand-200/80 bg-surface-2 p-3 space-y-1 text-xs">
              <p className="text-[11.5px] text-brand-950 font-medium">
                1. Copy the snippet above into your {platform} SEO settings.
              </p>
              <p className="text-[11.5px] text-brand-500">
                2. Click <strong>Verify Live HTML</strong> below to inspect the published page and record verified proof.
              </p>
            </div>

            {verifyManualMutation.error && (
              <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-xs">
                {errorMessage(verifyManualMutation.error)}
              </div>
            )}

            {verifyManualMutation.data && (
              <div
                className={cn(
                  "rounded-xl border p-3 text-xs flex items-start gap-2",
                  verifyManualMutation.data.verified
                    ? "border-success-200 bg-success-50/60 text-success-800"
                    : "border-warning-200 bg-warning-50/60 text-warning-800"
                )}
              >
                <ShieldCheck size={14} className="shrink-0 mt-0.5 text-success-600" />
                <div>
                  <p className="font-bold">{verifyManualMutation.data.message}</p>
                  {verifyManualMutation.data.detectedLiveValue && (
                    <p className="mt-0.5 font-mono text-[10.5px] opacity-80">
                      Live HTML: {verifyManualMutation.data.detectedLiveValue}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-brand-200/60 bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-100 hover:text-brand-950 transition"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!targetUrl.trim() || !afterValue.trim() || verifyManualMutation.isPending}
                onClick={() => verifyManualMutation.mutate()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition shadow-2xs disabled:opacity-50"
              >
                <RefreshCw size={12} className={cn(verifyManualMutation.isPending && "animate-spin")} />
                <span>
                  {verifyManualMutation.isPending ? "Scanning Live HTML…" : "Verify Live on Website"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
