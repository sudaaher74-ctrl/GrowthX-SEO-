"use client";

import { Suspense, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Crosshair,
  Target,
  Sparkles,
  Plus,
  RefreshCw,
  Globe,
  MapPin,
  ExternalLink,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Phone,
  Clock,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Award,
  Star,
  Swords,
  Zap,
  Check,
  Activity,
  Layers,
} from "lucide-react";
import {
  ActionButton,
  PageHeader,
  Panel,
  Table,
  Th,
  Tr,
  Td,
  Tabs,
  StatusNote,
  MeterBar,
  Pill,
  relativeTime,
} from "@/components/ui/console";
import { useWorkspace, useVisibility, usePortfolio, useLocalSeo } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { AutoCompetitorsPanel } from "@/components/market-research/auto-competitors-panel";
import { WebsiteComparisonPanel } from "@/components/competitor/website-comparison";
import { CompetitorSeoReportPanel } from "@/components/competitor/seo-report";
import { CompetitorOpportunitiesPanel } from "@/components/competitor/competitor-opportunities-panel";
import { SplitCrawlInspector } from "@/components/competitor/split-crawl-inspector";
import {
  TruthfulState,
  MetricBadge,
  TruthfulKpiCard,
  LoadingState,
} from "@/components/ui/truthful-state";

const TABS = [
  { id: "identify", label: "Find Competitors" },
  { id: "benchmarks", label: "Comparison Benchmarks" },
  { id: "opportunities", label: "Competitor Opportunities" },
  { id: "seo-quality", label: "SEO Deep Dive" },
  { id: "local", label: "Local Competitors (Public Only)" },
  { id: "market-trends", label: "Market Trends & AI Strategy" },
];

const DEFAULT_TAB = "benchmarks";

export default function CompetitorIntelligencePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-brand-400">Loading Competitor Intelligence...</div>}>
      <CompetitorIntelligenceClient />
    </Suspense>
  );
}

