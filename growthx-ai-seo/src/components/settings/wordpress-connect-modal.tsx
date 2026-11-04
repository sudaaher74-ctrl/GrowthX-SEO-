"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Globe, KeyRound, Lock, ShieldCheck, X } from "lucide-react";
import { ActionButton, StatusNote } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

export function WordPressConnectModal({
  projectId,
  defaultSiteUrl,
  existingSiteUrl,
  existingUsername,
  onClose,
  onConnected,
}: {
  projectId: string;
  defaultSiteUrl?: string | null;
  existingSiteUrl?: string | null;
  existingUsername?: string | null;
  onClose: () => void;
  onConnected?: (info: { siteUrl: string; username: string; seoPlugin: string }) => void;
}) {
  const queryClient = useQueryClient();
  const [siteUrl, setSiteUrl] = useState(existingSiteUrl || defaultSiteUrl || "");
  const [username, setUsername] = useState(existingUsername || "");
  const [appPassword, setAppPassword] = useState("");
  const [seoPlugin, setSeoPlugin] = useState<"" | "yoast" | "rankmath" | "aioseo" | "core">("");

  const connectMutation = useMutation({
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
      });
    },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect WordPress Site"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-brand-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-brand-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-brand-950">
                Connect WordPress Site
              </h2>
              <p className="text-[12px] text-brand-500">
                Stage SEO revisions and meta updates directly via the WordPress REST API.
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

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 text-[12px] text-brand-700">
            <p className="font-semibold text-brand-900 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-accent-700" />
              How to get your WordPress Application Password (takes 30 seconds):
            </p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11.5px] text-brand-600">
              <li>Open your WordPress Admin Dashboard → <strong>Users → Profile</strong>.</li>
              <li>Scroll down to the <strong>Application Passwords</strong> section (built into WordPress 5.6+).</li>
              <li>Enter <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">Reigel SEO</code> and click <strong>Add New Application Password</strong>.</li>
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
              className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-[13px] text-brand-900 outline-none focus:border-accent-600"
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
                className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-[13px] text-brand-900 outline-none focus:border-accent-600"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-brand-800">
                SEO Plugin (Optional)
              </label>
              <select
                value={seoPlugin}
                onChange={(e) => setSeoPlugin(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-[13px] text-brand-900 outline-none focus:border-accent-600"
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
                className="w-full rounded-lg border border-brand-300 bg-white px-3 py-2 font-mono text-[13px] text-brand-900 outline-none focus:border-accent-600"
              />
              <Lock className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-brand-400" />
            </div>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-brand-500">
              <ShieldCheck className="h-3.5 w-3.5 text-good-600" />
              Encrypted at rest with AES-256-GCM. Never exposed in API responses.
            </p>
          </div>

          {connectMutation.error && (
            <StatusNote tone="bad">{errorMessage(connectMutation.error)}</StatusNote>
          )}

          {connectMutation.isSuccess && (
            <StatusNote tone="good">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
              WordPress connected and verified!
            </StatusNote>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-brand-100 pt-4">
          <ActionButton variant="secondary" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            disabled={!siteUrl.trim() || !username.trim() || !appPassword.trim() || connectMutation.isPending}
            onClick={() => connectMutation.mutate()}
          >
            {connectMutation.isPending ? "Verifying WordPress REST API…" : "Verify & Connect WordPress"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
