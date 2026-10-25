"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api, ApiError, auth, type Role, type ProgrammaticMatrixResponse, type IssueGroupFilters } from "@/lib/api-client";
import { stagingEngine, EMPTY_STAGED_ITEMS, type StagedFixItem } from "@/lib/staging-engine";
import { supplementPlanFindings } from "@/lib/plan-sources";

const orgListeners = new Set<() => void>();
const projectListeners = new Set<() => void>();
const periodListeners = new Set<() => void>();

/**
 * The 7d / 28d / 90d window, shared by every query that has one.
 *
 * The pills in the top bar were local `useState` that nothing read: clicking
 * 90d highlighted a pill and changed no number on the page. The endpoints
 * behind portfolio, AI visibility and the executive summary all take a day
 * count already, so the control was real everywhere except in the wiring.
 *
 * Kept in the same external-store shape as the active org and project rather
 * than reaching for the unused zustand dependency, so there is one pattern in
 * this file instead of two. It is deliberately in memory only — a date range
 * is a per-session lens, not a setting to restore weeks later.
 */
export const PERIOD_DAYS = [7, 28, 90] as const;
type PeriodDays = (typeof PERIOD_DAYS)[number];

const DEFAULT_PERIOD: PeriodDays = 28;
let activePeriod: PeriodDays = DEFAULT_PERIOD;

function subscribeToPeriodChange(listener: () => void) {
  periodListeners.add(listener);
  return () => periodListeners.delete(listener);
}

export function setActivePeriod(days: PeriodDays) {
  if (days === activePeriod) return;
  activePeriod = days;
  periodListeners.forEach((l) => l());
}

/** The window every period-aware query defaults to. */
export function usePeriodDays(): PeriodDays {
  return useSyncExternalStore(
    subscribeToPeriodChange,
    () => activePeriod,
    () => DEFAULT_PERIOD,
  );
}

function subscribeToOrgChange(listener: () => void) {
  orgListeners.add(listener);
  return () => orgListeners.delete(listener);
}

function subscribeToProjectChange(listener: () => void) {
  projectListeners.add(listener);
  return () => projectListeners.delete(listener);
}

function setActiveOrg(id: string) {
  if (auth.getOrgId() !== id) {
    auth.setProjectId("");
    projectListeners.forEach((l) => l());
  }
  auth.setOrgId(id);
  orgListeners.forEach((l) => l());
}

/** Switches the whole app to another project, as the sidebar switcher does. */
export function setActiveProject(id: string) {
  auth.setProjectId(id);
  projectListeners.forEach((l) => l());
}

/**
 * The active organization and project.
 *
 * Almost every route is scoped to one or both, so this resolves them once and
 * caches the ids locally instead of every page re-deriving them.
 */
export function useWorkspace() {
  const workspaceQueries = useQueryClient();
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

  const orgList = orgs.data ?? [];
  const isStoredOrgValid = orgList.some((o) => o.id === storedOrgId);
  // Keep the last selected workspace while the directory is loading or unavailable.
  // Only a successful response can prove that a saved selection is no longer valid.
  const orgId = orgs.isSuccess
    ? (isStoredOrgValid ? storedOrgId : (orgList[0]?.id ?? null))
    : storedOrgId;

  useEffect(() => {
    if (orgId && orgId !== auth.getOrgId()) {
      setActiveOrg(orgId);
    } else if (!orgId && auth.getOrgId() && orgs.isSuccess) {
      setActiveOrg("");
    }
  }, [orgId, orgs.isSuccess]);

  const projects = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => api.listProjects(orgId!),
    enabled: Boolean(orgId),
    retry: false,
  });

  const storedProjectId = useSyncExternalStore(
    subscribeToProjectChange,
    () => auth.getProjectId(),
    () => null,
  );

  const projectList = projects.data ?? [];
  const isStoredProjectValid = projectList.some((p) => p.id === storedProjectId);
  // Another tab may have just created this project. A cached directory cannot
  // prove the selected ID was deleted; keep it while verifying with the server.
  const projectId = storedProjectId || (projects.isSuccess ? projectList[0]?.id ?? null : null);

  useEffect(() => {
    if (storedProjectId && projects.isSuccess && !isStoredProjectValid && orgId) {
      let stale = false;
      void api.listProjects(orgId).then((fresh) => {
        if (stale || auth.getProjectId() !== storedProjectId) return;
        workspaceQueries.setQueryData(["projects", orgId], fresh);
        if (!fresh.some((project) => project.id === storedProjectId)) setActiveProject(fresh[0]?.id ?? "");
      }).catch(() => {}); // Preserve selection when the directory cannot be checked.
      return () => { stale = true; };
    }
    if (projectId && projectId !== auth.getProjectId()) {
      setActiveProject(projectId);
    } else if (!projectId && auth.getProjectId() && projects.isSuccess) {
      setActiveProject("");
    }
  }, [projectId, storedProjectId, projects.isSuccess, isStoredProjectValid, orgId, workspaceQueries]);

  return {
    orgId,
    setOrgId: setActiveOrg,
    organizations: orgList,
    projects: projectList,
    projectId,
    setProjectId: setActiveProject,
    isLoading: orgs.isLoading || projects.isLoading,
    error: (orgs.error ?? projects.error) as ApiError | null,
  };
}

