"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Globe, KeyRound, Lock, ShieldCheck, X } from "lucide-react";
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
        siteUrl: data.siteUrl || data.siteId,
        username: data.siteName,
        seoPlugin: "webflow",
        platform: "webflow",
      });
    },
  });

  const isPending =
    connectWpMutation.isPending ||
    connectShopifyMutation.isPending ||
    connectWebflowMutation.isPending;

  const activeError =
    connectWpMutation.error ||
    connectShopifyMutation.error ||
    connectWebflowMutation.error;

  const activeSuccess =
    connectWpMutation.isSuccess ||
    connectShopifyMutation.isSuccess ||
    connectWebflowMutation.isSuccess;

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
      <div className="w-full max-w-md rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        {/* Minimal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-brand-200/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
              <Globe size={15} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-brand-950">Connect CMS</h2>
              <p className="text-[11px] text-brand-500">
                Enter API credentials to enable 1-click publishing
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

        {/* Minimal Platform Switcher */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-brand-50 border border-brand-200/60 p-1 text-xs">
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
                "rounded-lg py-1.5 px-2 text-center text-xs font-semibold transition",
                platform === item.id
                  ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                  : "text-brand-400 hover:text-brand-950"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* WORDPRESS TAB */}
        {platform === "wordpress" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-brand-200/80 bg-surface-2 p-2.5 text-[11px] text-brand-500 flex items-center gap-2">
              <KeyRound size={13} className="text-signal-400 shrink-0" />
              <span>In WP Admin, open <strong>Users → Profile → Application Passwords</strong>.</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-950 mb-1">
                WordPress Site URL
              </label>
              <input
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-3 py-1.5 text-xs text-brand-950 focus:outline-none focus:border-signal-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-brand-950 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-3 py-1.5 text-xs text-brand-950 focus:outline-none focus:border-signal-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-950 mb-1">
                  SEO Plugin
                </label>
                <select
                  value={seoPlugin}
                  onChange={(e) => setSeoPlugin(e.target.value as any)}
                  className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-2.5 py-1.5 text-xs text-brand-950 focus:outline-none focus:border-signal-400"
                >
                  <option value="">Auto-detect</option>
                  <option value="rankmath">Rank Math</option>
                  <option value="yoast">Yoast SEO</option>
                  <option value="aioseo">AIOSEO</option>
                  <option value="core">Core WP</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-950 mb-1">
                Application Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-3 py-1.5 pr-8 font-mono text-xs text-brand-950 focus:outline-none focus:border-signal-400"
                />
                <Lock size={12} className="pointer-events-none absolute right-3 top-2.5 text-brand-400" />
              </div>
            </div>
          </div>
        )}

        {/* SHOPIFY TAB */}
        {platform === "shopify" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-brand-200/80 bg-surface-2 p-2.5 text-[11px] text-brand-500 flex items-center gap-2">
              <KeyRound size={13} className="text-signal-400 shrink-0" />
              <span>In Shopify, open <strong>Settings → Apps → Develop apps</strong>.</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-950 mb-1">
                Store Domain
              </label>
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="store.myshopify.com"
                className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-3 py-1.5 text-xs text-brand-950 focus:outline-none focus:border-signal-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-950 mb-1">
                Admin API Access Token
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={shopifyToken}
                  onChange={(e) => setShopifyToken(e.target.value)}
                  placeholder="shpat_..."
                  className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-3 py-1.5 pr-8 font-mono text-xs text-brand-950 focus:outline-none focus:border-signal-400"
                />
                <Lock size={12} className="pointer-events-none absolute right-3 top-2.5 text-brand-400" />
              </div>
            </div>
          </div>
        )}

        {/* WEBFLOW TAB */}
        {platform === "webflow" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-brand-200/80 bg-surface-2 p-2.5 text-[11px] text-brand-500 flex items-center gap-2">
              <KeyRound size={13} className="text-signal-400 shrink-0" />
              <span>In Webflow, open <strong>Site Settings → Apps → API Access</strong>.</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-brand-950 mb-1">
                  Webflow Site ID
                </label>
                <input
                  type="text"
                  value={webflowSiteId}
                  onChange={(e) => setWebflowSiteId(e.target.value)}
                  placeholder="Site ID"
                  className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-3 py-1.5 font-mono text-xs text-brand-950 focus:outline-none focus:border-signal-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-950 mb-1">
                  Site URL (Optional)
                </label>
                <input
                  type="url"
                  value={webflowSiteUrl}
                  onChange={(e) => setWebflowSiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-3 py-1.5 text-xs text-brand-950 focus:outline-none focus:border-signal-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-950 mb-1">
                API Token
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={webflowToken}
                  onChange={(e) => setWebflowToken(e.target.value)}
                  placeholder="wf_..."
                  className="w-full rounded-xl border border-brand-200/80 bg-surface-2 px-3 py-1.5 pr-8 font-mono text-xs text-brand-950 focus:outline-none focus:border-signal-400"
                />
                <Lock size={12} className="pointer-events-none absolute right-3 top-2.5 text-brand-400" />
              </div>
            </div>
          </div>
        )}

        {/* Security badge */}
        <p className="flex items-center gap-1.5 text-[10.5px] text-brand-400">
          <ShieldCheck size={12} className="text-success-600" />
          <span>Encrypted with AES-256-GCM. Stored securely.</span>
        </p>

        {activeError && (
          <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-xs font-medium">
            {errorMessage(activeError)}
          </div>
        )}

        {activeSuccess && (
          <div className="p-3 rounded-xl border border-success-200 bg-success-50/60 text-success-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={13} className="text-success-600" />
            <span>Connection verified successfully!</span>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-200/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-brand-200/60 bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-100 hover:text-brand-950 transition"
          >
            Cancel
          </button>
          {platform === "wordpress" && (
            <button
              type="button"
              disabled={!siteUrl.trim() || !username.trim() || !appPassword.trim() || isPending}
              onClick={() => connectWpMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition shadow-2xs disabled:opacity-50"
            >
              <span>{connectWpMutation.isPending ? "Verifying…" : "Connect WordPress"}</span>
              <ArrowRight size={12} />
            </button>
          )}
          {platform === "shopify" && (
            <button
              type="button"
              disabled={!shopDomain.trim() || !shopifyToken.trim() || isPending}
              onClick={() => connectShopifyMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition shadow-2xs disabled:opacity-50"
            >
              <span>{connectShopifyMutation.isPending ? "Verifying…" : "Connect Shopify"}</span>
              <ArrowRight size={12} />
            </button>
          )}
          {platform === "webflow" && (
            <button
              type="button"
              disabled={!webflowSiteId.trim() || !webflowToken.trim() || isPending}
              onClick={() => connectWebflowMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition shadow-2xs disabled:opacity-50"
            >
              <span>{connectWebflowMutation.isPending ? "Verifying…" : "Connect Webflow"}</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
