"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Share2, Video, Sparkles, TrendingUp, Calendar, Flame, Users, Film } from "lucide-react";
import { PageHeader } from "@/components/ui/console";
import { useWorkspace, usePortfolio, useStrategies, useStrategy, useGenerateStrategy } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { VideoScriptGeneratorModal } from "@/components/social/video-script-generator-modal";
import { SocialAccountsPanel } from "@/components/social/social-accounts-panel";
import { SocialContentFeedsPanel } from "@/components/social/social-content-feeds-panel";
import { SocialMarketTrendsPanel } from "@/components/social/social-market-trends-panel";
import { SocialViralSpyPanel } from "@/components/social/social-viral-spy-panel";
import { SocialCalendarPanel } from "@/components/social/social-calendar-panel";
import { SocialCreatorsPanel } from "@/components/social/social-creators-panel";

const CATEGORIES = [
  { id: "accounts", label: "Social Accounts & Footprint", icon: Share2 },
  { id: "feeds", label: "Instagram & YouTube Feeds", icon: Video },
  { id: "trends", label: "Market Trends & Hook Bank", icon: TrendingUp },
  { id: "viral-spy", label: "Viral Spy & Counter-Actions", icon: Flame },
  { id: "calendar", label: "Publishing Schedule", icon: Calendar },
  { id: "creators", label: "Content Creators Network", icon: Users },
] as const;

type SocialCategoryTab = (typeof CATEGORIES)[number]["id"];
const DEFAULT_TAB: SocialCategoryTab = "accounts";

function SocialMediaClient() {
  const { projectId, orgId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const selectedProject = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === selectedProject?.id) ?? null;
  const businessName = selectedProject?.name || "Your Brand";
  const customerDomain = clientRow?.domain || "yourdomain.com";

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const requestedTab = searchParams.get("tab") as SocialCategoryTab | null;
  const activeTab: SocialCategoryTab = CATEGORIES.some((c) => c.id === requestedTab)
    ? requestedTab!
    : DEFAULT_TAB;

  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [scriptModalTopic, setScriptModalTopic] = useState<string | undefined>(undefined);

  const setActiveTab = (tab: SocialCategoryTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Strategy Queries & Mutations
  const strategies = useStrategies(projectId);
  const activeStrategyId = strategies.data?.[0]?.id ?? null;
  const strategyReport = useStrategy(projectId, activeStrategyId);
  const generateStrategyMutation = useGenerateStrategy(projectId);

  // Competitor Query
  const competitorsQuery = useQuery({
    queryKey: ["tracked-competitors", projectId],
    queryFn: () => (projectId ? api.listCompetitors(projectId) : Promise.resolve([])),
    enabled: Boolean(projectId),
    retry: false,
  });

  const competitors = competitorsQuery.data || [];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Social Media & Video Intelligence Suite"
        subtitle={`Crawler-analyzed social accounts, Instagram/YouTube deep indexing, market trends, and viral competitor reverse-engineering.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setScriptModalTopic("3 Critical Reasons Competitors Are Outranking You");
                setScriptModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-pink-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-pink-700 transition shadow-xs cursor-pointer"
            >
              <Film size={13} />
              <span>AI Video Script & Hooks</span>
            </button>
            <button
              type="button"
              onClick={() => generateStrategyMutation.mutate()}
              disabled={generateStrategyMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-950 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-brand-900 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={13} className={generateStrategyMutation.isPending ? "animate-spin" : "text-amber-400"} />
              <span>{generateStrategyMutation.isPending ? "Generating Strategy..." : "Regenerate Strategy"}</span>
            </button>
          </div>
        }
      />

      {/* 2. Top Metric KPI Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">Tracked Rivals</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[22px] font-bold text-brand-950">{competitors.length}</span>
            <span className="text-[11px] text-brand-500">competitor sites</span>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-pink-700">Instagram & YouTube</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[22px] font-bold text-pink-950">Posts & Reels</span>
            <span className="text-[11px] text-brand-500">indexed</span>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-xs border-amber-200 bg-amber-50/20" style={{ borderColor: "var(--border-color)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Viral Spy Breakouts</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[22px] font-bold text-amber-950">{competitors.length * 2}</span>
            <span className="text-[11px] text-amber-700">100K+ view posts</span>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-xs border-emerald-200 bg-emerald-50/20" style={{ borderColor: "var(--border-color)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Publishing Cadence</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[22px] font-bold text-emerald-950">5 Posts / Wk</span>
            <span className="text-[11px] text-emerald-700">omni-channel</span>
          </div>
        </div>
      </div>

      {/* 3. Categorized Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b pb-2" style={{ borderColor: "var(--border-color)" }}>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeTab === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveTab(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold transition cursor-pointer ${
                isActive
                  ? "bg-brand-950 text-white shadow-xs"
                  : "bg-white border text-brand-700 hover:bg-brand-50 hover:text-brand-950"
              }`}
              style={!isActive ? { borderColor: "var(--border-color)" } : {}}
            >
              <Icon size={14} className={isActive ? "text-amber-300" : "text-brand-500"} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Categorized Tab Contents */}
      {activeTab === "accounts" && (
        <SocialAccountsPanel
          projectId={projectId!}
          customerDomain={customerDomain}
          businessName={businessName}
          competitors={competitors}
          onNavigateToFeeds={() => setActiveTab("feeds")}
        />
      )}

      {activeTab === "feeds" && (
        <SocialContentFeedsPanel
          projectId={projectId!}
          customerDomain={customerDomain}
          competitors={competitors}
          onSelectForCounterStrategy={() => setActiveTab("viral-spy")}
        />
      )}

      {activeTab === "trends" && (
        <SocialMarketTrendsPanel
          projectId={projectId!}
          businessName={businessName}
        />
      )}

      {activeTab === "viral-spy" && (
        <SocialViralSpyPanel
          projectId={projectId!}
          customerDomain={customerDomain}
          businessName={businessName}
          competitors={competitors}
          onNavigateToCalendar={() => setActiveTab("calendar")}
        />
      )}

      {activeTab === "calendar" && (
        <SocialCalendarPanel
          projectId={projectId!}
          businessName={businessName}
        />
      )}

      {activeTab === "creators" && (
        <SocialCreatorsPanel
          projectId={projectId!}
          businessName={businessName}
          customerDomain={customerDomain}
        />
      )}

      {scriptModalOpen && (
        <VideoScriptGeneratorModal
          initialTopic={scriptModalTopic}
          businessName={businessName}
          customerDomain={customerDomain}
          onClose={() => setScriptModalOpen(false)}
        />
      )}
    </div>
  );
}

export default function SocialMediaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-brand-400">Loading Social Media Intelligence...</div>}>
      <SocialMediaClient />
    </Suspense>
  );
}