export function useDeleteProject(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", orgId] });
      qc.invalidateQueries({ queryKey: ["portfolio", orgId] });
    },
  });
}

export function useLocalSeo(projectId: string | null) {
  return useQuery({
    queryKey: ["local-seo", projectId],
    queryFn: () => api.getLocalSeo(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useMembers(orgId: string | null) {
  return useQuery({
    queryKey: ["members", orgId],
    queryFn: () => api.listMembers(orgId!),
    enabled: Boolean(orgId),
    retry: false,
  });
}

export function useAddMember(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role?: Role }) =>
      api.addMember(orgId!, email, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", orgId] }),
  });
}

export function useUpdateMemberRole(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: Role }) =>
      api.updateMemberRole(orgId!, memberId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", orgId] }),
  });
}

export function useRemoveMember(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => api.removeMember(orgId!, memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", orgId] }),
  });
}

export function usePortfolio(orgId: string | null, days?: number) {
  const active = usePeriodDays();
  const window = days ?? active;
  return useQuery({
    queryKey: ["portfolio", orgId, window],
    queryFn: () => api.getPortfolio(orgId!, window),
    enabled: Boolean(orgId),
    retry: false,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.getMe(),
    enabled: auth.isAuthenticated(),
    retry: false,
  });
}

/**
 * The workspace's tokens.
 *
 * Spending happens on the server, out of sight of whatever page is open, so any
 * figure here is already slightly stale. Two things keep it honest: it is
 * refetched every minute while the tab is in view, and everything that could
 * have spent tokens (a finished mutation, or a request refused for want of
 * them) invalidates the `["tokens"]` prefix — see `providers.tsx`.
 */
export function useTokens(orgId: string | null) {
  return useQuery({
    queryKey: ["tokens", orgId],
    queryFn: () => api.getTokens(orgId!),
    enabled: Boolean(orgId),
    retry: false,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/** The token ledger, a page at a time, newest first. */
export function useTokenTransactions(orgId: string | null) {
  return useInfiniteQuery({
    // Nested under "tokens" so invalidating the balance refreshes the ledger too.
    queryKey: ["tokens", orgId, "transactions"],
    queryFn: ({ pageParam }) => api.getTokenTransactions(orgId!, { cursor: pageParam, limit: 25 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(orgId),
    retry: false,
  });
}

export function useVisibility(projectId: string | null, days?: number) {
  const active = usePeriodDays();
  const window = days ?? active;
  return useQuery({
    queryKey: ["visibility", projectId, window],
    queryFn: () => api.getVisibility(projectId!, window),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useProgrammaticMatrix(projectId?: string | null, competitorId?: string) {
  return useQuery<ProgrammaticMatrixResponse>({
    queryKey: ["competitor-programmatic-matrix", projectId, competitorId],
    queryFn: () => api.getProgrammaticMatrix(projectId!, competitorId),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  });
}

/**
 * Staged fix items for a project.
 *
 * The snapshot callbacks must hand React a stable reference — `getStaged`
 * caches per project and the server snapshot is a shared constant, otherwise
 * `useSyncExternalStore` re-renders in a loop and takes the page down.
 */
export function useStagedFixItems(projectId: string | null): StagedFixItem[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => stagingEngine.subscribe(projectId, onStoreChange),
    [projectId]
  );
  const getSnapshot = useCallback(() => stagingEngine.getStaged(projectId), [projectId]);
  const getServerSnapshot = useCallback(() => EMPTY_STAGED_ITEMS, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useLatestCrawl(domain: string | null) {
  return useQuery({
    queryKey: ["latest-crawl", domain],
    queryFn: () => api.getLatestCrawl(domain!),
    enabled: Boolean(domain),
    retry: false,
    // A crawl started in another tab won't show up here on its own: this
    // query only polls once ITS OWN cached status says RUNNING/PENDING, and
    // the client disables refetchOnWindowFocus globally. Re-checking on
    // focus is what notices the other tab's crawl and starts the interval
    // above ticking.
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      query.state.data?.status === "RUNNING" || query.state.data?.status === "PENDING" ? 3000 : false,
  });
}

export function useStartCrawl(_websiteId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      websiteId?: string;
      domain?: string;
      maxDepth?: number;
      maxConcurrency?: number;
      useSitemap?: boolean;
    }) => api.startCrawl(params),
    onSuccess: (_, variables) => {
      if (variables.domain) {
        qc.invalidateQueries({ queryKey: ["latest-crawl", variables.domain] });
        qc.invalidateQueries({ queryKey: ["crawl-history", variables.domain] });
      }
    },
  });
}

export function useCancelCrawl(domain: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.cancelCrawl(jobId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["latest-crawl", domain] }),
        qc.invalidateQueries({ queryKey: ["crawl-history", domain] }),
      ]);
    },
  });
}

