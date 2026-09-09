"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  RefreshCw,
  MoreVertical,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Link2,
} from "lucide-react";
import { GbpStoreIcon, GoogleGLogo } from "./gbp-icons";
import { ConnectGbpModal } from "./connect-gbp-modal";
import { useSyncLocalReviews, useAnalyzeGbp } from "@/hooks/use-growthx";
import type { LocalSeoData } from "@/lib/api-client";

interface GbpHeaderProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
  activeTabTitle?: string;
  activeTabSubtitle?: string;
  onRefresh?: () => void;
}

export function GbpHeader({
  localSeo,
  projectId,
  activeTabTitle,
  activeTabSubtitle,
  onRefresh,
}: GbpHeaderProps) {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const syncMutation = useSyncLocalReviews(projectId);
  const analyzeMutation = useAnalyzeGbp(projectId);

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: () => {
        onRefresh?.();
      },
    });
  };

  const handleRunAudit = () => {
    analyzeMutation.mutate(undefined, {
      onSuccess: () => {
        onRefresh?.();
      },
    });
  };

  // Format last synced date safely
  const formattedSyncTime = localSeo?.updatedAt
    ? format(new Date(localSeo.updatedAt), "d MMM yyyy, h:mm a")
    : null;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5" style={{ borderColor: "var(--border-color)" }}>
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
              "Optimize your Google Business Profile, get more reviews, and grow your local visibility."}
          </p>
        </div>
      </div>

      {/* Right Actions & Sync status */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sync Indicator */}
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-brand-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>
            {formattedSyncTime ? `Last synced: ${formattedSyncTime}` : "Last synced: Live"}
          </span>
        </div>

        {/* Action Button: Connect / Manage Profile */}
        <div className="relative">
          {localSeo ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-xs hover:bg-brand-50 transition disabled:opacity-50"
                style={{ borderColor: "var(--border-color)" }}
              >
                <RefreshCw size={12} className={syncMutation.isPending ? "animate-spin" : ""} />
                {syncMutation.isPending ? "Syncing…" : "Sync Now"}
              </button>

              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
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
                    className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border bg-white p-1.5 shadow-lg"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        setConnectModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 transition"
                    >
                      <Link2 size={13} className="text-brand-400" />
                      Switch Listing
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        handleRunAudit();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 transition"
                    >
                      <Sparkles size={13} className="text-brand-400" />
                      Run AI Audit
                    </button>
                    {localSeo.businessName && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          localSeo.businessName + " " + localSeo.address
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 transition"
                      >
                        <ExternalLink size={13} className="text-brand-400" />
                        View on Google Maps
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConnectModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-950 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition"
            >
              <GoogleGLogo size={14} />
              <span>Connect Google Business Profile</span>
            </button>
          )}
        </div>
      </div>

      <ConnectGbpModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        projectId={projectId}
        onConnected={onRefresh}
      />
    </div>
  );
}
