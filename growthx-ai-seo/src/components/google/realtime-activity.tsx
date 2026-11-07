"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ActionButton, Panel } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { count } from "@/lib/google-format";

export function RealtimeActivity({ projectId, compact = false }: { projectId: string | null | undefined; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const report = useQuery({
    queryKey: ["ga4-realtime", projectId],
    queryFn: () => api.ga4Realtime(projectId!),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    retry: false,
    refetchInterval: (query) => query.state.data?.state === "READY" ? 5 * 60_000 : false,
    refetchIntervalInBackground: false,
  });
  const live = !report.isError ? report.data?.data : null;
  if (compact && !expanded) {
    const unavailable = report.isError || report.data?.state !== "READY" || !live || !Number.isFinite(live.activeUsers);
    return (
      <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200/60 bg-brand-50/70 p-5 shadow-card" aria-live="polite">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">Realtime activity</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success-500/30 bg-success-50 px-2 py-0.5 font-mono text-[10px] font-bold text-success-700">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
              Live 30m
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-brand-950" aria-label="Active users in last 30 minutes">
              {report.isPending ? "—" : unavailable ? "—" : count(live!.activeUsers)}
            </span>
            <span className="text-xs font-medium text-brand-400">active now</span>
          </div>
        </div>
        <div className="mt-3 border-t border-brand-200/50 pt-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-brand-400">
            <span className="truncate">
              {report.isPending
                ? "Loading activity…"
                : report.isError
                  ? "Realtime unavailable"
                  : unavailable
                    ? (report.data?.message ?? "Connect GA4")
                    : `Updated ${new Date(report.data.data?.fetchedAt ?? "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            </span>
            <button
              type="button"
              className="shrink-0 font-semibold text-primary-700 hover:underline"
              onClick={() => setExpanded(true)}
            >
              Details →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Panel padded title="Realtime activity" subtitle="Active users in the last 30 minutes · refreshes every 5 minutes while this page is visible"
      actions={<ActionButton disabled={report.isFetching || !projectId} onClick={() => report.refetch()}>Refresh realtime</ActionButton>}>
      <div aria-live="polite">
        {report.isPending ? <p className="text-sm text-brand-500">Loading realtime activity…</p> : report.isError ? (
          <p role="alert" className="text-sm text-error-700">Realtime activity is unavailable. {report.error.message} Use Refresh realtime to retry.</p>
        ) : live ? (
          <>
            <p className="font-mono text-3xl font-bold text-brand-950" aria-label="Active users in last 30 minutes">{count(live.activeUsers)}</p>
            <p className="mt-2 text-xs text-brand-500">GA4 property: {report.data?.propertyName ?? "Selected property"} · Fetched {new Date(live.fetchedAt).toLocaleTimeString()}</p>
            <p className="mt-2 text-xs text-brand-500">Realtime activity is separate from the historical report ending yesterday. Counts can change between refreshes.</p>
            {live.countries.length > 0 ? (
              <table className="mt-4 w-full text-left text-sm">
                <caption className="sr-only">Realtime users by country</caption>
                <thead><tr><th className="py-2 font-medium text-brand-500">Country</th><th className="py-2 text-right font-medium text-brand-500">Active users</th></tr></thead>
                <tbody>{live.countries.map((row) => <tr key={row.country} className="border-t"><td className="py-2 text-brand-950">{row.country}</td><td className="py-2 text-right font-mono text-brand-950">{count(row.activeUsers)}</td></tr>)}</tbody>
              </table>
            ) : <p className="mt-3 text-sm text-brand-500">GA4 recorded no realtime country rows in this window.</p>}
          </>
        ) : <p className="text-sm text-brand-500">{report.data?.message ?? "Choose a workspace to view realtime activity."} <Link href="/settings?tab=integrations" className="underline">Open Integrations</Link></p>}
      </div>
    </Panel>
  );
}
