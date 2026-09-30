"use client";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { ActionButton, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import type { GoogleOverview, GoogleSourceStatus } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { useGoogleOverview, useGoogleRefresh } from "@/hooks/use-google";
import { shortDay } from "@/lib/google-format";

function sourceTone(s: GoogleSourceStatus): "good" | "warn" | "bad" | "default" {
  if (s.state === "READY" && s.connected) return "good";
  if (s.state === "NOT_CONNECTED") return "default";
  if (s.state === "ERROR" || s.state === "NEEDS_REAUTH") return "bad";
  return "warn";
}

const STATE_TEXT: Record<string, string> = {
  READY: "CONNECTED",
  EMPTY: "CONNECTED · NO DATA",
  NEVER_SYNCED: "CONNECTED · NOT FETCHED",
  NEEDS_SELECTION: "CHOOSE PROPERTY",
  NEEDS_REAUTH: "RECONNECT",
  ERROR: "ERROR",
  NOT_CONNECTED: "NOT CONNECTED",
};

function SourceLine({ name, s, hint }: { name: string; s: GoogleSourceStatus; hint: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
      <span className="font-semibold text-brand-950">{name}</span>
      <Pill tone={sourceTone(s)}>● {STATE_TEXT[s.state] ?? s.state}</Pill>
      <span className="text-[11px] text-brand-400">
        {s.propertyName ? `${s.propertyName} · ` : ""}
        {hint}
        {s.lastSyncedAt ? ` ${relativeTime(s.lastSyncedAt)}` : " never"}
      </span>
    </div>
  );
}

function windowText(o: GoogleOverview): string {
  const parts: string[] = [`Last ${o.days} days`];
  if (o.windows.search) parts.push(`Search Console ${shortDay(o.windows.search.start)} – ${shortDay(o.windows.search.end)}`);
  if (o.windows.analytics) parts.push(`Analytics ${shortDay(o.windows.analytics.start)} – ${shortDay(o.windows.analytics.end)}`);
  return parts.join(" · ");
}

/**
 * Connection, freshness and the window every figure below covers.
 *
 * The date range itself is the 7d / 28d / 90d control in the top bar, which
 * already applies to every page; it is not duplicated here, so there is one
 * place to change it and it cannot disagree with itself.
 */
export function GoogleStatusBar({ projectId, source }: { projectId: string | null; source?: "searchConsole" | "analytics" }) {
  const { query, days } = useGoogleOverview(projectId);
  const refresh = useGoogleRefresh(projectId);
  const o = query.data;

  if (!o) {
    return (
      <div className="rounded-xl border bg-white px-4 py-3 text-[12px] text-brand-400">
        {query.error ? errorMessage(query.error) : `Loading connection status… (last ${days} days)`}
      </div>
    );
  }

  const canRefresh = o.sources.searchConsole.connected || o.sources.analytics.connected;
  if (source) {
    // One line for a single-source page: which source, its state and freshness, and a refresh.
    const s = o.sources[source];
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-4 py-2.5">
          <SourceLine name={source === "searchConsole" ? "Google Search Console" : "Google Analytics 4"} s={s} hint="last synced" />
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-brand-500">Last {o.days} days · change with 7d / 28d / 90d above</span>
            <ActionButton
              disabled={!s.connected || refresh.isPending}
              icon={<RefreshCw size={12} className={refresh.isPending ? "animate-spin" : undefined} />}
              onClick={() => refresh.mutate({ searchConsole: source === "searchConsole", analytics: source === "analytics" })}
            >
              {refresh.isPending ? "Refreshing…" : "Refresh data"}
            </ActionButton>
          </div>
        </div>
        {refresh.error && (
          <StatusNote tone="bad">
            {errorMessage(refresh.error)}{" "}
            <Link href="/integrations" className="font-semibold underline">Open Integrations</Link>
          </StatusNote>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 rounded-xl border bg-white px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1.5">
          <SourceLine name="Google Search Console" s={o.sources.searchConsole} hint="last synced" />
          <SourceLine name="Google Analytics 4" s={o.sources.analytics} hint="last synced" />
          <div className="flex flex-wrap items-center gap-x-2 text-[12px]">
            <span className="font-semibold text-brand-950">GrowthX crawler</span>
            <span className="text-[11px] text-brand-400">
              last crawl {o.sources.crawler.lastCrawledAt ? relativeTime(o.sources.crawler.lastCrawledAt) : "never"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <p className="text-[11px] text-brand-500">
            {windowText(o)}
            {o.windows.search?.comparison ? ` · compared with the previous ${o.days} days` : ""}
          </p>
          <p className="text-[10.5px] text-brand-400">
            Change the range with 7d / 28d / 90d in the top bar. Country, device and query filters need more stored history and arrive with the search views.
          </p>
          <ActionButton
            disabled={!canRefresh || refresh.isPending}
            icon={<RefreshCw size={12} className={refresh.isPending ? "animate-spin" : undefined} />}
            onClick={() => refresh.mutate({ searchConsole: o.sources.searchConsole.connected, analytics: o.sources.analytics.connected })}
          >
            {refresh.isPending ? "Refreshing…" : "Refresh data"}
          </ActionButton>
        </div>
      </div>
      {refresh.error && (
        <StatusNote tone="bad">
          {errorMessage(refresh.error)}{" "}
          <Link href="/integrations" className="font-semibold underline">
            Open Integrations
          </Link>
        </StatusNote>
      )}
    </div>
  );
}
