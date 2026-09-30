"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { usePeriodDays } from "@/hooks/use-growthx";

/**
 * The Google section's data, for the workspace and the 7d / 28d / 90d window
 * chosen in the top bar. The workspace and window are part of every key, so a
 * different workspace or window is never served the previous one's figures.
 */
export function useGoogleOverview(projectId: string | null | undefined) {
  const days = usePeriodDays();
  return {
    days,
    query: useQuery({
      queryKey: ["google-overview", projectId, days],
      queryFn: () => api.googleOverview(projectId!, days),
      enabled: Boolean(projectId),
      retry: false,
      staleTime: 60_000,
    }),
  };
}

export function useGooglePages(projectId: string | null | undefined, segment?: string) {
  const days = usePeriodDays();
  return {
    days,
    query: useQuery({
      queryKey: ["google-pages", projectId, days, segment ?? null],
      queryFn: () => api.googlePages(projectId!, days, segment),
      enabled: Boolean(projectId),
      retry: false,
      staleTime: 60_000,
    }),
  };
}

export function useGooglePage(projectId: string | null | undefined, url: string | null) {
  const days = usePeriodDays();
  return {
    days,
    query: useQuery({
      queryKey: ["google-page", projectId, days, url],
      queryFn: () => api.googlePage(projectId!, days, url!),
      enabled: Boolean(projectId && url),
      retry: false,
      staleTime: 60_000,
    }),
  };
}

/**
 * Fetches fresh data from each connected source, then reloads what is on screen.
 * A source that is not connected is skipped rather than asked and failed, and a
 * failure is reported by name so one broken source does not read as both.
 */
export function useGoogleRefresh(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sources: { searchConsole: boolean; analytics: boolean }) => {
      const jobs: { name: string; run: () => Promise<unknown> }[] = [];
      if (sources.searchConsole) jobs.push({ name: "Search Console", run: () => api.gscSync(projectId!) });
      if (sources.analytics) jobs.push({ name: "Google Analytics", run: () => api.ga4Sync(projectId!) });
      const results = await Promise.allSettled(jobs.map((j) => j.run()));
      const failures = results.flatMap((r, i) =>
        r.status === "rejected" ? [`${jobs[i].name}: ${errorMessage(r.reason)}`] : [],
      );
      if (failures.length > 0) throw new Error(failures.join(" "));
    },
    onSettled: () => {
      for (const key of ["google-overview", "google-pages", "google-page", "ga4-report", "google-gsc-summary", "google-gsc-timeseries", "google-gsc-queries", "google-gsc-pages", "google-gsc-declining", "google-gsc-striking", "google-gsc-ctr", "google-keywords", "google-alerts", "google-breakdown"]) {
        queryClient.invalidateQueries({ queryKey: [key, projectId] });
      }
    },
  });
}

/** GrowthX Intelligence for the workspace and the window chosen in the top bar. */
export function useGrowthIntelligence(projectId: string | null | undefined) {
  const days = usePeriodDays();
  return {
    days,
    query: useQuery({
      queryKey: ["growth-intelligence", projectId, days],
      queryFn: () => api.growthIntelligence(projectId!, days),
      enabled: Boolean(projectId),
      retry: false,
      staleTime: 60_000,
    }),
  };
}

/**
 * A stored read for the Google views, keyed by workspace and window so a
 * different workspace or range is never served the previous one's figures.
 */
function useWindowQuery<T>(name: string, projectId: string | null | undefined, fn: (projectId: string, days: number) => Promise<T>, extra: unknown[] = []) {
  const days = usePeriodDays();
  return {
    days,
    query: useQuery({
      queryKey: [`google-${name}`, projectId, days, ...extra],
      queryFn: () => fn(projectId!, days),
      enabled: Boolean(projectId),
      retry: false,
      staleTime: 60_000,
    }),
  };
}

export const useGscSummary = (p: string | null | undefined) => useWindowQuery("gsc-summary", p, api.gscSummary);
export const useGscTimeseries = (p: string | null | undefined) => useWindowQuery("gsc-timeseries", p, api.gscTimeseries);
export const useGscQueries = (p: string | null | undefined, limit = 200) =>
  useWindowQuery("gsc-queries", p, (id, d) => api.gscQueries(id, d, limit), [limit]);
export const useGscPages = (p: string | null | undefined, limit = 200) =>
  useWindowQuery("gsc-pages", p, (id, d) => api.gscPages(id, d, limit), [limit]);
export const useGoogleKeywords = (p: string | null | undefined) => useWindowQuery("keywords", p, api.googleKeywords);
export const useGoogleAlerts = (p: string | null | undefined) => useWindowQuery("alerts", p, api.googleAlerts);
export const useGoogleBreakdown = (p: string | null | undefined, dimension: "country" | "device") =>
  useWindowQuery("breakdown", p, (id, d) => api.googleBreakdown(id, d, dimension), [dimension]);
export const useGscDeclining = (p: string | null | undefined) => useWindowQuery("gsc-declining", p, api.gscDeclining);
export const useGscStriking = (p: string | null | undefined) => useWindowQuery("gsc-striking", p, api.gscStrikingDistance);
export const useGscCtrOpportunities = (p: string | null | undefined) => useWindowQuery("gsc-ctr", p, api.gscCtrOpportunities);

export function useIndexStatus(projectId: string | null | undefined) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["google-index-status", projectId],
    queryFn: () => api.searchIntelligence.indexStatus(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 60_000,
  });
  const inspect = useMutation({
    mutationFn: () => api.searchIntelligence.inspect(projectId!, {}),
    onSettled: () => client.invalidateQueries({ queryKey: ["google-index-status", projectId] }),
  });
  return { query, inspect };
}

export function useGrowthOpportunities(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["google-opportunities", projectId],
    queryFn: () => api.opportunities(projectId!, { status: "OPEN" }),
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 60_000,
  });
}

export function useChangeLedger(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["google-change-ledger", projectId],
    queryFn: () => api.searchIntelligence.changes(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 60_000,
  });
}
