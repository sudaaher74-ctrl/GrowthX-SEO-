"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Globe,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { ActionButton, Pill, StatusNote } from "@/components/ui/console";
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
  if (text.includes("schema") || text.includes("json-ld") || text.includes("faq")) {
    return "FAQ_SCHEMA";
  }
  if (text.includes("meta description") || text.includes("description")) {
    return "META_DESCRIPTION";
  }
  return "META_TITLE";
}

function inferDefaultProposal(finding?: GrowthOpportunity | null): string {
  if (!finding) return "";
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
  return finding.recommendedAction || finding.summary || finding.title;
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
  const [afterValue, setAfterValue] = useState(inferDefaultProposal(finding));
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Apply Fix in WordPress, Shopify, Webflow or CMS"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-brand-200 bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-brand-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                <Globe className="h-4 w-4" />
              </span>
              <h2 className="text-[15px] font-bold text-brand-950">
                Apply Without GitHub (WordPress, Shopify, Webflow &amp; CMS)
              </h2>
              <Pill tone="good">Tracked in Impact Ledger</Pill>
            </div>
            <p className="mt-1 text-[12px] text-brand-500">
              {finding
                ? finding.title
                : "Push SEO fixes directly via WordPress, Shopify, or Webflow API, or copy the snippet into any CMS and verify live HTML."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-brand-400 hover:bg-brand-50 hover:text-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-brand-50 p-1 border border-brand-200/70">
          <button
            type="button"
            onClick={() => setMode("DIRECT_CMS_API")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-[12px] font-semibold transition-colors",
              mode === "DIRECT_CMS_API"
                ? "bg-white text-brand-950 shadow-xs"
                : "text-brand-600 hover:text-brand-900",
            )}
          >
            <Globe className="h-3.5 w-3.5 text-accent-700" />
            1-Click CMS API (WordPress / Shopify / Webflow)
          </button>
          <button
            type="button"
            onClick={() => setMode("GUIDED_COPY")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-[12px] font-semibold transition-colors",
              mode === "GUIDED_COPY"
                ? "bg-white text-brand-950 shadow-xs"
                : "text-brand-600 hover:text-brand-900",
            )}
          >
            <Layers className="h-3.5 w-3.5 text-accent-700" />
            Guided Copy &amp; Live HTML Check (Any CMS)
          </button>
        </div>

        {/* Common Target URL & Field Inputs */}
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-[11.5px] font-semibold text-brand-700">
                Target Page URL
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://your-site.com/page-slug"
                className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-1.5 font-mono text-[12px] text-brand-900 outline-none focus:border-accent-600"
              />
            </div>

            <div>
              <label className="block text-[11.5px] font-semibold text-brand-700">
                Optimization Target
              </label>
              <select
                value={field}
                onChange={(e) => setField(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-2.5 py-1.5 text-[12px] text-brand-900 outline-none focus:border-accent-600"
              >
                <option value="META_TITLE">SEO Page Title</option>
                <option value="META_DESCRIPTION">Meta Description</option>
                <option value="FAQ_SCHEMA">FAQ / Local Schema (JSON-LD)</option>
                <option value="CODE_AND_SEO_UPDATE">On-Page Heading / Copy</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-[11.5px] font-semibold text-brand-700">
                Recommended SEO Content / Snippet (Editable)
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
              >
                {copied ? <Check className="h-3 w-3 text-good-600" /> : <ClipboardCopy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy snippet"}
              </button>
            </div>
            <textarea
              rows={4}
              value={afterValue}
              onChange={(e) => setAfterValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-300 bg-white p-2.5 font-mono text-[12px] text-brand-900 outline-none focus:border-accent-600"
            />
          </div>
        </div>

        {/* MODE 1: DIRECT CMS API (WordPress, Shopify, Webflow) */}
        {mode === "DIRECT_CMS_API" && (
          <div className="mt-4 space-y-4 border-t border-brand-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-semibold text-brand-600">Select Connector:</span>
              {(
                [
                  { id: "wordpress", label: "WordPress REST API", connected: isWpConnected },
                  { id: "shopify", label: "Shopify Admin API", connected: isShopifyConnected },
                  { id: "webflow", label: "Webflow API v2", connected: isWebflowConnected },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setApiPlatform(item.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors",
                    apiPlatform === item.id
                      ? "bg-brand-900 text-white"
                      : "bg-brand-100 text-brand-600 hover:bg-brand-200",
                  )}
                >
                  {item.connected && <span className="h-1.5 w-1.5 rounded-full bg-good-500" />}
                  {item.label}
                </button>
              ))}
            </div>

            {/* WORDPRESS SUB-PANEL */}
            {apiPlatform === "wordpress" && (
              <>
                {!isWpConnected ? (
                  <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-[13px] font-semibold text-brand-900">
                        WordPress Site Not Connected Yet
                      </h3>
                      <p className="mt-0.5 text-[12px] text-brand-600">
                        Connect with a WordPress Application Password so Reigel can stage revisions or update Yoast / Rank Math meta fields directly.
                      </p>
                    </div>
                    <ActionButton variant="primary" onClick={() => setShowConnectModal(true)}>
                      Connect WordPress →
                    </ActionButton>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-good-200 bg-good-50/40 px-3.5 py-2.5 text-[12px]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-good-600" />
                        <span className="font-semibold text-brand-900">
                          Connected to {wpConnection.data?.siteUrl}
                        </span>
                        <Pill tone="info">
                          {(wpConnection.data?.seoPlugin || "core").toUpperCase()}
                        </Pill>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowConnectModal(true)}
                        className="text-[11px] font-semibold text-accent-700 hover:underline"
                      >
                        Change credentials
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[12px]",
                          publishMode === "draft"
                            ? "border-accent-600 bg-accent-50/30"
                            : "border-brand-200 bg-white",
                        )}
                      >
                        <input
                          type="radio"
                          name="wpPublishMode"
                          checked={publishMode === "draft"}
                          onChange={() => setPublishMode("draft")}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-semibold text-brand-900 block">
                            Stage as WordPress Revision (Recommended)
                          </span>
                          <span className="text-[11px] text-brand-500">
                            Saves a revision in WordPress so you can review and publish in WP Admin.
                          </span>
                        </div>
                      </label>

                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[12px]",
                          publishMode === "publish"
                            ? "border-accent-600 bg-accent-50/30"
                            : "border-brand-200 bg-white",
                        )}
                      >
                        <input
                          type="radio"
                          name="wpPublishMode"
                          checked={publishMode === "publish"}
                          onChange={() => setPublishMode("publish")}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-semibold text-brand-900 block">
                            Publish Directly to WordPress
                          </span>
                          <span className="text-[11px] text-brand-500">
                            Updates the live WordPress page/post and records verified Before &amp; After proof immediately.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {stageWpMutation.error && (
                  <StatusNote tone="bad">{errorMessage(stageWpMutation.error)}</StatusNote>
                )}

                {stageWpMutation.data && (
                  <div className="rounded-xl border border-good-300 bg-good-50/50 p-3.5 text-[12px] text-good-950 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-good-600 shrink-0" />
                      <span>
                        {stageWpMutation.data.publishMode === "publish"
                          ? "Published to WordPress and recorded in the Impact Ledger!"
                          : "Revision staged in WordPress and recorded in the Impact Ledger!"}
                      </span>
                    </div>
                    {stageWpMutation.data.wpAdminEditUrl && (
                      <a
                        href={stageWpMutation.data.wpAdminEditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:underline"
                      >
                        Open in WordPress Admin
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <ActionButton variant="secondary" onClick={onClose}>
                    Close
                  </ActionButton>
                  {isWpConnected && (
                    <ActionButton
                      variant="primary"
                      disabled={!targetUrl.trim() || !afterValue.trim() || stageWpMutation.isPending}
                      onClick={() => stageWpMutation.mutate()}
                    >
                      {stageWpMutation.isPending
                        ? "Sending to WordPress…"
                        : publishMode === "draft"
                          ? "Stage Revision in WordPress"
                          : "Publish to WordPress"}
                    </ActionButton>
                  )}
                </div>
              </>
            )}

            {/* SHOPIFY SUB-PANEL */}
            {apiPlatform === "shopify" && (
              <>
                {!isShopifyConnected ? (
                  <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-[13px] font-semibold text-brand-900">
                        Shopify Store Not Connected Yet
                      </h3>
                      <p className="mt-0.5 text-[12px] text-brand-600">
                        Connect your Shopify store with an Admin API token to update product and page SEO titles, descriptions, and JSON-LD schema in 1 click.
                      </p>
                    </div>
                    <ActionButton variant="primary" onClick={() => setShowConnectModal(true)}>
                      Connect Shopify →
                    </ActionButton>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-good-200 bg-good-50/40 px-3.5 py-2.5 text-[12px]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-good-600" />
                      <span className="font-semibold text-brand-900">
                        Connected to {shopifyConnection.data?.shopName || shopifyConnection.data?.shopDomain}
                      </span>
                      <Pill tone="info">SHOPIFY ADMIN API</Pill>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConnectModal(true)}
                      className="text-[11px] font-semibold text-accent-700 hover:underline"
                    >
                      Change credentials
                    </button>
                  </div>
                )}

                {stageShopifyMutation.error && (
                  <StatusNote tone="bad">{errorMessage(stageShopifyMutation.error)}</StatusNote>
                )}

                {stageShopifyMutation.data && (
                  <div className="rounded-xl border border-good-300 bg-good-50/50 p-3.5 text-[12px] text-good-950 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-good-600 shrink-0" />
                      <span>Updated in Shopify and recorded in the Impact Ledger!</span>
                    </div>
                    {stageShopifyMutation.data.adminEditUrl && (
                      <a
                        href={stageShopifyMutation.data.adminEditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:underline"
                      >
                        Open in Shopify Admin
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <ActionButton variant="secondary" onClick={onClose}>
                    Close
                  </ActionButton>
                  {isShopifyConnected && (
                    <ActionButton
                      variant="primary"
                      disabled={!targetUrl.trim() || !afterValue.trim() || stageShopifyMutation.isPending}
                      onClick={() => stageShopifyMutation.mutate()}
                    >
                      {stageShopifyMutation.isPending ? "Updating Shopify…" : "Apply Fix in Shopify"}
                    </ActionButton>
                  )}
                </div>
              </>
            )}

            {/* WEBFLOW SUB-PANEL */}
            {apiPlatform === "webflow" && (
              <>
                {!isWebflowConnected ? (
                  <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-[13px] font-semibold text-brand-900">
                        Webflow Site Not Connected Yet
                      </h3>
                      <p className="mt-0.5 text-[12px] text-brand-600">
                        Connect your Webflow Site ID and Data API v2 Token to push SEO title and meta description updates directly to Webflow pages.
                      </p>
                    </div>
                    <ActionButton variant="primary" onClick={() => setShowConnectModal(true)}>
                      Connect Webflow →
                    </ActionButton>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-good-200 bg-good-50/40 px-3.5 py-2.5 text-[12px]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-good-600" />
                      <span className="font-semibold text-brand-900">
                        Connected to {webflowConnection.data?.siteName || webflowConnection.data?.siteId}
                      </span>
                      <Pill tone="info">WEBFLOW API V2</Pill>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConnectModal(true)}
                      className="text-[11px] font-semibold text-accent-700 hover:underline"
                    >
                      Change credentials
                    </button>
                  </div>
                )}

                {stageWebflowMutation.error && (
                  <StatusNote tone="bad">{errorMessage(stageWebflowMutation.error)}</StatusNote>
                )}

                {stageWebflowMutation.data && (
                  <div className="rounded-xl border border-good-300 bg-good-50/50 p-3.5 text-[12px] text-good-950 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-good-600 shrink-0" />
                      <span>Updated in Webflow and recorded in the Impact Ledger!</span>
                    </div>
                    {stageWebflowMutation.data.adminEditUrl && (
                      <a
                        href={stageWebflowMutation.data.adminEditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:underline"
                      >
                        Open in Webflow Designer
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <ActionButton variant="secondary" onClick={onClose}>
                    Close
                  </ActionButton>
                  {isWebflowConnected && (
                    <ActionButton
                      variant="primary"
                      disabled={!targetUrl.trim() || !afterValue.trim() || stageWebflowMutation.isPending}
                      onClick={() => stageWebflowMutation.mutate()}
                    >
                      {stageWebflowMutation.isPending ? "Updating Webflow…" : "Apply Fix in Webflow"}
                    </ActionButton>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* MODE 2: GUIDED COPY & LIVE HTML VERIFICATION */}
        {mode === "GUIDED_COPY" && (
          <div className="mt-4 space-y-4 border-t border-brand-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-semibold text-brand-600">Your Platform:</span>
              {(["WordPress", "Shopify", "Webflow", "Custom CMS"] as CmsPlatform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors",
                    platform === p
                      ? "bg-brand-900 text-white"
                      : "bg-brand-100 text-brand-600 hover:bg-brand-200",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 text-[12px] text-brand-700 space-y-1.5">
              <p className="font-semibold text-brand-900 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent-700" />
                3-Step Guided Apply for {platform}:
              </p>
              {platform === "WordPress" && (
                <ol className="list-decimal pl-4 space-y-1 text-[11.5px] text-brand-600">
                  <li>Click <strong>Copy snippet</strong> above.</li>
                  <li>Open the page in WordPress Editor and paste it into your <strong>Rank Math / Yoast SEO</strong> box (or Custom HTML block for JSON-LD Schema).</li>
                  <li>Click <strong>Update</strong> in WordPress, then click <strong>Verify Live on Website</strong> below to record 30d/90d proof.</li>
                </ol>
              )}
              {platform === "Shopify" && (
                <ol className="list-decimal pl-4 space-y-1 text-[11.5px] text-brand-600">
                  <li>Click <strong>Copy snippet</strong> above.</li>
                  <li>In Shopify Admin → <strong>Online Store → Pages / Products</strong>, scroll to <strong>Search engine listing</strong> and click <strong>Edit</strong>.</li>
                  <li>Paste the updated value, click <strong>Save</strong>, then click <strong>Verify Live on Website</strong> below.</li>
                </ol>
              )}
              {(platform === "Webflow" || platform === "Custom CMS") && (
                <ol className="list-decimal pl-4 space-y-1 text-[11.5px] text-brand-600">
                  <li>Click <strong>Copy snippet</strong> above.</li>
                  <li>Paste into your page&apos;s SEO Title / Meta Description settings (or Custom Code head section for JSON-LD).</li>
                  <li>Publish your page, then click <strong>Verify Live on Website</strong> below so Reigel scans your live HTML and logs the proof.</li>
                </ol>
              )}
            </div>

            {verifyManualMutation.error && (
              <StatusNote tone="bad">{errorMessage(verifyManualMutation.error)}</StatusNote>
            )}

            {verifyManualMutation.data && (
              <div
                className={cn(
                  "rounded-xl border p-3.5 text-[12px] flex items-start gap-2.5",
                  verifyManualMutation.data.verified
                    ? "border-good-300 bg-good-50/60 text-good-950"
                    : "border-warn-300 bg-warn-50/60 text-warn-950",
                )}
              >
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-good-600" />
                <div>
                  <p className="font-semibold">{verifyManualMutation.data.message}</p>
                  {verifyManualMutation.data.detectedLiveValue && (
                    <p className="mt-1 font-mono text-[11px] opacity-80">
                      Detected on live HTML: {verifyManualMutation.data.detectedLiveValue}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <ActionButton variant="secondary" onClick={onClose}>
                Close
              </ActionButton>
              <ActionButton
                variant="primary"
                disabled={!targetUrl.trim() || !afterValue.trim() || verifyManualMutation.isPending}
                onClick={() => verifyManualMutation.mutate()}
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", verifyManualMutation.isPending && "animate-spin")} />
                {verifyManualMutation.isPending
                  ? "Scanning Live HTML…"
                  : "Verify Live on Website & Record Proof"}
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
