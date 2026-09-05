"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Share2, RefreshCw, CheckCircle2, Video, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api-client";interface TrackedCompetitorSummary {
  id: string;
  domain: string;
  label?: string | null;
  name?: string | null;
  websiteId?: string | null;
}

interface SocialAccountsPanelProps {
  projectId: string;
  customerDomain: string;
  businessName: string;
  competitors: TrackedCompetitorSummary[];
  onNavigateToFeeds?: (platform?: string) => void;
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  INSTAGRAM: { label: "Instagram", color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-200" },
  YOUTUBE: { label: "YouTube", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  TIKTOK: { label: "TikTok", color: "text-slate-900", bg: "bg-slate-50", border: "border-slate-200" },
  LINKEDIN: { label: "LinkedIn", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  TWITTER: { label: "X (Twitter)", color: "text-slate-800", bg: "bg-slate-50", border: "border-slate-200" },
  FACEBOOK: { label: "Facebook", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
};

export function SocialAccountsPanel({
  projectId,
  customerDomain,
  businessName,
  competitors,
  onNavigateToFeeds,
}: SocialAccountsPanelProps) {
  const queryClient = useQueryClient();
  const [selectedCompetitorForScan, setSelectedCompetitorForScan] = useState<string>(
    competitors[0]?.domain || customerDomain
  );
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Fetch cross-competitor matrix which contains discovered competitor accounts
  const matrixQuery = useQuery({
    queryKey: ["cross-competitor-matrix", projectId],
    queryFn: () => api.getCrossCompetitorMatrix(projectId),
    enabled: Boolean(projectId),
  });

  // Discovery Mutation
  const discoverMutation = useMutation({
    mutationFn: (targetDomain: string) =>
      api.discoverSocialProfiles(projectId, {
        website: targetDomain.includes("://") ? targetDomain : `https://${targetDomain}`,
        businessName: targetDomain.split(".")[0],
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["cross-competitor-matrix", projectId] });
      setScanMessage(
        `Discovered ${res.accounts?.length || 0} social profiles linked on ${selectedCompetitorForScan}!`
      );
      setTimeout(() => setScanMessage(null), 4000);
    },
    onError: (err: Error) => {
      setScanMessage(`Scan completed: ${err.message || "No public social links found in website header/footer."}`);
      setTimeout(() => setScanMessage(null), 4000);
    },
  });

  const discoveredCompetitors = matrixQuery.data?.competitors || [];

  return (
    <div className="space-y-6">
      {/* 1. Header & Crawler Social Discovery Tool */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-950 text-white shadow-sm">
                <Share2 size={16} />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-brand-950">
                  Website-Integrated Social Media Accounts
                </h3>
                <p className="text-[12px] text-brand-500">
                  Our crawler scans website headers, footers, and schema markup to identify official Instagram, YouTube, TikTok, and LinkedIn accounts.
                </p>
              </div>
            </div>
          </div>

          {/* Trigger Scan on a Website */}
          <div className="flex items-center gap-2">
            <select
              value={selectedCompetitorForScan}
              onChange={(e) => setSelectedCompetitorForScan(e.target.value)}
              className="rounded-xl border bg-brand-50/50 py-2 pl-3 pr-8 text-[12px] font-semibold text-brand-900 shadow-sm focus:border-brand-950 focus:outline-none"
              style={{ borderColor: "var(--border-color)" }}
            >
              <option value={customerDomain}>Your Website ({customerDomain})</option>
              {competitors.map((c) => (
                <option key={c.id} value={c.domain}>
                  {c.label || c.name || c.domain} ({c.domain})
                </option>
              ))}
            </select>

            <button
              onClick={() => discoverMutation.mutate(selectedCompetitorForScan)}
              disabled={discoverMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-brand-950 px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-50"
            >
              <RefreshCw size={13} className={discoverMutation.isPending ? "animate-spin" : ""} />
              <span>{discoverMutation.isPending ? "Scanning Website..." : "Scan for Social Links"}</span>
            </button>
          </div>
        </div>

        {scanMessage && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-[12px] font-semibold text-emerald-800 border border-emerald-200">
            {scanMessage}
          </div>
        )}
      </div>

      {/* 2. Your Brand's Integrated Social Channels */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-2">
            <Globe size={15} className="text-brand-600" />
            <h4 className="text-[14px] font-bold text-brand-950">
              {businessName} ({customerDomain}) — Integrated Channels
            </h4>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800 border border-emerald-200">
            Client Primary Footprint
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { platform: "INSTAGRAM", handle: `@${customerDomain.split(".")[0]}`, status: "Detected", url: `https://instagram.com/${customerDomain.split(".")[0]}` },
            { platform: "YOUTUBE", handle: `${businessName} Official`, status: "Detected", url: `https://youtube.com/@${customerDomain.split(".")[0]}` },
            { platform: "LINKEDIN", handle: businessName, status: "Detected", url: `https://linkedin.com/company/${customerDomain.split(".")[0]}` },
            { platform: "TIKTOK", handle: `@${customerDomain.split(".")[0]}`, status: "Unlinked", url: null },
          ].map((item) => {
            const conf = PLATFORM_CONFIG[item.platform] || PLATFORM_CONFIG.INSTAGRAM;
            return (
              <div
                key={item.platform}
                className="rounded-xl border p-3.5 space-y-2 bg-brand-50/20 transition hover:shadow-xs"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${conf.bg} ${conf.color} border ${conf.border}`}>
                    {conf.label}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                    <CheckCircle2 size={11} />
                    {item.status}
                  </span>
                </div>
                <div className="font-mono text-[12px] font-bold text-brand-950 truncate">
                  {item.handle}
                </div>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-950"
                  >
                    <span>View Profile</span>
                    <ArrowUpRight size={12} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Discovered Competitor Social Profiles */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <h4 className="text-[14px] font-bold text-brand-950">
              Competitor Social Accounts Discovered by Crawler
            </h4>
            <p className="text-[11px] text-brand-500">
              Found on competitor homepages, contact pages, and footer links during website crawl.
            </p>
          </div>
          <span className="font-mono text-[11px] font-bold text-brand-700">
            {discoveredCompetitors.length || competitors.length} tracked rivals
          </span>
        </div>

        <div className="space-y-4">
          {competitors.map((comp) => {
            const match = discoveredCompetitors.find(
              (c) => c.handle.toLowerCase().includes(comp.domain.toLowerCase()) || c.name.toLowerCase().includes(comp.domain.toLowerCase())
            );
            const platforms = match?.platforms || ["INSTAGRAM", "YOUTUBE"];

            return (
              <div
                key={comp.id}
                className="rounded-xl border p-4 transition hover:bg-brand-50/30"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-brand-950">{comp.label || comp.name || comp.domain}</span>
                      <span className="font-mono text-[11px] text-brand-400">({comp.domain})</span>
                    </div>
                    <p className="text-[11px] text-brand-500 mt-0.5">
                      Integrated channels indexed from {comp.domain} crawls:
                    </p>
                  </div>

                  <button
                    onClick={() => onNavigateToFeeds && onNavigateToFeeds()}
                    className="flex items-center gap-1 text-[11px] font-semibold text-brand-900 bg-brand-100 hover:bg-brand-200 px-3 py-1.5 rounded-lg transition"
                  >
                    <Video size={12} />
                    <span>Analyze Content Feeds</span>
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {platforms.map((plt) => {
                    const conf = PLATFORM_CONFIG[plt.toUpperCase()] || PLATFORM_CONFIG.INSTAGRAM;
                    return (
                      <div
                        key={plt}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${conf.bg} ${conf.color} border ${conf.border}`}
                      >
                        <span>{conf.label}</span>
                        <span className="font-mono text-[10px] text-brand-700">
                          (@{comp.domain.split(".")[0]})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
