"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Globe, KeyRound, Lock, ShieldCheck, X } from "lucide-react";
import { ActionButton, StatusNote } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

export type CmsConnectPlatform = "wordpress" | "shopify" | "webflow";

export function WordPressConnectModal({
  projectId,
  defaultSiteUrl,
  existingSiteUrl,
  existingUsername,
  initialPlatform = "wordpress",
  onClose,
  onConnected,
}: {
  projectId: string;
  defaultSiteUrl?: string | null;
  existingSiteUrl?: string | null;
  existingUsername?: string | null;
  initialPlatform?: CmsConnectPlatform;
  onClose: () => void;
  onConnected?: (info: { siteUrl: string; username: string; seoPlugin: string; platform?: CmsConnectPlatform }) => void;
}) {
  const queryClient = useQueryClient();
  const [platform, setPlatform] = useState<CmsConnectPlatform>(initialPlatform);

  // WordPress state
  const [siteUrl, setSiteUrl] = useState(existingSiteUrl || defaultSiteUrl || "");
  const [username, setUsername] = useState(existingUsername || "");
  const [appPassword, setAppPassword] = useState("");
  const [seoPlugin, setSeoPlugin] = useState<"" | "yoast" | "rankmath" | "aioseo" | "core">("");

  // Shopify state
  const [shopDomain, setShopDomain] = useState(defaultSiteUrl || "");
  const [shopifyToken, setShopifyToken] = useState("");

  // Webflow state
  const [webflowSiteId, setWebflowSiteId] = useState("");
  const [webflowToken, setWebflowToken] = useState("");
  const [webflowSiteUrl, setWebflowSiteUrl] = useState(defaultSiteUrl || "");

  const connectWpMutation = useMutation({
    mutationFn: () =>
      api.connectWordPress(projectId, {
        siteUrl,
        username,
        appPassword,
        ...(seoPlugin ? { seoPlugin } : {}),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-connection", projectId] });
      onConnected?.({
        siteUrl: data.siteUrl,
        username: data.username,
        seoPlugin: data.seoPlugin,
        platform: "wordpress",
      });
    },
  });

  const connectShopifyMutation = useMutation({
    mutationFn: () =>
      api.connectShopify(projectId, {
        shopDomain,
        accessToken: shopifyToken,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shopify-connection", projectId] });
      onConnected?.({
        siteUrl: data.shopDomain,
        username: data.shopName,
        seoPlugin: "shopify",
        platform: "shopify",
      });
    },
  });

  const connectWebflowMutation = useMutation({
    mutationFn: () =>
      api.connectWebflow(projectId, {
        siteId: webflowSiteId,
        apiToken: webflowToken,
        siteUrl: webflowSiteUrl || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["webflow-connection", projectId] });
      onConnected?.({
        siteUrl: data.siteUrl,
        username: data.siteName,
        seoPlugin: "webflow",
        platform: "webflow",
      });
    },
  });

  const activeError =
    platform === "wordpress"
      ? connectWpMutation.error
      : platform === "shopify"
        ? connectShopifyMutation.error
        : connectWebflowMutation.error;

  const activeSuccess =
    platform === "wordpress"
      ? connectWpMutation.isSuccess
      : platform === "shopify"
        ? connectShopifyMutation.isSuccess
        : connectWebflowMutation.isSuccess;

  const isPending =
    connectWpMutation.isPending || connectShopifyMutation.isPending || connectWebflowMutation.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect CMS Platform"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-brand-200 bg-surface-1 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-brand-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-brand-950">
                Connect CMS Platform (1-Click Publishing)
              </h2>
              <p className="text-[12px] text-brand-500">
                Connect WordPress, Shopify, or Webflow to push SEO fixes via API without GitHub.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-brand-400 hover:bg-brand-50 hover:text-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Platform Switcher */}
        <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl bg-brand-50 p-1 border border-brand-200/70">
          {(
            [
              { id: "wordpress", label: "WordPress" },
              { id: "shopify", label: "Shopify" },
              { id: "webflow", label: "Webflow" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPlatform(item.id)}
              className={cn(
                "rounded-lg py-1.5 px-3 text-[12px] font-semibold transition-colors",
                platform === item.id
                  ? "bg-surface-1 text-brand-950 shadow-xs"
                  : "text-brand-600 hover:text-brand-900",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* WORDPRESS TAB */}
        {platform === "wordpress" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 text-[12px] text-brand-700">
              <p className="font-semibold text-brand-900 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-accent-700" />
                How to get your WordPress Application Password (takes 30 seconds):
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11.5px] text-brand-600">
                <li>Open your WordPress Admin Dashboard → <strong>Users → Profile</strong>.</li>
                <li>Scroll down to the <strong>Application Passwords</strong> section (built into WordPress 5.6+).</li>
                <li>Enter <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">Reigel SEO</code> and click <strong>Add New Application Password</strong>.</li>
              </ol>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-brand-800">
                WordPress Site URL
              </label>
              <input
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://your-site.com"
                className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-[13px] text-brand-900 outline-none focus:border-accent-600"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[12px] font-semibold text-brand-800">
                  WordPress Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or editor username"
                  className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-[13px] text-brand-900 outline-none focus:border-accent-600"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-brand-800">
                  SEO Plugin (Optional)
                </label>
                <select
                  value={seoPlugin}
                  onChange={(e) => setSeoPlugin(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-[13px] text-brand-900 outline-none focus:border-accent-600"
                >
                  <option value="">Auto-detect from WordPress</option>
                  <option value="rankmath">Rank Math SEO</option>
                  <option value="yoast">Yoast SEO</option>
                  <option value="aioseo">All in One SEO (AIOSEO)</option>
                  <option value="core">Standard WordPress (No plugin)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-brand-800">
                Application Password
              </label>
              <div className="relative mt-1">
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                  className="w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 font-mono text-[13px] text-brand-900 outline-none focus:border-accent-600"
                />
                <Lock className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-brand-400" />
              </div>
            </div>
          </div>
        )}

        {/* SHOPIFY TAB */}
        {platform === "shopify" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 text-[12px] text-brand-700">
              <p className="font-semibold text-brand-900 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-accent-700" />
                How to get your Shopify Admin API Access Token:
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11.5px] text-brand-600">
                <li>In Shopify Admin, open <strong>Settings → Apps and sales channels → Develop apps</strong>.</li>
                <li>Create an app named <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">Reigel SEO</code> and grant <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">read_products</code>, <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">write_products</code>, <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">read_content</code>, and <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">write_content</code>.</li>
                <li>Install the app and paste the <strong>Admin API access token</strong> (<code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">shpat_...</code>) below.</li>
              </ol>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-brand-800">
                Shopify Store Domain
              </label>
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-[13px] text-brand-900 outline-none focus:border-accent-600"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-brand-800">
                Admin API Access Token
              </label>
              <div className="relative mt-1">
                <input
                  type="password"
                  value={shopifyToken}
                  onChange={(e) => setShopifyToken(e.target.value)}
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 font-mono text-[13px] text-brand-900 outline-none focus:border-accent-600"
                />
                <Lock className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-brand-400" />
              </div>
            </div>
          </div>
        )}

        {/* WEBFLOW TAB */}
        {platform === "webflow" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 text-[12px] text-brand-700">
              <p className="font-semibold text-brand-900 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-accent-700" />
                How to get your Webflow Site ID &amp; API Token:
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11.5px] text-brand-600">
                <li>Open Webflow <strong>Site Settings → Apps &amp; Integrations → API Access</strong>.</li>
                <li>Generate a V2 API Token with <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">sites:read</code>, <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">pages:read</code>, and <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">pages:write</code> permissions.</li>
                <li>Copy your <strong>Site ID</strong> from Site Settings → General and paste both below.</li>
              </ol>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[12px] font-semibold text-brand-800">
                  Webflow Site ID
                </label>
                <input
                  type="text"
                  value={webflowSiteId}
                  onChange={(e) => setWebflowSiteId(e.target.value)}
                  placeholder="65f1a2b3c4d5e6f7a8b9c0d1"
                  className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 font-mono text-[13px] text-brand-900 outline-none focus:border-accent-600"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-brand-800">
                  Public Site URL (Optional)
                </label>
                <input
                  type="url"
                  value={webflowSiteUrl}
                  onChange={(e) => setWebflowSiteUrl(e.target.value)}
                  placeholder="https://your-site.com"
                  className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-[13px] text-brand-900 outline-none focus:border-accent-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-brand-800">
                Webflow Data API v2 Token
              </label>
              <div className="relative mt-1">
                <input
                  type="password"
                  value={webflowToken}
                  onChange={(e) => setWebflowToken(e.target.value)}
                  placeholder="wf_xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 font-mono text-[13px] text-brand-900 outline-none focus:border-accent-600"
                />
                <Lock className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-brand-400" />
              </div>
            </div>
          </div>
        )}

        <p className="mt-3 flex items-center gap-1 text-[11px] text-brand-500">
          <ShieldCheck className="h-3.5 w-3.5 text-good-600" />
          Encrypted at rest with AES-256-GCM. Never exposed in API responses.
        </p>

        {activeError && (
          <div className="mt-3">
            <StatusNote tone="bad">{errorMessage(activeError)}</StatusNote>
          </div>
        )}

        {activeSuccess && (
          <div className="mt-3">
            <StatusNote tone="good">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
              {platform === "wordpress"
                ? "WordPress connected and verified!"
                : platform === "shopify"
                  ? "Shopify store connected and verified!"
                  : "Webflow site connected and verified!"}
            </StatusNote>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-brand-100 pt-4">
          <ActionButton variant="secondary" onClick={onClose}>
            Cancel
          </ActionButton>
          {platform === "wordpress" && (
            <ActionButton
              variant="primary"
              disabled={!siteUrl.trim() || !username.trim() || !appPassword.trim() || isPending}
              onClick={() => connectWpMutation.mutate()}
            >
              {connectWpMutation.isPending ? "Verifying WordPress REST API…" : "Verify & Connect WordPress"}
            </ActionButton>
          )}
          {platform === "shopify" && (
            <ActionButton
              variant="primary"
              disabled={!shopDomain.trim() || !shopifyToken.trim() || isPending}
              onClick={() => connectShopifyMutation.mutate()}
            >
              {connectShopifyMutation.isPending ? "Verifying Shopify Admin API…" : "Verify & Connect Shopify"}
            </ActionButton>
          )}
          {platform === "webflow" && (
            <ActionButton
              variant="primary"
              disabled={!webflowSiteId.trim() || !webflowToken.trim() || isPending}
              onClick={() => connectWebflowMutation.mutate()}
            >
              {connectWebflowMutation.isPending ? "Verifying Webflow API…" : "Verify & Connect Webflow"}
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}
