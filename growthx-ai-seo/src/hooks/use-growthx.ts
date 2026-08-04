"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError, auth } from "@/lib/api-client";

/**
 * The active organization and project.
 *
 * Almost every route is scoped to one or both, so this resolves them once and
 * caches the ids locally instead of every page re-deriving them.
 */
export function useWorkspace() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: api.listOrganizations,
    enabled: auth.isAuthenticated(),
    retry: false,
  });

  useEffect(() => {
    const stored = auth.getOrgId();
    if (stored) {
      setOrgId(stored);
      setReady(true);
      return;
    }
    if (orgs.data?.length) {
      auth.setOrgId(orgs.data[0].id);
      setOrgId(orgs.data[0].id);
    }
    if (orgs.isFetched) setReady(true);
  }, [orgs.data, orgs.isFetched]);

  const projects = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => api.listProjects(orgId!),
    enabled: Boolean(orgId),
  });

  // The client switcher needs an explicitly chosen project, falling back to the
  // first one so the workspace is never empty on first load.
  const [chosenProjectId, setChosenProjectId] = useState<string | null>(null);

  return {
    orgId,
    setOrgId: (id: string) => {
      auth.setOrgId(id);
      setOrgId(id);
    },
    organizations: orgs.data ?? [],
    projects: projects.data ?? [],
    projectId: chosenProjectId ?? projects.data?.[0]?.id ?? null,
    setProjectId: setChosenProjectId,
    isLoading: orgs.isLoading || projects.isLoading || !ready,
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