/** Visual monogram or logo avatar for entities */
function EntityAvatar({ name, isYou = false }: { name: string; isYou?: boolean }) {
  if (isYou) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-950 text-white font-bold text-[11px] shadow-2xs">
        YOU
      </div>
    );
  }
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "C";

  const colors = [
    "bg-indigo-50 text-indigo-700 border-indigo-200",
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-teal-50 text-teal-700 border-teal-200",
    "bg-rose-50 text-rose-700 border-rose-200",
    "bg-purple-50 text-purple-700 border-purple-200",
  ];
  const charCode = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  const colorClass = colors[charCode % colors.length];

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-bold text-[11px] shadow-2xs ${colorClass}`}
    >
      {initials}
    </div>
  );
}

/** Star rating display with count */
function StarRatingDisplay({ rating, reviews }: { rating?: number | null; reviews?: number | null }) {
  if (!rating || rating <= 0) {
    return (
      <div className="flex flex-col items-end">
        <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 font-mono text-[10.5px] text-brand-400 border border-brand-100">
          <Clock size={10} /> Public data pending
        </span>
      </div>
    );
  }
  const fullStars = Math.floor(rating);
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1">
        <div className="flex text-amber-400">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={11.5}
              className={i < fullStars ? "fill-amber-400 text-amber-400" : "text-brand-200"}
            />
          ))}
        </div>
        <span className="font-bold text-brand-950 text-[12px]">{rating.toFixed(1)}</span>
      </div>
      {reviews != null && reviews > 0 && (
        <span className="text-[10.5px] text-brand-400 font-mono">
          {reviews.toLocaleString()} reviews
        </span>
      )}
    </div>
  );
}

/** Health score bar with numerical label */
function HealthScoreBar({ score }: { score?: number | null }) {
  if (score == null) {
    return (
      <div className="flex flex-col items-end">
        <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 font-mono text-[10.5px] text-brand-400 border border-brand-100">
          <Globe size={10} /> Public only
        </span>
      </div>
    );
  }
  const tone = score >= 70 ? "text-emerald-700 bg-emerald-500" : score >= 40 ? "text-amber-700 bg-amber-500" : "text-rose-700 bg-rose-500";
  return (
    <div className="flex flex-col items-end gap-1 min-w-[80px]">
      <span className="font-mono font-bold text-[12px] text-brand-950">
        {score}
        <span className="text-[10px] text-brand-400 font-normal">/100</span>
      </span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-brand-100">
        <div
          className={`h-full rounded-full ${tone.split(" ")[1]}`}
          style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
        />
      </div>
    </div>
  );
}

function CompetitorIntelligenceClient() {
  const { orgId, projectId } = useWorkspace();
  const qc = useQueryClient();
  const portfolio = usePortfolio(orgId);
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const localSeo = useLocalSeo(projectId);
  const visibility = useVisibility(projectId, 28);

  /**
   * Which tab is open lives in the URL, not in component state.
   *
   * `?tab=` was written by links elsewhere in the app and read by nobody, so
   * every deep link landed on whichever tab happened to be the default. With
   * the URL as the single source of truth a tab is shareable and survives a
   * reload, and there is no second copy in state to push back into the address
   * bar on every change. Switching tabs uses replace rather than push, so it
   * deliberately leaves no history entry — back returns to the page you came
   * from, not through five tabs one press at a time.
   *
   * An unrecognised value falls back to the default instead of matching no
   * branch and rendering an empty page under a full set of tabs.
   */
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const requestedTab = searchParams.get("tab");
  const activeTab = TABS.some((tab) => tab.id === requestedTab) ? requestedTab! : DEFAULT_TAB;

  const setActiveTab = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    // replace, not push: a tab is a view of one page, so it should not take a
    // back press each to get out of. scroll:false keeps the page where it is.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"website" | "local" | "manual">("website");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<"all" | "spotlight">("all");

  // Add form fields
  const [competitorName, setCompetitorName] = useState("");
  const [competitorDomain, setCompetitorDomain] = useState("");
  const [competitorPlaceQuery, setCompetitorPlaceQuery] = useState("");
  const [competitorAddress, setCompetitorAddress] = useState("");
  const [formError, setFormError] = useState("");

  const competitorsQuery = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => api.listCompetitors(projectId!),
    enabled: !!projectId,
  });

  const marketIntelligence = useQuery({
    queryKey: ["market-intelligence", projectId],
    queryFn: () => api.getMarketIntelligence(projectId!),
    enabled: !!projectId,
  });

  const addCompetitorMutation = useMutation({
    mutationFn: (data: { domain: string; name?: string }) =>
      api.addCompetitor(projectId!, data.domain, data.name),
    onSuccess: () => {
      setShowAddModal(false);
      setCompetitorDomain("");
      setCompetitorName("");
      setStatusMessage("Competitor successfully added to your intelligence tracking.");
      qc.invalidateQueries({ queryKey: ["competitors", projectId] });
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to add competitor.");
    },
  });

  const crawlCompetitorMutation = useMutation({
    mutationFn: (competitorId: string) => api.crawlCompetitorSite(projectId!, competitorId),
    onSuccess: () => {
      setStatusMessage("Public crawler queued! Inspecting rival site structure, tech health, and schema...");
      qc.invalidateQueries({ queryKey: ["competitors", projectId] });
    },
    onError: (err: any) => {
      setStatusMessage(err.message || "Public crawl queue request received.");
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (addMode === "website") {
      let domain = competitorDomain.trim().toLowerCase();
      try {
        domain = domain.startsWith("http") ? new URL(domain).hostname : domain;
      } catch {
        // raw
      }
      domain = domain.replace(/^www\./, "");
      if (!domain.includes(".")) {
        setFormError("Please enter a valid website domain.");
        return;
      }
      addCompetitorMutation.mutate({ domain, name: competitorName.trim() });
    } else {
      // Local or manual
      let domain = competitorDomain.trim() || `${competitorName.toLowerCase().replace(/\s+/g, "")}.com`;
      addCompetitorMutation.mutate({ domain, name: competitorName.trim() });
    }
  };

  const competitorsList = competitorsQuery.data ?? [];

  // Cohort statistics calculation for Tier 1 Executive KPIs
  const cohortStats = useMemo(() => {
    const customerHealth = clientRow?.health ?? 5;
    const customerShare = clientRow?.aiCitationSharePct ?? (visibility.data?.summary?.citationSharePct ?? 0);
    const customerReviews = localSeo.data?.reviewCount ?? 0;
    const customerRating = localSeo.data?.rating ?? 0;

    const compHealthScores = competitorsList
      .map((c: any) => c.healthScore)
      .filter((s): s is number => typeof s === "number" && s > 0);
    const avgCompHealth = compHealthScores.length
      ? Math.round(compHealthScores.reduce((a, b) => a + b, 0) / compHealthScores.length)
      : null;

    const compShares = competitorsList
      .map((c: any) => {
        const sov = visibility.data?.shareOfVoice?.find((s) => s.domain === c.domain);
        return c.aiCitationSharePct ?? sov?.sharePct;
      })
      .filter((s): s is number => typeof s === "number" && s >= 0);
    const avgCompShare = compShares.length
      ? Math.round(compShares.reduce((a, b) => a + b, 0) / compShares.length)
      : null;

    const maxCompReviews = Math.max(
      0,
      ...competitorsList.map((c: any) => c.reviewCount || 0)
    );

    const totalTracked = competitorsList.length + 1;

    const allHealths = [
      { isYou: true, score: customerHealth },
      ...competitorsList.map((c: any) => ({ isYou: false, score: c.healthScore || 0 })),
    ].sort((a, b) => b.score - a.score);
    const healthRank = allHealths.findIndex((x) => x.isYou) + 1;

    return {
      customerHealth,
      customerShare,
      customerReviews,
      customerRating,
      avgCompHealth,
      avgCompShare,
      maxCompReviews,
      totalTracked,
      healthRank,
    };
  }, [clientRow, localSeo.data, competitorsList, visibility.data]);

  // Selected competitor for Head-to-Head spotlight
  const selectedCompetitor = useMemo(() => {
    if (!competitorsList.length) return null;
    if (selectedCompetitorId) {
      const found = competitorsList.find((c) => c.id === selectedCompetitorId);
      if (found) return found;
    }
    return competitorsList[0];
  }, [competitorsList, selectedCompetitorId]);

  // Simultaneous multi-competitor comparison data and rankings
  const allEntitiesRanked = useMemo(() => {
    const customerHealth = clientRow?.health ?? 5;
    const customerShare = clientRow?.aiCitationSharePct ?? (visibility.data?.summary?.citationSharePct ?? 0);
    const customerReviews = localSeo.data?.reviewCount ?? 0;
    const customerRating = localSeo.data?.rating ?? 0;

    const list = [
      {
        id: "you",
        isYou: true,
        name: clientRow?.name || "Your Business",
        domain: clientRow?.domain || "aivaenterprises.com",
        health: customerHealth,
        share: customerShare,
        rating: customerRating,
        reviews: customerReviews,
      },
      ...competitorsList.map((c: any) => {
        const sov = visibility.data?.shareOfVoice?.find((s) => s.domain === c.domain);
        return {
          id: c.id,
          isYou: false,
          name: c.label || c.domain,
          domain: c.domain,
          health: typeof c.healthScore === "number" ? c.healthScore : null,
          share: typeof c.aiCitationSharePct === "number" ? c.aiCitationSharePct : (sov?.sharePct ?? null),
          rating: typeof c.rating === "number" ? c.rating : null,
          reviews: typeof c.reviewCount === "number" ? c.reviewCount : null,
        };
      }),
    ];

    // Compute health rankings
    const sortedByHealth = [...list].sort((a, b) => (b.health ?? -1) - (a.health ?? -1));
    const healthRankMap = new Map<string, number>();
    sortedByHealth.forEach((item, idx) => healthRankMap.set(item.id, idx + 1));

    // Determine category champions
    const techLeader = sortedByHealth[0];
    const citationLeader = [...list].sort((a, b) => (b.share ?? -1) - (a.share ?? -1))[0];
    const reviewLeader = [...list].sort((a, b) => (b.reviews ?? -1) - (a.reviews ?? -1))[0];

    return {
      list: list.map((item) => ({
        ...item,
        rank: healthRankMap.get(item.id) || 1,
      })),
      techLeader,
      citationLeader,
      reviewLeader,
    };
  }, [clientRow, localSeo.data, competitorsList, visibility.data]);

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Competitor Intelligence"
        subtitle="Benchmark your technical SEO, AI citation share, and public local visibility against rivals."
        actions={
          <ActionButton
            variant="primary"
            icon={<Plus size={12} />}
            onClick={() => setShowAddModal(true)}
          >
            Add Competitor
          </ActionButton>
        }
      />

      {statusMessage && (
        <StatusNote tone="good">
          <div className="flex items-center justify-between">
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-success-800 hover:text-success-950 font-bold ml-2 text-[11px]"
            >
              Dismiss
            </button>
          </div>
        </StatusNote>
      )}

      {/* Public Data Privacy Disclaimer */}
      <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/50 px-3.5 py-2 text-[11.5px] text-brand-600">
        <ShieldAlert size={14} className="shrink-0 text-brand-500" />
        <span>
          <strong>Privacy Notice:</strong> Competitor data is gathered exclusively from publicly available search engine results, public Google Maps profiles, and open website crawls. GrowthX never accesses or displays private competitor metrics.
        </span>
      </div>

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl" style={{ borderColor: "var(--border-color)" }}>
            <h3 className="text-[16px] font-bold text-brand-950">Add Competitor</h3>
            <p className="text-[12px] text-brand-500 mt-1">
              Track a rival business to monitor domain gaps, keyword overlaps, and local citations.
            </p>

            <div className="flex rounded-lg border p-1 my-4 bg-brand-50/50" style={{ borderColor: "var(--border-color)" }}>
              <button
                type="button"
                onClick={() => setAddMode("website")}
                className={`flex-1 rounded-md py-1 text-[11.5px] font-semibold transition ${
                  addMode === "website" ? "bg-white text-brand-950 shadow-2xs" : "text-brand-500"
                }`}
              >
                Website URL
              </button>
              <button
                type="button"
                onClick={() => setAddMode("local")}
                className={`flex-1 rounded-md py-1 text-[11.5px] font-semibold transition ${
                  addMode === "local" ? "bg-white text-brand-950 shadow-2xs" : "text-brand-500"
                }`}
              >
                Google Maps Place
              </button>
              <button
                type="button"
                onClick={() => setAddMode("manual")}
                className={`flex-1 rounded-md py-1 text-[11.5px] font-semibold transition ${
                  addMode === "manual" ? "bg-white text-brand-950 shadow-2xs" : "text-brand-500"
                }`}
              >
                Manual Entry
              </button>
            </div>

            {formError && (
              <div className="mb-3 rounded border border-error-200 bg-error-50 p-2 text-[11.5px] text-error-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                  Competitor Business Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme SEO Solutions"
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                  className="w-full h-9 rounded-lg border px-3 text-[12.5px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  style={{ borderColor: "var(--border-color)" }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                  Website URL / Domain <span className="text-error-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. acme-seo.com"
                  value={competitorDomain}
                  onChange={(e) => setCompetitorDomain(e.target.value)}
                  className="w-full h-9 rounded-lg border px-3 text-[12.5px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  style={{ borderColor: "var(--border-color)" }}
                />
              </div>

              {addMode === "local" && (
                <div>
                  <label className="block text-[11px] font-semibold text-brand-700 uppercase tracking-wider mb-1">
                    City / Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. San Francisco, CA"
                    value={competitorAddress}
                    onChange={(e) => setCompetitorAddress(e.target.value)}
                    className="w-full h-9 rounded-lg border px-3 text-[12.5px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                    style={{ borderColor: "var(--border-color)" }}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border px-3.5 py-1.5 text-[12px] font-semibold text-brand-600 hover:bg-brand-50"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addCompetitorMutation.isPending}
                  className="rounded-lg bg-brand-950 px-4 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {addCompetitorMutation.isPending ? "Adding..." : "Add Competitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Automatic identification.
          This panel existed and worked but nothing rendered it after the page
          consolidation, so the scan was unreachable from the product while its
          code and API were entirely intact. */}
      {activeTab === "identify" && (
        <AutoCompetitorsPanel
          projectId={projectId!}
          orgId={orgId}
          onAddedSuccess={() => {
            qc.invalidateQueries({ queryKey: ["competitors", projectId] });
          }}
        />
      )}

      {/* Tab 2: Comparison Benchmarks */}
      {activeTab === "benchmarks" && (
        <div className="space-y-5">
          {/* TIER 1: Executive KPI Benchmark Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Market Standing */}
            <div className="rounded-xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand-400">Market Standing</p>
                <Award size={15} className="text-amber-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-[24px] font-bold text-brand-950">
                  #{cohortStats.healthRank}
                </span>
                <span className="text-[12px] font-medium text-brand-500">
                  of {cohortStats.totalTracked} tracked
                </span>
              </div>
              <p className="mt-2 text-[11px] text-brand-500 flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active competitive cohort
              </p>
            </div>

            {/* 2. AI Citation Share */}
            <div className="rounded-xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand-400">AI Citation Share</p>
                <Sparkles size={15} className="text-brand-700" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-[24px] font-bold text-brand-950">
                  {cohortStats.customerShare}%
                </span>
                <span className="text-[11.5px] text-brand-400 font-mono">
                  vs {cohortStats.avgCompShare != null ? `${cohortStats.avgCompShare}% avg` : "—"}
                </span>
              </div>
              <div className="mt-2.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-brand-950"
                    style={{ width: `${Math.min(100, Math.max(0, cohortStats.customerShare))}%` }}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-brand-500">
                Presence across LLM response citations
              </p>
            </div>

            {/* 3. Tech SEO Health */}
            <div className="rounded-xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand-400">Tech SEO Health</p>
                <Activity size={15} className="text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-[24px] font-bold text-brand-950">
                  {cohortStats.customerHealth}
                </span>
                <span className="font-mono text-[12px] text-brand-400">/100</span>
                {cohortStats.avgCompHealth != null && (
                  <span className={`text-[11.5px] font-semibold font-mono ${cohortStats.customerHealth >= cohortStats.avgCompHealth ? "text-emerald-600" : "text-amber-600"}`}>
                    {cohortStats.customerHealth >= cohortStats.avgCompHealth ? `+${cohortStats.customerHealth - cohortStats.avgCompHealth}` : `${cohortStats.customerHealth - cohortStats.avgCompHealth}`} vs avg
                  </span>
                )}
              </div>
              <div className="mt-2.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, Math.max(5, cohortStats.customerHealth))}%` }}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-brand-500">
                Crawl health, speed & schema coverage
              </p>
            </div>

            {/* 4. Public Reputation Gap */}
            <div className="rounded-xl border bg-white p-4 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand-400">Public Reputation</p>
                <Star size={15} className="text-amber-400 fill-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-[24px] font-bold text-brand-950">
                  {cohortStats.customerRating > 0 ? `${cohortStats.customerRating.toFixed(1)} ★` : "Pending"}
                </span>
                <span className="text-[11.5px] text-brand-400 font-mono">
                  {cohortStats.customerReviews.toLocaleString()} reviews
                </span>
              </div>
              <p className="mt-2 text-[11px] text-brand-500">
                {cohortStats.maxCompReviews > cohortStats.customerReviews
                  ? `-${(cohortStats.maxCompReviews - cohortStats.customerReviews).toLocaleString()} reviews vs leader`
                  : "Leading review volume in cohort"}
              </p>
            </div>
          </div>

          {/* TIER 2: Compare All Simultaneously or 1-on-1 Spotlight */}
          {selectedCompetitor && (
            <div className="rounded-2xl border bg-white p-5 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-brand-100">
                <div>
                  <div className="flex items-center gap-2">
                    <Swords size={16} className="text-brand-900" />
                    <h3 className="text-[14px] font-bold text-brand-950">
                      {compareMode === "all" ? "Multi-Competitor Landscape Comparison" : "Head-to-Head 1-on-1 Spotlight"}
                    </h3>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                      {compareMode === "all" ? `All ${cohortStats.totalTracked} Entities Parallel` : "Interactive Matchup"}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-brand-500 mt-0.5">
                    {compareMode === "all"
                      ? "Simultaneous side-by-side benchmark of your domain against every tracked rival in parallel"
                      : "Side-by-side technical, AI authority, and reputation benchmark against your chosen rival"}
                  </p>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex rounded-lg border p-0.5 bg-brand-50" style={{ borderColor: "var(--border-color)" }}>
                    <button
                      type="button"
                      onClick={() => setCompareMode("all")}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        compareMode === "all"
                          ? "bg-white text-brand-950 shadow-2xs"
                          : "text-brand-500 hover:text-brand-950"
                      }`}
                    >
                      <Layers size={12} />
                      Compare All ({cohortStats.totalTracked})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompareMode("spotlight")}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        compareMode === "spotlight"
                          ? "bg-white text-brand-950 shadow-2xs"
                          : "text-brand-500 hover:text-brand-950"
                      }`}
                    >
                      <Swords size={12} />
                      1-on-1 Spotlight
                    </button>
                  </div>

                  {compareMode === "spotlight" && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-medium text-brand-500 whitespace-nowrap">Rival:</label>
                      <select
                        value={selectedCompetitor.id}
                        onChange={(e) => setSelectedCompetitorId(e.target.value)}
                        aria-label="Select rival for head-to-head comparison"
                        className="h-8 rounded-lg border bg-white px-2.5 text-[12px] font-semibold text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        {competitorsList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label || c.domain}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* MODE A: Compare All Competitors Simultaneously */}
              {compareMode === "all" && (
                <div className="space-y-4 pt-4">
                  {/* Category Champions Quick Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pb-1">
                    <div className="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/40 px-3.5 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <Award size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Tech SEO Champion</div>
                        <div className="text-[12.5px] font-bold text-brand-950 truncate">
                          {allEntitiesRanked.techLeader?.name} ({allEntitiesRanked.techLeader?.health != null ? `${allEntitiesRanked.techLeader.health}/100` : "—"})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-50/50 px-3.5 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <Sparkles size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">AI Citations Leader</div>
                        <div className="text-[12.5px] font-bold text-brand-950 truncate">
                          {allEntitiesRanked.citationLeader?.name} ({allEntitiesRanked.citationLeader?.share != null ? `${allEntitiesRanked.citationLeader.share}%` : "—"})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-50/50 px-3.5 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <Star size={15} className="fill-amber-500 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">Review Volume Leader</div>
                        <div className="text-[12.5px] font-bold text-brand-950 truncate">
                          {allEntitiesRanked.reviewLeader?.name} ({allEntitiesRanked.reviewLeader?.reviews ? allEntitiesRanked.reviewLeader.reviews.toLocaleString() : "0"})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Card Parallel Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                    {allEntitiesRanked.list.map((entity) => {
                      const isYou = entity.isYou;
                      const isSelected = selectedCompetitor?.id === entity.id;
                      const healthDelta = entity.health != null && cohortStats.customerHealth != null
                        ? entity.health - cohortStats.customerHealth
                        : null;

                      return (
                        <div
                          key={entity.id}
                          className={`rounded-xl border p-4 flex flex-col justify-between transition ${
                            isYou
                              ? "border-brand-950 bg-brand-50/40 ring-1 ring-brand-950/20 shadow-xs"
                              : isSelected
                              ? "border-brand-400 bg-white shadow-xs"
                              : "border-brand-200 bg-white hover:border-brand-300 shadow-2xs"
                          }`}
                        >
                          <div className="space-y-3.5">
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <EntityAvatar name={entity.name} isYou={isYou} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-[13px] text-brand-950 truncate">
                                      {entity.name}
                                    </span>
                                    {isYou && (
                                      <span className="rounded bg-brand-950 px-1.5 py-0.2 text-[8.5px] font-bold uppercase text-white shrink-0">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <a
                                    href={`https://${entity.domain}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-0.5 font-mono text-[10.5px] text-brand-400 hover:text-brand-700 truncate"
                                  >
                                    {entity.domain}
                                    <ExternalLink size={9} className="shrink-0" />
                                  </a>
                                </div>
                              </div>

                              {/* Rank badge */}
                              <span
                                className={`shrink-0 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold font-mono ${
                                  entity.rank === 1
                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                    : entity.rank === 2
                                    ? "bg-slate-100 text-slate-700 border border-slate-200"
                                    : "bg-brand-100 text-brand-600"
                                }`}
                              >
                                #{entity.rank}
                              </span>
                            </div>

                            {/* Metric 1: Tech SEO Health */}
                            <div className="rounded-lg border border-brand-100 bg-brand-50/30 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase text-brand-400">Tech SEO Health</span>
                                {entity.health != null ? (
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono font-bold text-[13px] text-brand-950">
                                      {entity.health}
                                      <span className="text-[10px] text-brand-400 font-normal">/100</span>
                                    </span>
                                    {!isYou && healthDelta != null && healthDelta !== 0 && (
                                      <span
                                        className={`text-[9.5px] font-mono font-semibold px-1 rounded ${
                                          healthDelta > 0
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-emerald-100 text-emerald-700"
                                        }`}
                                      >
                                        {healthDelta > 0 ? `+${healthDelta}` : `${healthDelta}`} vs You
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10.5px] font-mono text-brand-400">Ready for crawl</span>
                                )}
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                                <div
                                  className={`h-full rounded-full ${
                                    (entity.health ?? 0) >= 70 ? "bg-emerald-500" : (entity.health ?? 0) >= 40 ? "bg-amber-500" : "bg-rose-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(5, entity.health ?? 5))}%` }}
                                />
                              </div>
                            </div>

                            {/* Metric 2: AI Citation Share */}
                            <div className="rounded-lg border border-brand-100 bg-brand-50/30 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase text-brand-400">AI Citation Share</span>
                                <span className="font-mono font-bold text-[13px] text-brand-950">
                                  {entity.share != null ? `${entity.share}%` : "—"}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                                <div
                                  className="h-full rounded-full bg-brand-950"
                                  style={{ width: `${Math.min(100, Math.max(0, entity.share ?? 0))}%` }}
                                />
                              </div>
                            </div>

                            {/* Metric 3: Google Reputation */}
                            <div className="rounded-lg border border-brand-100 bg-brand-50/30 p-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase text-brand-400">Reputation</span>
                                {entity.rating != null && entity.rating > 0 ? (
                                  <div className="flex items-center gap-1">
                                    <Star size={11} className="fill-amber-400 text-amber-400" />
                                    <span className="font-bold text-[12px] text-brand-950">{entity.rating.toFixed(1)}</span>
                                    <span className="font-mono text-[10px] text-brand-400">
                                      ({entity.reviews ? entity.reviews.toLocaleString() : 0})
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10.5px] font-mono text-brand-400">Pending GMB</span>
                                )}
                              </div>
                            </div>

                            {/* Advantage / Posture Tag */}
                            <div>
                              {isYou ? (
                                <span className="block text-center rounded-md bg-brand-100 border border-brand-200 px-2 py-1 text-[10.5px] font-semibold text-brand-800">
                                  ⭐ Baseline Workspace Site
                                </span>
                              ) : (
                                <span
                                  className={`block text-center rounded-md px-2 py-1 text-[10.5px] font-semibold ${
                                    entity.rank === 1
                                      ? "bg-amber-50 border border-amber-200 text-amber-800"
                                      : (entity.health ?? 0) >= cohortStats.customerHealth
                                      ? "bg-rose-50 border border-rose-200 text-rose-700"
                                      : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                  }`}
                                >
                                  {entity.rank === 1
                                    ? "Market Health Leader"
                                    : (entity.health ?? 0) >= cohortStats.customerHealth
                                    ? "Rival Technical Lead"
                                    : "You Outperform on SEO"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Actions */}
                          <div className="pt-3 mt-3 border-t border-brand-100 flex items-center justify-between gap-1">
                            {isYou ? (
                              <span className="text-[10.5px] font-medium text-brand-400 italic">Primary Workspace</span>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedCompetitorId(entity.id);
                                    setCompareMode("spotlight");
                                  }}
                                  className="text-[11px] font-semibold text-brand-700 hover:text-brand-950 transition flex items-center gap-1"
                                >
                                  1-on-1 Spotlight →
                                </button>
                                <button
                                  onClick={() => crawlCompetitorMutation.mutate(entity.id)}
                                  disabled={crawlCompetitorMutation.isPending}
                                  title="Crawl public website"
                                  className="rounded p-1 text-brand-400 hover:text-brand-950 hover:bg-brand-100 transition"
                                >
                                  <RefreshCw size={11} className={crawlCompetitorMutation.isPending ? "animate-spin" : ""} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MODE B: 1-on-1 Head-to-Head Spotlight */}
              {compareMode === "spotlight" && (
                <div className="grid grid-cols-1 md:grid-cols-11 gap-4 pt-5 items-center">
                  {/* Left: You */}
                  <div className="md:col-span-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar name={clientRow?.name || "Your Business"} isYou />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[13px] text-brand-950">{clientRow?.name || "Your Business"}</span>
                            <span className="rounded bg-brand-950 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase">You</span>
                          </div>
                          <p className="font-mono text-[11px] text-brand-500">{clientRow?.domain || "aivaenterprises.com"}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Active Project
                      </span>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-200/60 text-center">
                      <div>
                        <div className="text-[10px] font-semibold text-brand-400 uppercase">Tech Health</div>
                        <div className="font-mono font-bold text-[15px] text-brand-950">{cohortStats.customerHealth}/100</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-brand-400 uppercase">AI Citation</div>
                        <div className="font-mono font-bold text-[15px] text-brand-950">{cohortStats.customerShare}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-brand-400 uppercase">Reviews</div>
                        <div className="font-mono font-bold text-[15px] text-brand-950">
                          {cohortStats.customerReviews ? cohortStats.customerReviews.toLocaleString() : "0"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Center: VS & Advantages */}
                  <div className="md:col-span-3 flex flex-col items-center justify-center text-center px-2 py-1 space-y-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-950 text-white font-black text-[12px] shadow-xs ring-4 ring-brand-100">
                      VS
                    </div>

                    <div className="space-y-1 w-full max-w-[210px]">
                      {cohortStats.customerHealth >= ((selectedCompetitor as any).healthScore || 0) ? (
                        <span className="flex items-center justify-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-[10.5px] font-semibold text-emerald-700">
                          <Check size={12} /> Tech Health Advantage
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-[10.5px] font-semibold text-amber-700">
                          <Zap size={12} /> Rival Health Lead
                        </span>
                      )}

                      <span className="flex items-center justify-center gap-1 rounded-md bg-brand-50 border border-brand-200 px-2 py-1 text-[10.5px] font-semibold text-brand-700">
                        <Sparkles size={11} /> AI Citation Opportunity
                      </span>
                    </div>

                    <button
                      onClick={() => crawlCompetitorMutation.mutate(selectedCompetitor.id)}
                      disabled={crawlCompetitorMutation.isPending}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-950 underline underline-offset-2 transition"
                    >
                      {crawlCompetitorMutation.isPending ? (
                        <>
                          <RefreshCw size={11} className="animate-spin" /> Crawling Rival...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={11} /> Refresh Public Signals
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right: Selected Competitor */}
                  <div className="md:col-span-4 rounded-xl border border-brand-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar name={selectedCompetitor.label || selectedCompetitor.domain} />
                        <div>
                          <span className="font-bold text-[13px] text-brand-950">
                            {selectedCompetitor.label || selectedCompetitor.domain}
                          </span>
                          <p className="font-mono text-[11px] text-brand-500">{selectedCompetitor.domain}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full">
                        Tracked Rival
                      </span>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-100 text-center">
                      <div>
                        <div className="text-[10px] font-semibold text-brand-400 uppercase">Tech Health</div>
                        <div className="font-mono font-bold text-[15px] text-brand-700">
                          {(selectedCompetitor as any).healthScore != null ? `${(selectedCompetitor as any).healthScore}/100` : "Ready"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-brand-400 uppercase">AI Citation</div>
                        <div className="font-mono font-bold text-[15px] text-brand-700">
                          {(selectedCompetitor as any).aiCitationSharePct != null ? `${(selectedCompetitor as any).aiCitationSharePct}%` : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-brand-400 uppercase">Reviews</div>
                        <div className="font-mono font-bold text-[15px] text-brand-700">
                          {(selectedCompetitor as any).reviewCount != null ? (selectedCompetitor as any).reviewCount.toLocaleString() : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TIER 3: High-Fidelity Comparison Benchmarks Table */}
          <Panel
            title="Customer vs Competitor Benchmarks"
            subtitle="Side-by-side comparison of authoritative search presence, reputation, and technical posture"
            actions={
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-brand-400">
                  {competitorsList.length + 1} entities monitored
                </span>
              </div>
            }
          >
            <div className="p-0">
              <Table minWidth={900}>
                <thead>
                  <tr>
                    <Th>Entity</Th>
                    <Th>Domain</Th>
                    <Th align="right">Google Reputation</Th>
                    <Th align="right">AI Citation Share</Th>
                    <Th align="right">Tech Health</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {/* Your Business (Customer) */}
                  <Tr className="bg-brand-50/50 font-medium border-l-2 border-l-brand-950">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar name={clientRow?.name || "Your Business"} isYou />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-brand-950 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                              You
                            </span>
                            <span className="font-bold text-brand-950">{clientRow?.name || "Your Business"}</span>
                          </div>
                          <span className="text-[11px] text-brand-400">Primary Workspace Site</span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <a
                        href={clientRow?.domain ? `https://${clientRow.domain}` : "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[12px] text-brand-700 hover:text-brand-950 transition"
                      >
                        {clientRow?.domain || "—"}
                        <ExternalLink size={11} className="text-brand-400" />
                      </a>
                    </Td>
                    <Td align="right">
                      <StarRatingDisplay
                        rating={localSeo.data?.rating}
                        reviews={localSeo.data?.reviewCount}
                      />
                    </Td>
                    <Td align="right">
                      <div className="flex flex-col items-end gap-1 min-w-[70px]">
                        <span className="font-mono font-bold text-[12px] text-brand-950">
                          {cohortStats.customerShare}%
                        </span>
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-brand-100">
                          <div
                            className="h-full rounded-full bg-brand-950"
                            style={{ width: `${Math.min(100, Math.max(0, cohortStats.customerShare))}%` }}
                          />
                        </div>
                      </div>
                    </Td>
                    <Td align="right">
                      <HealthScoreBar score={cohortStats.customerHealth} />
                    </Td>
                    <Td align="right">
                      <span className="inline-block rounded-md bg-brand-100 px-2 py-1 text-[11px] font-semibold text-brand-700">
                        Current Site
                      </span>
                    </Td>
                  </Tr>

                  {/* Tracked Competitors */}
                  {competitorsList.length === 0 ? (
                    <Tr>
                      <Td colSpan={6}>
                        <div className="py-12 text-center">
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500 mb-2">
                            <Crosshair size={20} />
                          </div>
                          <p className="text-[13px] font-semibold text-brand-950">No competitors tracked yet</p>
                          <p className="text-[12px] text-brand-400 mt-0.5">
                            Add rival domains to unlock head-to-head benchmarking and competitive gap detection.
                          </p>
                          <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
                          >
                            <Plus size={12} /> Add First Competitor
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  ) : (
                    competitorsList.map((comp) => {
                      const isSelected = selectedCompetitor?.id === comp.id;
                      return (
                        <Tr
                          key={comp.id}
                          className={isSelected ? "bg-brand-50/30" : undefined}
                        >
                          <Td>
                            <div className="flex items-center gap-2.5">
                              <EntityAvatar name={comp.label || comp.domain} />
                              <div>
                                <span className="font-semibold text-brand-950 text-[13px]">
                                  {comp.label || comp.domain}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="rounded bg-brand-100 px-1.5 py-0.2 text-[9px] font-semibold text-brand-600 uppercase">
                                    Rival
                                  </span>
                                  <span className="text-[10.5px] text-brand-400">Tracked competitor</span>
                                </div>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <a
                              href={`https://${comp.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[12px] text-brand-500 hover:text-brand-950 transition"
                            >
                              {comp.domain}
                              <ExternalLink size={11} className="text-brand-300" />
                            </a>
                          </Td>
                          <Td align="right">
                            <StarRatingDisplay
                              rating={(comp as any).rating}
                              reviews={(comp as any).reviewCount}
                            />
                          </Td>
                          <Td align="right">
                            {(comp as any).aiCitationSharePct != null ? (
                              <div className="flex flex-col items-end gap-1 min-w-[70px]">
                                <span className="font-mono text-[12px] text-brand-700">
                                  {(comp as any).aiCitationSharePct}%
                                </span>
                                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-brand-100">
                                  <div
                                    className="h-full rounded-full bg-brand-400"
                                    style={{ width: `${Math.min(100, Math.max(0, (comp as any).aiCitationSharePct))}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="font-mono text-[11.5px] text-brand-400">—</span>
                            )}
                          </Td>
                          <Td align="right">
                            <HealthScoreBar score={(comp as any).healthScore} />
                          </Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedCompetitorId(comp.id);
                                  window.scrollTo({ top: 120, behavior: "smooth" });
                                }}
                                className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                                  isSelected
                                    ? "border-brand-950 bg-brand-950 text-white"
                                    : "border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
                                }`}
                              >
                                {isSelected ? "Comparing" : "Compare VS"}
                              </button>
                            </div>
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </div>
          </Panel>

          {/* Downside Split Version: Page-to-Page Crawl Telemetry & Comparison */}
          {selectedCompetitor && (
            <SplitCrawlInspector
              projectId={projectId!}
              customerDomain={clientRow?.domain || "our site"}
              competitor={selectedCompetitor}
              allCompetitors={competitorsList}
              onSelectCompetitor={(id) => setSelectedCompetitorId(id)}
            />
          )}
        </div>
      )}

      {/* Tab 3: Competitor Content & Website Opportunities */}
      {(activeTab === "opportunities" || activeTab === "website") && (
        <CompetitorOpportunitiesPanel projectId={projectId!} competitors={competitorsList} />
      )}

      {/* Everything the crawler found on one competitor's site, beside your
          own. The crawl already scored every competitor and listed the
          problems behind the score — it goes through the same crawler as the
          customer's site — and until now nothing read either. */}
      {activeTab === "seo-quality" && (
        <CompetitorSeoReportPanel projectId={projectId!} competitors={competitorsList} />
      )}

      {activeTab === "local" && (
        <Panel
          title="Local Competitor Profiles (Public Data Only)"
          subtitle="Google Maps, Places, and public listing signals"
        >
          <div className="p-6 space-y-4">
            <p className="text-[12px] text-brand-500 leading-relaxed">
              Public local data includes business category, public rating, total review count, verified address, and Google Maps listing URLs.
            </p>
            {competitorsList.length === 0 ? (
              <TruthfulState
                icon={MapPin}
                title="No Local Competitors Added"
                missing="Add local competitors to track Google Maps rating and review volume gaps."
                action={{ label: "Add Local Competitor", onClick: () => setShowAddModal(true) }}
                compact
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {competitorsList.map((comp) => (
                  <div key={comp.id} className="p-4 rounded-xl border bg-white space-y-2" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-brand-950 text-[13px]">{comp.label || comp.domain}</h4>
                      <span className="text-[10px] text-brand-400 font-mono">Public Place</span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-brand-600">
                      <span>Rating: <strong>{(comp as any).rating ? `${(comp as any).rating.toFixed(1)} ★` : "N/A"}</strong></span>
                      <span>Reviews: <strong>{(comp as any).reviewCount ?? 0}</strong></span>
                    </div>
                    <div className="text-[11px] text-brand-400">
                      Domain: <span className="font-mono">{comp.domain}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 4: Market Trends & AI Strategy */}
      {activeTab === "market-trends" && (
        <div className="space-y-4">
          <Panel
            title="Industry Market Trends & AI Strategy"
            subtitle="Search demand patterns and automated tactical recommendations"
          >
            <div className="p-6 space-y-4">
              <div className="rounded-xl border p-5 bg-brand-50/30" style={{ borderColor: "var(--border-color)" }}>
                <h4 className="text-[13px] font-semibold text-brand-950">Market Intelligence Summary</h4>
                {/* Two chips used to sit here, one grading search demand and
                    one grading competitive velocity. Both were string literals
                    — every customer saw the same two verdicts whatever their
                    market, their competitors, or whether anything had been
                    crawled, under a heading promising market intelligence. The
                    sentence above them claimed we were aggregating weekly
                    search patterns, which nothing was doing either. Nothing
                    replaces them: there is no measurement behind any of it to
                    render, and a tab that admits its limits is worth more than
                    one that fills them in. The exact chip text is a rule in
                    scripts/check-no-fabricated-data.mjs, so it cannot come
                    back. */}
                {marketIntelligence.data?.sentimentSummary ? (
                  <p className="text-[12px] text-brand-500 mt-1 leading-relaxed">
                    {marketIntelligence.data.sentimentSummary}
                  </p>
                ) : (
                  <p className="mt-1 text-[12px] leading-relaxed text-brand-400">
                    No market signals have been measured for this project yet. This section fills in once
                    Search Console is connected and your competitors have been crawled.
                  </p>
                )}
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
