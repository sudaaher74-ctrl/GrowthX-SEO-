"use client";

import React, { Suspense, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, XCircle } from "lucide-react";
import {
  useWorkspace,
  useLocalSeo,
  useGbpProposals,
  useGbpOverview,
  useGbpReviews,
  useSyncBusinessProfile,
  useDisconnectGoogleProvider,
  useAnalyzeGbp,
  GBP_PROVIDER,
} from "@/hooks/use-growthx";

import { GbpHeader } from "@/components/gbp/gbp-header";
import { GbpTabs, type GbpTabKey, GBP_TABS } from "@/components/gbp/gbp-tabs";
import { ConnectGbpModal } from "@/components/gbp/connect-gbp-modal";
import { ConnectGbpScreen } from "@/components/gbp/connect-gbp-screen";
import { SelectGbpLocation } from "@/components/gbp/select-gbp-location";
import { GbpStatePanel } from "@/components/gbp/gbp-states";

import { OverviewTab } from "@/components/gbp/tabs/overview-tab";
import { ProfileAuditTab } from "@/components/gbp/tabs/profile-audit-tab";
import { CategoriesTab } from "@/components/gbp/tabs/categories-tab";
import { ServicesTab } from "@/components/gbp/tabs/services-tab";
import { ReviewsTab } from "@/components/gbp/tabs/reviews-tab";
import { PhotosTab } from "@/components/gbp/tabs/photos-tab";
import { LocalRankingsTab } from "@/components/gbp/tabs/local-rankings-tab";
import { CompetitorsTab } from "@/components/gbp/tabs/competitors-tab";
import { PostsTab } from "@/components/gbp/tabs/posts-tab";
import { AiRecommendationsTab } from "@/components/gbp/tabs/ai-recommendations-tab";
import { ActionPlanTab } from "@/components/gbp/tabs/action-plan-tab";

import { LoadingState } from "@/components/ui/truthful-state";
import { errorMessage } from "@/lib/error-message";

/** What Google's callback can tell us on the way back, via `?google=`. */
type CallbackOutcome = "select" | "scopes" | "cancelled" | "failed" | "invalid";

function GoogleBusinessProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { projectId } = useWorkspace();

  const tabParam = searchParams.get("tab") as GbpTabKey | null;
  const activeTab: GbpTabKey =
    tabParam && GBP_TABS.some((t) => t.id === tabParam) ? tabParam : "overview";

  const [connectModalOpen, setConnectModalOpen] = useState(false);
  // The picker can also be opened deliberately, from "Change location".
  const [pickerRequested, setPickerRequested] = useState(false);
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);

  const handleTabChange = (newTab: GbpTabKey) => {
    router.replace(`/google-business-profile?tab=${newTab}`, { scroll: false });
  };

  // Google's callback lands back here as `?google=…&provider=…`. It is read
  // straight from the URL rather than copied into state: it describes how the
  // customer arrived, and it is cleared by navigating rather than by an effect.
  const callbackProvider = searchParams.get("provider");
  const callbackOutcome: CallbackOutcome | null =
    callbackProvider && callbackProvider !== GBP_PROVIDER
      ? null
      : ((searchParams.get("google") as CallbackOutcome | null) ?? null);

  /** Drops the callback params, leaving the customer on the tab they were on. */
  const clearCallback = useCallback(() => {
    setPickerRequested(false);
    router.replace(`/google-business-profile?tab=${activeTab}`, { scroll: false });
  }, [router, activeTab]);

  const { data: localSeo, isLoading: seoLoading } = useLocalSeo(projectId);
  const { data: proposals = [] } = useGbpProposals(projectId);
  const { data: overview, isLoading: overviewLoading } = useGbpOverview(projectId);
  const { data: gbpReviews } = useGbpReviews(projectId);
  const analyzeMutation = useAnalyzeGbp(projectId);

  const syncMutation = useSyncBusinessProfile(projectId);
  const disconnectMutation = useDisconnectGoogleProvider(projectId);

  const connection = overview?.connection ?? null;

  const handleSync = useCallback(() => {
    setLastSyncNotice(null);
    syncMutation.mutate(undefined, {
      onSuccess: (result) => {
        // A partial sync is reported rather than smoothed over: four full tabs
        // and one silently empty one is the failure this replaces.
        if (result.failedSources.length > 0) {
          setLastSyncNotice(
            `Synced, but Google would not return: ${result.failedSources.join(", ")}. ` +
              "Those tabs will say so rather than showing an empty list.",
          );
        }
      },
      onError: (error) => setLastSyncNotice(errorMessage(error)),
    });
  }, [syncMutation]);

  const handleDisconnect = useCallback(() => {
    disconnectMutation.mutate(GBP_PROVIDER, { onSuccess: clearCallback });
  }, [disconnectMutation, clearCallback]);

  const openConnect = useCallback(() => setConnectModalOpen(true), []);
  const openLocationPicker = useCallback(() => setPickerRequested(true), []);

  if (seoLoading || overviewLoading) {
    return (
      <div className="p-8">
        <LoadingState
          title="Loading Google Business Profile..."
          message="Checking this project's Google connection..."
        />
      </div>
    );
  }

  const callbackNotice =
    callbackOutcome === "scopes" ? (
      <GbpStatePanel
        icon={AlertTriangle}
        tone="warning"
        title="A required Google permission was declined"
        body={
          <>
            You signed in, but one of the permissions GrowthX needs to read your Business Profile was
            not granted. Nothing can be synced without it. Try again and accept every requested
            permission on Google&apos;s consent screen.
          </>
        }
      />
    ) : callbackOutcome === "failed" || callbackOutcome === "invalid" ? (
      <GbpStatePanel
        icon={XCircle}
        tone="danger"
        title="The Google connection did not complete"
        body={
          <>
            Google sent you back without a usable result. Nothing has been changed for this project.
            Start the connection again.
          </>
        }
      />
    ) : null;

  // The location picker: reached either from Google's callback or from
  // "Change location", and shown whenever the connection has no location yet.
  const showPicker =
    pickerRequested || callbackOutcome === "select" || connection?.state === "NEEDS_SELECTION";

  if (showPicker) {
    return (
      <div className="space-y-6">
        {callbackNotice}
        <SelectGbpLocation
          projectId={projectId}
          onSelected={clearCallback}
          onCancel={connection?.state === "NEEDS_SELECTION" ? undefined : clearCallback}
        />
      </div>
    );
  }

  // Nothing is connected at all — neither the real Google connection nor a
  // locally tracked listing — so the only useful screen is the connect one.
  // `cancelled` lands here quietly: the customer changed their mind.
  if ((!connection || connection.state === "NOT_CONNECTED") && !localSeo) {
    return (
      <div className="space-y-6">
        {callbackNotice}
        <ConnectGbpScreen projectId={projectId} connection={connection} onConnected={clearCallback} />
      </div>
    );
  }

  const currentTabMeta = GBP_TABS.find((t) => t.id === activeTab);
  const reviewCount = gbpReviews?.summary.total;
  const pendingProposals = proposals.filter((p) => p.status === "PENDING").length;

  const tabHandlers = {
    onConnect: openConnect,
    onChooseLocation: openLocationPicker,
    onSync: handleSync,
    isSyncing: syncMutation.isPending,
  };

  return (
    <div className="space-y-6 pb-16">
      <GbpHeader
        projectId={projectId}
        connection={connection}
        profile={overview?.profile}
        activeTabTitle={currentTabMeta?.label}
        onSync={handleSync}
        isSyncing={syncMutation.isPending}
        lastSyncNotice={lastSyncNotice}
        onChooseLocation={openLocationPicker}
        onConnect={openConnect}
        onDisconnect={handleDisconnect}
        isDisconnecting={disconnectMutation.isPending}
      />

      {callbackNotice}

      <GbpTabs
        activeTab={activeTab}
        onChange={handleTabChange}
        reviewCount={reviewCount}
        proposalsCount={pendingProposals}
        issuesCount={pendingProposals}
      />

      <div className="pt-2">
        {activeTab === "overview" && (
          <OverviewTab
            projectId={projectId}
            localSeo={localSeo}
            proposals={proposals}
            onSelectTab={handleTabChange}
            {...tabHandlers}
          />
        )}

        {activeTab === "audit" && (
          <ProfileAuditTab
            localSeo={localSeo}
            proposals={proposals}
            onSelectTab={handleTabChange}
            onGenerateAiRecommendations={() => {
              analyzeMutation.mutate(undefined, {
                onSuccess: () => handleTabChange("ai-recommendations"),
              });
            }}
          />
        )}

        {activeTab === "categories" && <CategoriesTab projectId={projectId} {...tabHandlers} />}

        {activeTab === "services" && <ServicesTab projectId={projectId} {...tabHandlers} />}

        {activeTab === "reviews" && <ReviewsTab projectId={projectId} {...tabHandlers} />}

        {activeTab === "photos" && <PhotosTab projectId={projectId} {...tabHandlers} />}

        {activeTab === "rankings" && (
          <LocalRankingsTab localSeo={localSeo} projectId={projectId} />
        )}

        {activeTab === "competitors" && (
          <CompetitorsTab localSeo={localSeo} projectId={projectId} onSelectTab={handleTabChange} />
        )}

        {activeTab === "posts" && <PostsTab projectId={projectId} {...tabHandlers} />}

        {activeTab === "ai-recommendations" && (
          <AiRecommendationsTab localSeo={localSeo} projectId={projectId} />
        )}

        {activeTab === "action-plan" && (
          <ActionPlanTab localSeo={localSeo} projectId={projectId} />
        )}
      </div>

      <ConnectGbpModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        projectId={projectId}
        connection={connection}
      />
    </div>
  );
}

export default function GoogleBusinessProfilePage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-xs text-brand-400">Loading Google Business Profile...</div>}
    >
      <GoogleBusinessProfileContent />
    </Suspense>
  );
}
