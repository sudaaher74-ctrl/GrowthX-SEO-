"use client";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Ga4RangeKey } from "@/lib/api-client";
import { usePeriodDays } from "@/hooks/use-growthx";

/**
 * Workspaces that have already had their first GA4 fetch started from this
 * page load. Shared by every component that calls the hook, so the dashboard
 * header and a tab beneath it cannot both start one.
 */
const firstFetchStarted = new Set<string>();

/**
 * The GA4 report for the active workspace and the 7d / 28d / 90d window chosen
 * in the top bar.
 *
 * The workspace id is part of every cache key, so switching workspace (or a
 * second person signing in on the same browser) can never be served another
 * workspace's cached figures. The server enforces the same boundary — see
 * JwtAuthGuard's project check — this only keeps the client honest too.
 */
export function useGa4Report(projectId: string | null | undefined) {
  const days = usePeriodDays();
  const range: Ga4RangeKey = `${days}d`;
  const queryClient = useQueryClient();

  const report = useQuery({
    queryKey: ["ga4-report", projectId, range],
    queryFn: () => api.ga4Report(projectId!, range),
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 60_000,
  });

  const sync = useMutation({
    mutationFn: () => api.ga4Sync(projectId!),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["ga4-report", projectId] }),
  });

  // A workspace that connected GA4 before this report existed has nothing
  // cached. Fetch once for it rather than leaving a screen that says "not
  // fetched" beside a Connected badge. A failure is not retried automatically:
  // it is shown, with a Retry button.
  const { mutate } = sync;
  const state = report.data?.state;
  useEffect(() => {
    if (!projectId || state !== "NEVER_SYNCED" || firstFetchStarted.has(projectId)) return;
    firstFetchStarted.add(projectId);
    mutate();
  }, [projectId, state, mutate]);

  return { report, sync, range, days };
}
