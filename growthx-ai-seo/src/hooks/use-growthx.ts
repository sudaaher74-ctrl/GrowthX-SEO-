"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  api,
  ApiError,
  auth,
  askResearchStream,
  type ResearchProgressEvent,
  type Role,
  type AddCreatorBody,
  type SprintExecutionResult,
  type VerificationCertificate,
  type GeoSimulationResult,
  type SimulateGeoBody,
  type InterceptAnalysisResponse,
  type InterceptBlueprint,
  type GenerateBlueprintBody,
  type ProgrammaticMatrixResponse,
  type DispatchFindingBody,
  type InternalLinkingMeshResponse,
  type GenerateLinkPatchBody,
  type LinkSculptingPatch,
  type CrawlJob,
  type StrategyPlan,
  type IssueGroupFilters,
} from "@/lib/api-client";
import { stagingEngine, EMPTY_STAGED_ITEMS, type StagedFixItem } from "@/lib/staging-engine";

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
export type PeriodDays = (typeof PERIOD_DAYS)[number];

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
  const orgId = isStoredOrgValid ? storedOrgId : (orgList[0]?.id ?? null);

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
  const projectId = isStoredProjectValid ? storedProjectId : (projectList[0]?.id ?? null);

  useEffect(() => {
    if (projectId && projectId !== auth.getProjectId()) {
      setActiveProject(projectId);
    } else if (!projectId && auth.getProjectId() && projects.isSuccess) {
      setActiveProject("");
    }
  }, [projectId, projects.isSuccess]);

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

export function useCreateProject(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createProject(name, orgId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", orgId] });
      qc.invalidateQueries({ queryKey: ["portfolio", orgId] });
    },
  });
}

export function useActivity(projectId: string | null) {
  return useQuery({
    queryKey: ["activity", projectId],
    queryFn: () => api.getActivity(projectId!),
    enabled: Boolean(projectId),
    retry: false,
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

export function useSearchLocalBusiness(projectId: string | null) {
  return useMutation({
    mutationFn: (query: string) => api.searchLocalBusiness(projectId!, query),
  });
}

export function useConnectLocalBusiness(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { businessName: string; address: string; rating: number; reviewCount: number; placeId?: string; latitude?: number; longitude?: number }) => 
      api.connectLocalBusiness(projectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["local-seo", projectId] });
      qc.invalidateQueries({ queryKey: ["gbp-proposals", projectId] });
      // A newly attached Maps listing fills the Business Profile tabs from its
      // public data, so every one of them has something new to show.
      invalidateGbp(qc, projectId);
    },
  });
}

export function useGbpProposals(projectId: string | null) {
  return useQuery({
    queryKey: ["gbp-proposals", projectId],
    queryFn: () => api.getGbpProposals(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useRunGeoGridScan(projectId: string | null) {
  return useMutation({
    mutationFn: (body: Parameters<typeof api.runGeoGridScan>[1]) =>
      api.runGeoGridScan(projectId!, body),
  });
}

export function useGeoGridHistory(projectId: string | null, keyword?: string) {
  return useQuery({
    queryKey: ["geo-grid-history", projectId, keyword],
    queryFn: () => api.getGeoGridHistory(projectId!, keyword),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useLocalReviews(projectId: string | null) {
  return useQuery({
    queryKey: ["local-reviews", projectId],
    queryFn: () => api.getLocalReviews(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useSyncLocalReviews(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.syncLocalReviews(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["local-reviews", projectId] }),
  });
}

export function useDraftReviewReply(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: string | { reviewId: string; tone?: string }) => {
      const reviewId = typeof args === "string" ? args : args.reviewId;
      const tone = typeof args === "string" ? undefined : args.tone;
      return api.draftReviewReply(projectId!, reviewId, tone);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["local-reviews", projectId] }),
  });
}

export function usePublishReviewReply(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, replyText }: { reviewId: string; replyText: string }) => api.publishReviewReply(projectId!, reviewId, replyText),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["local-reviews", projectId] }),
  });
}

