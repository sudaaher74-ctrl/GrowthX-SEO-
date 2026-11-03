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
      <div className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-5 shadow-card" aria-live="polite">
        <p className="text-xs font-medium text-brand-400">Realtime activity</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-extrabold tracking-tight text-brand-950" aria-label="Active users in last 30 minutes">
            {report.isPending ? "—" : unavailable ? "—" : count(live!.activeUsers)}
          </span>
          <span className="text-xs text-brand-400">active in 30 min</span>
        </div>
        <p className="mt-2 text-xs text-brand-400">
          {report.isPending ? "Loading activity…" : report.isError ? "Realtime activity is unavailable" : unavailable ? (report.data?.message ?? "Connect Google Analytics to see activity") : `Last 30 minutes · updated ${new Date(report.data.data?.fetchedAt ?? "").toLocaleTimeString()}`}
        </p>
        <p className="mt-1 text-[11px] text-brand-400">Refreshes every 5 minutes</p>
        <button type="button" className="mt-2 text-xs text-primary-700 underline" onClick={() => setExpanded(true)}>View realtime details</button>
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
