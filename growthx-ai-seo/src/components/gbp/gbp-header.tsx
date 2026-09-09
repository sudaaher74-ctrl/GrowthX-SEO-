"use client";

import { useState } from "react";
import {
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Link2,
  Unlink,
  AlertTriangle,
} from "lucide-react";
import { GbpStoreIcon, GoogleGLogo } from "./gbp-icons";
import { formatGbpTimestamp } from "./gbp-states";
import { useAnalyzeGbp } from "@/hooks/use-growthx";
import type { GbpConnection, GbpProfile } from "@/lib/api-client";

interface GbpHeaderProps {
  projectId: string | null;
  connection: GbpConnection | null | undefined;
  profile: GbpProfile | null | undefined;
  activeTabTitle?: string;
  activeTabSubtitle?: string;
  onSync?: () => void;
  isSyncing?: boolean;
  /** What the last sync actually managed, including the sources it could not read. */
  lastSyncNotice?: string | null;
  onChooseLocation?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
}

/**
 * The bar above the tabs.
 *
 * Data on this screen is served from local tables that a daily scheduler
 * refreshes, so how fresh it is has to be stated rather than implied, and there
 * has to be a way to force a refresh. "Last synced" is the connection's real
 * timestamp; when there has never been a sync it says so instead of showing a
 * reassuring green light.
 */
export function GbpHeader({
  projectId,
  connection,
  profile,
  activeTabTitle,
  activeTabSubtitle,
  onSync,
  isSyncing,
  lastSyncNotice,
  onChooseLocation,
  onConnect,
  onDisconnect,
  isDisconnecting,
}: GbpHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const analyzeMutation = useAnalyzeGbp(projectId);

  const lastSynced = formatGbpTimestamp(connection?.lastSyncedAt);
  const isConnected = Boolean(connection) && connection?.state !== "NOT_CONNECTED";
  const mapsUri =
    profile?.mapsUri ??
    (profile?.businessName
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${profile.businessName} ${profile.address ?? ""}`.trim(),
        )}`
      : null);

  return (
    <div className="border-b pb-5 space-y-3" style={{ borderColor: "var(--border-color)" }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Left Branding & Title */}
        <div className="flex items-start gap-3.5">
          <div className="shrink-0 p-1 rounded-2xl bg-brand-50 border border-brand-200/80 shadow-xs">
            <GbpStoreIcon className="w-11 h-11" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-brand-950">
                Google Business Profile
              </h1>
              {activeTabTitle && activeTabTitle !== "Overview" && (
                <>
                  <span className="text-brand-300 font-normal">/</span>
                  <span className="text-base font-semibold text-brand-700">{activeTabTitle}</span>
                </>
              )}
            </div>
            <p className="mt-0.5 text-xs text-brand-500 max-w-2xl">
              {activeTabSubtitle ||
                (connection?.selectedResourceName
                  ? `Tracking ${connection.selectedResourceName} — synced from Google.`
                  : "Optimize your Google Business Profile, get more reviews, and grow your local visibility.")}
            </p>
          </div>
        </div>

        {/* Right Actions & Sync status */}
        <div className="flex flex-wrap items-center gap-3">
          {/* How fresh this data is. Never "Live": it is served from synced tables. */}
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-brand-500">
            <span
              className={`inline-flex rounded-full h-2 w-2 ${
                lastSynced ? "bg-emerald-500" : "bg-brand-300"
              }`}
            />
            <span>{lastSynced ? `Last synced: ${lastSynced}` : "Never synced"}</span>
          </div>

          <div className="relative">
            {isConnected ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onSync}
                  disabled={isSyncing || !onSync}
                  className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-xs hover:bg-brand-50 transition disabled:opacity-50"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "Syncing…" : "Sync Now"}
                </button>

                <button
                  type="button"
                  onClick={() => setDropdownOpen((open) => !open)}
                  className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-xs hover:bg-brand-50 transition"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <GoogleGLogo size={14} />
                  <span>Manage Profile</span>
                  <ChevronDown size={12} className="text-brand-400" />
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setDropdownOpen(false)} />
                    <div
                      className="absolute right-0 top-full mt-1 z-30 w-56 rounded-xl border bg-white p-1.5 shadow-lg"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onChooseLocation?.();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 transition"
                      >
                        <Link2 size={13} className="text-brand-400" />
                        Change location
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          analyzeMutation.mutate();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 transition"
                      >
                        <Sparkles size={13} className="text-brand-400" />
                        Run AI Audit
                      </button>
                      {mapsUri && (
                        <a
                          href={mapsUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 transition"
                        >
                          <ExternalLink size={13} className="text-brand-400" />
                          View on Google Maps
                        </a>
                      )}
                      <div className="my-1 border-t border-brand-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onDisconnect?.();
                        }}
                        disabled={isDisconnecting}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                      >
                        <Unlink size={13} className="text-rose-500" />
                        {isDisconnecting ? "Disconnecting…" : "Disconnect from Google"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                className="flex items-center gap-2 rounded-lg bg-brand-950 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition"
              >
                <GoogleGLogo size={14} />
                <span>Connect with Google</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {lastSyncNotice && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>{lastSyncNotice}</span>
        </div>
      )}
    </div>
  );
}