// ── Google Business Profile (the real Google connector)
//
// Every read here serves from the backend's synced tables and carries the
// connection and source envelopes, so the hooks deliberately do not unwrap the
// payload: a tab needs to know *why* a list is empty as much as it needs the
// list. `retry: false` throughout — a 403 from Google means the Cloud project
// is not approved yet, and retrying it three times only makes the wait longer.

/** The provider id the OAuth endpoints use for Business Profile. */
export const GBP_PROVIDER = "business_profile";

/** Everything on the Business Profile screen that a sync or a reconnect changes. */
const GBP_QUERY_KEYS = [
  "google-integrations",
  "gbp-overview",
  "gbp-metrics",
  "gbp-reviews",
  "gbp-photos",
  "gbp-posts",
  "gbp-services",
  "gbp-categories",
  "gbp-locations",
] as const;

function invalidateGbp(qc: ReturnType<typeof useQueryClient>, projectId: string | null) {
  for (const key of GBP_QUERY_KEYS) qc.invalidateQueries({ queryKey: [key, projectId] });
}

export function useGoogleIntegrations(projectId: string | null) {
  return useQuery({
    queryKey: ["google-integrations", projectId],
    queryFn: () => api.getGoogleIntegrations(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useGbpOverview(projectId: string | null) {
  return useQuery({
    queryKey: ["gbp-overview", projectId],
    queryFn: () => api.getGbpOverview(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useGbpMetrics(projectId: string | null, days = 28) {
  return useQuery({
    queryKey: ["gbp-metrics", projectId, days],
    queryFn: () => api.getGbpMetrics(projectId!, days),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useGbpReviews(projectId: string | null) {
  return useQuery({
    queryKey: ["gbp-reviews", projectId],
    queryFn: () => api.getGbpReviews(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useGbpPhotos(projectId: string | null) {
  return useQuery({
    queryKey: ["gbp-photos", projectId],
    queryFn: () => api.getGbpPhotos(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useGbpPosts(projectId: string | null) {
  return useQuery({
    queryKey: ["gbp-posts", projectId],
    queryFn: () => api.getGbpPosts(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useGbpServices(projectId: string | null) {
  return useQuery({
    queryKey: ["gbp-services", projectId],
    queryFn: () => api.getGbpServices(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useGbpCategories(projectId: string | null) {
  return useQuery({
    queryKey: ["gbp-categories", projectId],
    queryFn: () => api.getGbpCategories(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

/**
 * The picker's list. Unlike every other Business Profile read this one calls
 * Google live, so it is only fetched when a picker is actually on screen.
 */
export function useGbpLocations(projectId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["gbp-locations", projectId],
    queryFn: () => api.getGbpLocations(projectId!),
    enabled: Boolean(projectId) && enabled,
    retry: false,
  });
}

/** Starts the real Google consent flow. The caller navigates to the URL returned. */
export function useAuthorizeGoogleProvider(projectId: string | null) {
  return useMutation({
    mutationFn: ({ provider, returnTo }: { provider: string; returnTo?: string }) =>
      api.authorizeGoogleProvider(projectId!, provider, returnTo),
  });
}

export function useSelectGoogleResource(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      resourceId,
      resourceName,
    }: {
      provider: string;
      resourceId: string;
      resourceName: string;
    }) => api.selectGoogleResource(projectId!, provider, resourceId, resourceName),
    onSuccess: () => invalidateGbp(qc, projectId),
  });
}

export function useSyncBusinessProfile(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days?: number) => api.syncBusinessProfile(projectId!, days),
    onSuccess: () => {
      invalidateGbp(qc, projectId);
      // The public listing refresh also updates the tracked location's rating.
      qc.invalidateQueries({ queryKey: ["local-seo", projectId] });
    },
    // A sync that Business Profile refused still records that refusal on the
    // connection, which every tab reads.
    onError: () => invalidateGbp(qc, projectId),
  });
}

/** One Maps search from this project's listing. A mutation: each search is a billed Places call. */
export function usePlacesCompetitors(projectId: string | null) {
  return useMutation({
    mutationFn: ({ keyword, radiusKm }: { keyword: string; radiusKm?: number }) =>
      api.getPlacesCompetitors(projectId!, keyword, radiusKm),
  });
}

export function useDisconnectGoogleProvider(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => api.disconnectGoogleProvider(projectId!, provider),
    onSuccess: () => invalidateGbp(qc, projectId),
  });
}

/** Publishes a reply against a synced Google review, then refreshes the reviews tab. */
export function usePublishGbpReviewReply(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, replyText }: { reviewId: string; replyText: string }) =>
      api.publishReviewReply(projectId!, reviewId, replyText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gbp-reviews", projectId] });
      qc.invalidateQueries({ queryKey: ["local-reviews", projectId] });
    },
  });
}

/** Drafts a reply for a synced Google review, then refreshes the reviews tab. */
export function useDraftGbpReviewReply(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, tone }: { reviewId: string; tone?: string }) =>
      api.draftReviewReply(projectId!, reviewId, tone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gbp-reviews", projectId] });
      qc.invalidateQueries({ queryKey: ["local-reviews", projectId] });
    },
  });
}

export function useAnalyzeGbp(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.analyzeGbp(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gbp-proposals", projectId] }),
  });
}

export function useApproveGbpFix(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => api.approveGbpFix(projectId!, proposalId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gbp-proposals", projectId] }),
  });
}

export function useRejectGbpFix(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => api.rejectGbpFix(projectId!, proposalId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gbp-proposals", projectId] }),
  });
}

export function useOutreach(projectId: string | null) {
  return useQuery({
    queryKey: ["outreach", projectId],
    queryFn: () => api.getOutreachCampaigns(projectId!),
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
      qc.invalidateQueries({ queryKey: ["question-analysis", projectId] });
      qc.invalidateQueries({ queryKey: ["question-suggestions", projectId] });
    },
  });
}

/** Each tracked question joined to the Website Audit and Competitor Intelligence. */
export function useQuestionAnalysis(projectId: string | null) {
  return useQuery({
    queryKey: ["question-analysis", projectId],
    queryFn: () => api.getQuestionAnalysis(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

/** Buyer questions drawn from your pages, rivals' pages and open content gaps. */
export function useQuestionSuggestions(projectId: string | null) {
  return useQuery({
    queryKey: ["question-suggestions", projectId],
    queryFn: () => api.getQuestionSuggestions(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

/** AI Visibility findings as SEO Roadmap tasks. */
export function useAiVisibilityRoadmapTasks(projectId: string | null) {
  return useQuery({
    queryKey: ["aivis-roadmap", projectId],
    queryFn: () => api.getAiVisibilityRoadmapTasks(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

/**
 * AI-written analysis of the measured citation data. Keyed on the report, so
 * it refreshes after a sweep. `question` asks something specific of the data.
 */
export function useVisibilityInsights(projectId: string | null, question?: string) {
  return useQuery({
    queryKey: ["visibility-insights", projectId, question ?? ""],
    queryFn: () => api.getVisibilityInsights(projectId!, question),
    enabled: Boolean(projectId),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useAeo(projectId: string | null) {
  return useQuery({
    queryKey: ["aeo", projectId],
    queryFn: () => api.getAeo(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function useAutonomousPlanStatus(projectId: string | null) {
  return useQuery({
    queryKey: ["autonomous-plan-status", projectId],
    queryFn: () => api.actionEngineAutonomousPlanStatus(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  });
}

export function useApproveAutonomousPlan(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.actionEngineApproveAutonomousPlan(projectId!),
    onSuccess: (data) => {
      qc.setQueryData(["autonomous-plan-status", projectId], data);
      qc.invalidateQueries({ queryKey: ["autonomous-plan-status", projectId] });
    },
  });
}

export function useExecuteSprint(projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation<
    SprintExecutionResult,
    Error,
    { sprintWeek?: number; actionIds?: string[] } | undefined
  >({
    mutationFn: (params?: { sprintWeek?: number; actionIds?: string[] }) => {
      if (!projectId) {
        return Promise.resolve({
          success: true,
          sprintWeek: params?.sprintWeek ?? 1,
          executedCount: 0,
          executedIds: [],
          planStatus: {
            projectId: projectId || "",
            isApproved: true,
            approvedAt: new Date().toISOString(),
            currentDay: Math.min(30, (params?.sprintWeek ?? 1) * 7),
            totalDays: 30,
            runId: null,
            status: "ACTIVE_AUTONOMOUS",
            actionsCount: 0,
            completedActionsCount: 0,
          },
        });
      }
      return api.actionEngineExecuteSprint(projectId, params ?? {});
    },
    onSuccess: (data) => {
      if (projectId) {
        qc.setQueryData(["autonomous-plan-status", projectId], data.planStatus);
        qc.invalidateQueries({ queryKey: ["autonomous-plan-status", projectId] });
        qc.invalidateQueries({ queryKey: ["action-engine-strategy", projectId] });
      }
      qc.invalidateQueries({ queryKey: ["crawl-issues"] });
    },
  });
}

export function useRunVerification(projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation<
    VerificationCertificate,
    Error,
    { issueIds?: string[]; urls?: string[]; sprintWeek?: number } | undefined
  >({
    mutationFn: (body) => {
      // Without a project there is nothing to re-fetch, so there is no
      // certificate. This used to return a PASSED one for aivaenterprises.com.
      if (!projectId) {
        throw new Error("Select a project before running verification.");
      }
      return api.runVerification(projectId, body ?? {});
    },
    onSuccess: (data) => {
      if (projectId) {
        qc.setQueryData(["verification-latest", projectId], data);
        qc.invalidateQueries({ queryKey: ["verification-latest", projectId] });
      }
      qc.invalidateQueries({ queryKey: ["crawl-issues"] });
      qc.invalidateQueries({ queryKey: ["latest-crawl"] });
      qc.invalidateQueries({ queryKey: ["autonomous-plan-status"] });
    },
  });
}

export function useLatestVerification(projectId?: string | null) {
  return useQuery<VerificationCertificate | null>({
    queryKey: ["verification-latest", projectId],
    queryFn: () => (projectId ? api.getLatestVerification(projectId) : null),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  });
}

export function useSimulateGeo(projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation<GeoSimulationResult, Error, SimulateGeoBody>({
    mutationFn: (body) => {
      if (!projectId) {
        throw new Error("Select a project before running a simulation.");
      }
      return api.simulateGeo(projectId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visibility-report"] });
      qc.invalidateQueries({ queryKey: ["tracked-prompts"] });
    },
  });
}

export function useCompetitorIntercepts(projectId?: string | null, competitorId?: string) {
  return useQuery<InterceptAnalysisResponse>({
    queryKey: ["competitor-intercepts", projectId, competitorId],
    queryFn: () => (projectId ? api.getCompetitorIntercepts(projectId, competitorId) : Promise.resolve({
      scoreboard: {
        totalPoachable: 0,
        primeTargetsCount: 0,
        searchImpressionsAtStake: 0,
        averageVulnerabilityScore: 0,
        topDefectArea: null,
      },
      opportunities: [],
    })),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  });
}

export function useGenerateCounterAttackBlueprint(projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation<InterceptBlueprint, Error, GenerateBlueprintBody>({
    mutationFn: (body) => {
      if (!projectId) {
        throw new Error("projectId required to generate blueprint");
      }
      return api.generateCounterAttackBlueprint(projectId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitor-intercepts", projectId] });
    },
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

export function useDispatchFindingToQueue(projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation<{ success: boolean; message: string; opportunityId: string; fingerprint: string }, Error, DispatchFindingBody>({
    mutationFn: (body) => {
      if (!projectId) {
        throw new Error("projectId required to dispatch finding");
      }
      return api.dispatchFindingToQueue(projectId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities", projectId] });
      qc.invalidateQueries({ queryKey: ["action-queue", projectId] });
      qc.invalidateQueries({ queryKey: ["findings", projectId] });
    },
  });
}


export function useInternalLinkingMesh(projectId?: string | null) {
  return useQuery<InternalLinkingMeshResponse>({
    queryKey: ["internal-linking-mesh", projectId],
    queryFn: () => api.getInternalLinkingMesh(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  });
}

export function useGenerateLinkSculptingPatch(projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation<LinkSculptingPatch, Error, GenerateLinkPatchBody>({
    mutationFn: (body) => {
      if (!projectId) throw new Error("projectId required to generate link sculpting patch");
      return api.generateLinkSculptingPatch(projectId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internal-linking-mesh", projectId] });
    },
  });
}

export function useTopicClusters(projectId?: string | null) {
  return useQuery({
    queryKey: ["topic-clusters", projectId],
    queryFn: () => api.getTopicClusters(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCannibalizationReport(projectId?: string | null) {
  return useQuery({
    queryKey: ["cannibalization-report", projectId],
    queryFn: () => api.detectCannibalization(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useContentVelocityCalendar(projectId?: string | null) {
  return useQuery({
    queryKey: ["content-velocity-calendar", projectId],
    queryFn: () => api.getContentVelocityCalendar(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useActionEngineStrategy(projectId: string | null) {
  return useQuery({
    queryKey: ["action-engine-strategy", projectId],
    queryFn: () => api.actionEngineStrategy(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  });
}

export function useActionEngineFindings(projectId: string | null, category?: string) {
  return useQuery({
    queryKey: ["action-engine-findings", projectId, category],
    queryFn: () => api.actionEngineFindings(projectId!, category),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  });
}

export function useActionEngineGenerate(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.actionEngineGenerate(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["action-engine-strategy", projectId] });
      qc.invalidateQueries({ queryKey: ["action-engine-findings", projectId] });
      qc.invalidateQueries({ queryKey: ["autonomous-plan-status", projectId] });
    },
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

export function useAddCompetitor(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domain, label }: { domain: string; label?: string }) =>
      api.addCompetitor(projectId!, domain, label),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visibility", projectId] });
      qc.invalidateQueries({ queryKey: ["competitors", projectId] });
      qc.invalidateQueries({ queryKey: ["competitor-intelligence", projectId] });
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
      qc.invalidateQueries({ queryKey: ["visibility-insights", projectId] });
      qc.invalidateQueries({ queryKey: ["question-analysis", projectId] });
      qc.invalidateQueries({ queryKey: ["aivis-roadmap", projectId] });
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

export function useCrawlIssues(
  jobId: string | null,
  paramsOrSeverity?:
    | string
    | {
        severity?: string;
        category?: string;
        confidence?: string;
        search?: string;
        page?: number;
        limit?: number;
      },
  status?: string,
) {
  const params =
    typeof paramsOrSeverity === "string"
      ? { severity: paramsOrSeverity, limit: 100 }
      : { limit: 100, ...paramsOrSeverity };

  return useQuery({
    queryKey: ["crawl-issues", jobId, params, status],
    queryFn: () => api.getCrawlIssues(jobId!, params),
    enabled: Boolean(jobId),
    refetchInterval: status === "RUNNING" || status === "PENDING" ? 3000 : false,
  });
}

export function useAnalyzeIssue() {
  return useMutation({
    mutationFn: (issueId: string) => api.analyzeIssue(issueId),
  });
}

export function useAutoFixIssue() {
  return useMutation({
    mutationFn: (issueId: string) => api.autoFixIssue(issueId),
  });
}

export function useApproveFix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) => api.approveFix(issueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crawl-issues"] });
    }
  });
}

export function useCrawlPages(jobId: string | null, status?: string) {
  return useQuery({
    queryKey: ["crawl-pages", jobId],
    queryFn: () => api.getCrawlPages(jobId!, { limit: 100 }),
    enabled: Boolean(jobId),
    refetchInterval: status === "RUNNING" || status === "PENDING" ? 3000 : false,
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

/**
 * Applies fixes to the connected repository and opens a pull request.
 *
 * The run clones, patches, installs and builds before it pushes, so this is
 * minutes rather than milliseconds. It resolves with the finished run — the
 * pull request URL when one was opened, or the step log saying where it
 * stopped.
 */
export function useRunFixes(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (issueIds?: string[]) => api.runFixes(projectId!, issueIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-runs", projectId] });
      qc.invalidateQueries({ queryKey: ["crawl-issues", projectId] });
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

export function useReporting(projectId: string | null) {
  return useQuery({
    queryKey: ["reporting", projectId],
    queryFn: () => api.getReportingConfig(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useMarketIntelligence(projectId: string | null) {
  return useQuery({
    queryKey: ["market", projectId],
    queryFn: () => api.getMarketIntelligence(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useGenerateMarket(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.generateMarketIntelligence(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["market", projectId] }),
  });
}

export function useMonitoring(projectId: string | null) {
  return useQuery({
    queryKey: ["monitoring", projectId],
    queryFn: () => api.getMonitoring(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useIntegrations(projectId: string | null) {
  return useQuery({
    queryKey: ["integrations", projectId],
    queryFn: () => api.getIntegrations(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

// ── Market research

export function useResearchThreads(projectId: string | null) {
  return useQuery({
    queryKey: ["research-threads", projectId],
    queryFn: () => api.listResearchThreads(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useResearchThread(projectId: string | null, threadId: string | null) {
  return useQuery({
    queryKey: ["research-thread", projectId, threadId],
    queryFn: () => api.getResearchThread(projectId!, threadId!),
    enabled: Boolean(projectId && threadId),
    retry: false,
  });
}

/**
 * Runs a research question over the streaming route, reporting each stage to
 * `onProgress` as the backend reaches it.
 *
 * Still a mutation, so `isPending` and the thread invalidation behave exactly
 * as they did; the streaming happens inside `mutationFn` and the resolved
 * value is the same finished result the one-shot route returns. Against an API
 * without the streaming route the client falls back to that route, and the run
 * simply reports no progress.
 */
export function useAskResearch(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      onProgress,
      ...body
    }: {
      question: string;
      threadId?: string;
      deepResearch?: boolean;
      onProgress?: (event: ResearchProgressEvent) => void;
    }) =>
      askResearchStream(projectId!, body, (event) => {
        if (event.type === "progress") onProgress?.(event);
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["research-threads", projectId] });
    },
  });
}

export function useMarketActions(projectId: string | null, status?: "PROPOSED" | "APPROVED" | "REJECTED" | "CONVERTED") {
  return useQuery({
    queryKey: ["market-actions", projectId, status ?? "all"],
    queryFn: () => api.listMarketActions(projectId!, status),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useMarketOpportunities(projectId: string | null) {
  return useQuery({
    queryKey: ["market-opportunities", projectId],
    queryFn: () => api.listMarketOpportunities(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

/** Approve, reject, or convert — all invalidate the queue so it reflects reality. */
export function useMarketActionDecision(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, decision }: { actionId: string; decision: "approve" | "reject" | "convert" }) => {
      if (decision === "approve") return api.approveMarketAction(projectId!, actionId);
      if (decision === "reject") return api.rejectMarketAction(projectId!, actionId);
      return api.convertMarketAction(projectId!, actionId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["market-actions", projectId] });
    },
  });
}

export function useMarketOutcomes(projectId: string | null) {
  return useQuery({
    queryKey: ["market-outcomes", projectId],
    queryFn: () => api.listMarketOutcomes(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

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

/**
 * Every affected page of one group. Only fetched once a row is expanded, so
 * the queue does not pay for page lists nobody opens.
 */
export function useIssueGroupPages(
  projectId: string | null,
  groupKey: string | null,
  cursor?: string,
) {
  return useQuery({
    queryKey: ["issue-group-pages", projectId, groupKey, cursor ?? null],
    queryFn: () => api.issueGroupPages(projectId!, groupKey!, 100, cursor),
    enabled: Boolean(projectId && groupKey),
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
    queryFn: () => api.findings(projectId!, filters),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useSyncFindings(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.syncFindings(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["findings", projectId] });
      qc.invalidateQueries({ queryKey: ["issue-groups", projectId] });
      qc.invalidateQueries({ queryKey: ["issue-counts", projectId] });
    },
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

export function useCreators(projectId: string | null) {
  return useQuery({
    queryKey: ["creators", projectId],
    queryFn: () => (projectId ? api.listCreators(projectId) : Promise.resolve([])),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useAddCreator(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddCreatorBody) => api.addCreator(projectId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creators"] });
      qc.invalidateQueries({ queryKey: ["ci-creators"] });
    },
  });
}

export function useDeleteCreator(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (creatorId: string) => api.deleteCreator(projectId!, creatorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creators"] });
      qc.invalidateQueries({ queryKey: ["ci-creators"] });
    },
  });
}


// ─────────────────────────────────────────────────────────── Design Studio

/**
 * Summary counts, publishing target and last snapshot for the Design Studio
 * header. Disabled without a project: there is nothing to count until one is
 * selected, and firing the query anyway would render zeros that mean
 * "no project" rather than "none found".
 */
export function useDesignStudioOverview(projectId: string | null) {
  return useQuery({
    queryKey: ["design-studio", "overview", projectId],
    queryFn: () => api.designStudio.overview(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useDesignSuggestions(
  projectId: string | null,
  filter?: { status?: string; contentType?: string },
) {
  return useQuery({
    queryKey: ["design-studio", "suggestions", projectId, filter?.status, filter?.contentType],
    queryFn: () => api.designStudio.suggestions(projectId!, filter),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useDesignPublishedChanges(projectId: string | null) {
  return useQuery({
    queryKey: ["design-studio", "published", projectId],
    queryFn: () => api.designStudio.published(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useDesignStudioHistory(projectId: string | null) {
  return useQuery({
    queryKey: ["design-studio", "history", projectId],
    queryFn: () => api.designStudio.history(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

/**
 * The stored HTML behind the preview.
 *
 * Kept separate from the suggestion list because it is large and changes only
 * when the snapshot does — refetching it on every suggestion click would pull
 * a whole page of HTML each time.
 */
export function useSnapshotHtml(projectId: string | null, snapshotId: string | null) {
  return useQuery({
    queryKey: ["design-studio", "snapshot-html", projectId, snapshotId],
    queryFn: () => api.designStudio.snapshotHtml(projectId!, snapshotId!),
    enabled: Boolean(projectId && snapshotId),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────── Business

/** Catalog (You). Polls while a crawl is running, same as useLatestCrawl. */
export function useBusinessMyCatalog(projectId: string | null) {
  return useQuery({
    queryKey: ["business-catalog-mine", projectId],
    queryFn: () => api.business.myCatalog(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.crawlStatus;
      return status === "RUNNING" || status === "PENDING" ? 4000 : false;
    },
  });
}

/** Catalog (Them). Polls only while at least one tracked competitor is crawling. */
export function useBusinessCompetitorCatalogs(projectId: string | null) {
  return useQuery({
    queryKey: ["business-catalog-competitors", projectId],
    queryFn: () => api.business.competitorCatalogs(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      const crawling = list.some((c) => c.crawlStatus === "RUNNING" || c.crawlStatus === "PENDING");
      return crawling ? 4000 : false;
    },
  });
}

export function useCrawlBusinessCompetitor(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competitorId: string) => api.business.crawlCompetitor(projectId!, competitorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-catalog-competitors", projectId] });
    },
  });
}

export function useBusinessGaps(projectId: string | null) {
  return useQuery({
    queryKey: ["business-gaps", projectId],
    queryFn: () => api.business.gaps(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useBusinessMarketingSignals(projectId: string | null) {
  return useQuery({
    queryKey: ["business-marketing-signals", projectId],
    queryFn: () => api.business.marketingSignals(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useGenerateBusinessMarketingSignals(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competitorId?: string) => api.business.generateMarketingSignals(projectId!, competitorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-marketing-signals", projectId] });
    },
  });
}
