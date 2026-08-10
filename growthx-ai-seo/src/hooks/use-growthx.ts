"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, ApiError, auth } from "@/lib/api-client";

/** Subscribers to org changes, so useSyncExternalStore re-renders on switch. */
const orgListeners = new Set<() => void>();

function subscribeToOrgChange(listener: () => void) {
  orgListeners.add(listener);
  return () => orgListeners.delete(listener);
}

function setActiveOrg(id: string) {
  auth.setOrgId(id);
  orgListeners.forEach((l) => l());
}

/**
 * The active organization and project.
 *
 * Almost every route is scoped to one or both, so this resolves them once and
 * caches the ids locally instead of every page re-deriving them.
 */
export function useWorkspace() {
  // The stored org lives in localStorage, which the server cannot read.
  // useSyncExternalStore is built for exactly this: a client snapshot and a
  // separate server snapshot, so there is no hydration mismatch and no state
  // update inside an effect.
  const storedOrgId = useSyncExternalStore(
    subscribeToOrgChange,
    () => auth.getOrgId(),
    () => null,
  );

  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: api.listOrganizations,
    enabled: auth.isAuthenticated(),
    retry: false,
  });

  // Falls back to the first organization so a fresh login is never empty.
  const orgId = storedOrgId ?? orgs.data?.[0]?.id ?? null;

  // Persisting is a write to localStorage, not React state — safe in an effect.
  useEffect(() => {
    if (orgId && orgId !== auth.getOrgId()) setActiveOrg(orgId);
  }, [orgId]);

  const projects = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => api.listProjects(orgId!),
    enabled: Boolean(orgId),
  });

  // The client switcher needs an explicit choice, falling back to the first
  // project so the workspace is never empty on first load.
  const [chosenProjectId, setChosenProjectId] = useState<string | null>(null);

  return {
    orgId,
    setOrgId: setActiveOrg,
    organizations: orgs.data ?? [],
    projects: projects.data ?? [],
    projectId: chosenProjectId ?? projects.data?.[0]?.id ?? null,
    setProjectId: setChosenProjectId,
    isLoading: orgs.isLoading || projects.isLoading,
    error: (orgs.error ?? projects.error) as ApiError | null,
  };
}

export function usePortfolio(orgId: string | null, days = 28) {
  return useQuery({
    queryKey: ["portfolio", orgId, days],
    queryFn: () => api.getPortfolio(orgId!, days),
    enabled: Boolean(orgId),
    retry: false,
  });
}

export function usePlans() {
  return useQuery({ queryKey: ["plans"], queryFn: api.getPlans, staleTime: 5 * 60 * 1000 });
}

export function useEntitlements(orgId: string | null) {
  return useQuery({
    queryKey: ["entitlements", orgId],
    queryFn: () => api.getEntitlements(orgId!),
    enabled: Boolean(orgId),
  });
}

/** Convenience: does the current plan include this feature? */
export function useFeature(orgId: string | null, feature: string) {
  const { data, isLoading } = useEntitlements(orgId);
  return { enabled: Boolean(data?.features.includes(feature)), plan: data?.plan, isLoading };
}

export function useCheckout(orgId: string | null) {
  return useMutation({
    mutationFn: ({ plan, email, name }: { plan: string; email: string; name?: string }) =>
      api.startCheckout(orgId!, plan, email, name),
  });
}

export function useVisibility(projectId: string | null, days = 28) {
  return useQuery({
    queryKey: ["visibility", projectId, days],
    queryFn: () => api.getVisibility(projectId!, days),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useTrackedPrompts(projectId: string | null) {
  return useQuery({
    queryKey: ["tracked-prompts", projectId],
    queryFn: () => api.listTrackedPrompts(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useAddPrompts(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prompts: { text: string; cluster?: string }[]) =>
      api.addTrackedPrompts(projectId!, prompts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracked-prompts", projectId] });
    },
  });
}

export function useRunSweep(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.runVisibilitySweep(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visibility", projectId] });
      qc.invalidateQueries({ queryKey: ["tracked-prompts", projectId] });
    },
  });
}

export function useStrategies(projectId: string | null) {
  return useQuery({
    queryKey: ["strategies", projectId],
    queryFn: () => api.listStrategies(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useStrategy(projectId: string | null, reportId: string | null) {
  return useQuery({
    queryKey: ["strategy", projectId, reportId],
    queryFn: () => api.getStrategy(projectId!, reportId!),
    enabled: Boolean(projectId && reportId),
  });
}

export function useGenerateStrategy(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.generateStrategy(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies", projectId] }),
  });
}

export function useLatestCrawl(domain: string | null) {
  return useQuery({
    queryKey: ["latest-crawl", domain],
    queryFn: () => api.getLatestCrawl(domain!),
    enabled: Boolean(domain),
    retry: false,
  });
}

export function useCrawlIssues(jobId: string | null, severity?: string) {
  return useQuery({
    queryKey: ["crawl-issues", jobId, severity],
    queryFn: () => api.getCrawlIssues(jobId!, { severity, limit: 100 }),
    enabled: Boolean(jobId),
  });
}

export function useAskAi(projectId: string | null) {
  return useMutation({
    mutationFn: (question: string) => api.askAi(projectId!, question),
  });
}

export function useRepository(projectId: string | null) {
  return useQuery({
    queryKey: ["repository", projectId],
    queryFn: () => api.getRepository(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useConnectRepository(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { owner: string; name: string; accessToken: string; defaultBranch?: string; framework?: string; contentDir?: string; autoMerge?: boolean }) =>
      api.connectRepository(projectId!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repository", projectId] }),
  });
}

export function useContentPieces(projectId: string | null) {
  return useQuery({
    queryKey: ["content-pieces", projectId],
    queryFn: () => api.listContent(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function usePlanContent(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.planContent(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-pieces", projectId] }),
  });
}

export function useDraftContent(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pieceId: string) => api.draftContent(projectId!, pieceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-pieces", projectId] }),
  });
}

export function useRunContent(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pieceIds?: string[]) => api.runContentPieces(projectId!, pieceIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-pieces", projectId] });
      qc.invalidateQueries({ queryKey: ["automation-runs", projectId] });
    },
  });
}

export function useAutomationRuns(projectId: string | null) {
  return useQuery({
    queryKey: ["automation-runs", projectId],
    queryFn: () => api.listAutomationRuns(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}