/**
 * Completed crawls for a domain, oldest first.
 *
 * Separate from useLatestCrawl because the two answer different questions and
 * have different refresh needs: the latest crawl polls while one is running,
 * whereas history only changes when a run finishes.
 */
export function useCrawlHistory(domain: string | null, limit?: number) {
  return useQuery({
    queryKey: ["crawl-history", domain, limit],
    queryFn: () => api.getCrawlHistory(domain!, limit),
    enabled: Boolean(domain),
    retry: false,
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

export function useCreateContentPiece(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; targetQuery?: string; format?: string; rationale?: string }) =>
      api.createContentPiece(projectId!, body),
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

// ── Market research

/**
 * The headline figures, computed on the server.
 *
 * Shared rather than redefined per page on purpose. The reports page used to
 * derive its own version of site health from a client-side formula, and the
 * two disagreed: the server reports what it counted and says why when it
 * counted nothing, while the page scored a site it had never crawled at 100
 * out of 100. Two definitions of the same number is how a client ends up with
 * a PDF that contradicts the dashboard it was exported from.
 */
export function useExecutiveSummary(projectId: string | null, days?: number) {
  const active = usePeriodDays();
  const window = days ?? active;
  return useQuery({
    queryKey: ["executive-summary", projectId, window],
    queryFn: () => api.executiveSummary(projectId!, window),
    enabled: Boolean(projectId),
    retry: false,
  });
}

/**
 * How many things are wrong with the site, counted once.
 *
 * The dashboard, the audit and the Fix Engine all read this. Each used to count
 * for itself, and one crawl was reported as 100, 156 and 100 at once, with a
 * severity breakdown of 0/0/0/0 printed above a list of HIGH findings. Share
 * this query key and the three screens cannot disagree.
 */
export function useIssueCounts(projectId: string | null, days?: number) {
  const active = usePeriodDays();
  const window = days ?? active;
  return useQuery({
    queryKey: ["issue-counts", projectId, window],
    queryFn: () => api.issueCounts(projectId!, window),
    enabled: Boolean(projectId),
    retry: false,
    // Same reasoning as useLatestCrawl: a recrawl kicked off in another tab
    // otherwise leaves these counts (e.g. pagesCrawled) stale here until
    // something else happens to trigger a refetch.
    refetchOnWindowFocus: true,
  });
}

/** Open findings grouped by problem, highest impact first. */
export function useIssueGroups(
  projectId: string | null,
  filters: IssueGroupFilters = {},
  days?: number,
) {
  const active = usePeriodDays();
  const window = days ?? active;
  return useQuery({
    queryKey: ["issue-groups", projectId, filters.severity ?? null, filters.limit ?? null, window],
    queryFn: () => api.issueGroups(projectId!, filters, window),
    enabled: Boolean(projectId),
    retry: false,
  });
}

/** Unified ranked findings across all detector modules. */
export function useFindings(
  projectId: string | null,
  filters: {
    status?: string;
    lifecycle?: string;
    source?: string;
    fixClass?: string;
    category?: string;
    limit?: number;
    cursor?: string;
  } = {},
) {
  return useQuery({
    queryKey: [
      "findings",
      projectId,
      filters.status ?? null,
      filters.lifecycle ?? null,
      filters.source ?? null,
      filters.fixClass ?? null,
      filters.category ?? null,
      filters.limit ?? null,
      filters.cursor ?? null,
    ],
    queryFn: async () => {
      // Findings are a materialized view of the audit and the other detector
      // sources. Reconcile before reading so a completed audit cannot show 14
      // problems on Website Audit and an empty Fix Engine until the nightly
      // scheduler happens to run.
      const sync = await api.syncFindings(projectId!).catch(() => ({ created: 0, updated: 0, resolved: 0, warnings: [] }));
      const first = await api.findings(projectId!, filters);
      if (filters.cursor) return { ...first, warnings: sync.warnings ?? [] };
      const items = [...first.items];
      const seen = new Set<string>();
      let cursor = first.nextCursor;
      while (cursor) {
        if (seen.has(cursor)) throw new Error("The plan could not load all findings. Please retry.");
        seen.add(cursor);
        const page = await api.findings(projectId!, { ...filters, cursor });
        items.push(...page.items);
        cursor = page.nextCursor;
      }
      const supplemented = supplementPlanFindings(items, projectId!);
      return { ...first, items: supplemented, nextCursor: null, warnings: sync.warnings ?? [] };
    },
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 60 * 1000,
  });
}

export function useTransitionFinding(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      to,
      reason,
      snoozeUntil,
    }: {
      id: string;
      to: string;
      reason?: string;
      snoozeUntil?: string;
    }) => api.transitionFinding(projectId!, id, { to, reason, snoozeUntil }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["findings", projectId] });
      qc.invalidateQueries({ queryKey: ["issue-groups", projectId] });
      qc.invalidateQueries({ queryKey: ["issue-counts", projectId] });
    },
  });
}


// ─────────────────────────────────────────────────────────────── Business
