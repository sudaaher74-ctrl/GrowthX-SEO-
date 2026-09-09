"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useWorkspace,
  useLocalSeo,
  useGbpProposals,
  useLocalReviews,
  useAnalyzeGbp,
} from "@/hooks/use-growthx";

import { GbpHeader } from "@/components/gbp/gbp-header";
import { GbpTabs, type GbpTabKey, GBP_TABS } from "@/components/gbp/gbp-tabs";
import { ConnectGbpModal } from "@/components/gbp/connect-gbp-modal";

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

function GoogleBusinessProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { projectId } = useWorkspace();

  const tabParam = searchParams.get("tab") as GbpTabKey | null;
  const activeTab: GbpTabKey =
    tabParam && GBP_TABS.some((t) => t.id === tabParam) ? tabParam : "overview";
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const handleTabChange = (newTab: GbpTabKey) => {
    router.replace(`/google-business-profile?tab=${newTab}`, { scroll: false });
  };

  // Queries
  const { data: localSeo, isLoading: seoLoading, refetch: refetchSeo } = useLocalSeo(projectId);
  const { data: proposals = [], refetch: refetchProposals } = useGbpProposals(projectId);
  const { data: reviews = [], refetch: refetchReviews } = useLocalReviews(projectId);
  const analyzeMutation = useAnalyzeGbp(projectId);

  const handleRefresh = () => {
    refetchSeo();
    refetchProposals();
    refetchReviews();
  };

  const currentTabMeta = GBP_TABS.find((t) => t.id === activeTab);

  if (seoLoading) {
    return (
      <div className="p-8">
        <LoadingState
          title="Loading Google Business Profile..."
          message="Fetching verified Google Maps storefront and local ranking records..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* GBP Top Header */}
      <GbpHeader
        localSeo={localSeo}
        projectId={projectId}
        activeTabTitle={currentTabMeta?.label}
        onRefresh={handleRefresh}
      />

      {/* 12-Tab Switcher */}
      <GbpTabs
        activeTab={activeTab}
        onChange={handleTabChange}
        reviewCount={reviews.length || (localSeo?.reviewCount ?? 0)}
        proposalsCount={proposals.filter((p) => p.status === "PENDING").length}
        issuesCount={localSeo ? 8 : 0}
      />

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === "overview" && (
          <OverviewTab
            localSeo={localSeo}
            proposals={proposals}
            reviews={reviews}
            onSelectTab={handleTabChange}
            onConnectClick={() => setConnectModalOpen(true)}
          />
        )}

        {activeTab === "audit" && (
          <ProfileAuditTab
            localSeo={localSeo}
            proposals={proposals}
            onSelectTab={handleTabChange}
            onGenerateAiRecommendations={() => {
              analyzeMutation.mutate(undefined, {
                onSuccess: () => {
                  handleRefresh();
                  handleTabChange("ai-recommendations");
                },
              });
            }}
          />
        )}

        {activeTab === "categories" && (
          <CategoriesTab localSeo={localSeo} />
        )}

        {activeTab === "services" && (
          <ServicesTab localSeo={localSeo} />
        )}

        {activeTab === "reviews" && (
          <ReviewsTab localSeo={localSeo} projectId={projectId} />
        )}

        {activeTab === "photos" && (
          <PhotosTab localSeo={localSeo} />
        )}

        {activeTab === "rankings" && (
          <LocalRankingsTab localSeo={localSeo} projectId={projectId} />
        )}

        {activeTab === "competitors" && (
          <CompetitorsTab localSeo={localSeo} projectId={projectId} />
        )}

        {activeTab === "posts" && (
          <PostsTab localSeo={localSeo} />
        )}

        {activeTab === "ai-recommendations" && (
          <AiRecommendationsTab localSeo={localSeo} projectId={projectId} />
        )}

        {activeTab === "action-plan" && (
          <ActionPlanTab localSeo={localSeo} />
        )}
      </div>

      <ConnectGbpModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        projectId={projectId}
        onConnected={handleRefresh}
      />
    </div>
  );
}

export default function GoogleBusinessProfilePage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-brand-400">Loading Google Business Profile...</div>}>
      <GoogleBusinessProfileContent />
    </Suspense>
  );
}
