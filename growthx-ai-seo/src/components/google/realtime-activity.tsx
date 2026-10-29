"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ActionButton, Panel } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { count } from "@/lib/google-format";

export function RealtimeActivity({ projectId }: { projectId: string | null | undefined }) {
  const report = useQuery({
    queryKey: ["ga4-realtime", projectId],
    queryFn: () => api.ga4Realtime(projectId!),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    retry: false,
    refetchInterval: (query) => query.state.data?.state === "READY" ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  const live = !report.isError ? report.data?.data : null;
  return (
    <Panel padded title="Realtime activity" subtitle="Active users in the last 30 minutes · refreshes every 30 seconds while this page is visible"
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
