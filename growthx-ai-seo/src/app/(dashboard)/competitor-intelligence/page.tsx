"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  RefreshCw,
  Globe,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Building2,
  Clock,
  Award,
  Star,
  Swords,
  Zap,
  Check,
  Activity,
  Layers,
  Loader2,
  Radar,
  Trash2,
  ArrowRight,
  X,
  SlidersHorizontal,
  Home,
} from "lucide-react";
import { useWorkspace, useVisibility, usePortfolio, useLocalSeo } from "@/hooks/use-growthx";
import { api, type TrackedCompetitor } from "@/lib/api-client";
import { CompetitorOverviewTab } from "@/components/competitor/competitor-overview-tab";
import { CompetitorKeywordGapsTab } from "@/components/competitor/competitor-keyword-gaps-tab";
import { CompetitorContentGapsTab } from "@/components/competitor/competitor-content-gaps-tab";
import {
  CompetitorsDiscoveryTab,
  CompetitorTechnicalGapsTab,
  CompetitorAiVisibilityTab,
  CompetitorOpportunitiesTab,
  CompetitorReportsTab,
} from "@/components/competitor/competitor-deep-dive-tabs";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "competitors", label: "Competitors" },
  { id: "keywords", label: "Keyword Gaps" },
  { id: "content", label: "Content Gaps" },
  { id: "technical", label: "Technical Gaps" },
  { id: "ai-visibility", label: "AI Visibility" },
  { id: "opportunities", label: "Opportunities" },
  { id: "reports", label: "Reports" },
];

// Map legacy tab keys if navigated from old links
const LEGACY_TAB_MAP: Record<string, string> = {
  identify: "competitors",
  benchmarks: "overview",
  website: "opportunities",
};

/**
 * Live crawl progress strip shown below the page header while one or more
 * competitors are being crawled. It polls automatically via the query's
 * refetchInterval and disappears once all crawls complete.
 */
function CrawlStatusStrip({ competitors }: { competitors: TrackedCompetitor[] }) {
  const crawling = competitors.filter(
    (c) => c.crawlStatus === "IN_PROGRESS" || c.crawlStatus === "QUEUED" || c.status === "PENDING",
  );
  const done = competitors.filter(
    (c) => c.crawlStatus === "DONE" || (c.status === "ACTIVE" && c.pagesCrawled !== undefined && c.pagesCrawled !== null && c.pagesCrawled > 0),
  );

  if (crawling.length === 0) return null;

  return (
    <div
      className="rounded-2xl border bg-gradient-to-r from-purple-50/80 via-white to-purple-50/50 p-4 shadow-xs"
      style={{ borderColor: "var(--border-color, #e2e8f0)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-600" />
        </span>
        <Radar size={14} className="text-purple-600" />
        <span className="text-[12px] font-bold text-slate-900">
          Auditing {crawling.length} competitor{crawling.length > 1 ? "s" : ""} — inspecting pages, tech health, keywords &amp; schema
        </span>
        <Loader2 size={13} className="animate-spin text-purple-600 ml-auto" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {crawling.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2 shadow-2xs"
            style={{ borderColor: "var(--border-color, #e2e8f0)" }}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-[10px] font-bold text-purple-700">
              {(c.name ?? c.domain ?? "C")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-semibold text-slate-900 truncate">{c.name ?? c.domain}</p>
              <p className="text-[10.5px] text-slate-500">
                {c.crawlStatus === "QUEUED" || c.status === "PENDING"
                  ? "Queued — starting crawler..."
                  : c.pagesCrawled !== undefined && c.pagesCrawled !== null && c.pagesCrawled > 0
                  ? `${c.pagesCrawled.toLocaleString()} pages indexed`
                  : "Scanning site hierarchy & backlinks..."}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Loader2 size={11} className="animate-spin text-purple-600" />
            </div>
          </div>
        ))}

        {done.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2.5 rounded-xl border bg-emerald-50/60 px-3 py-2 border-emerald-200 shadow-2xs"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-semibold text-slate-900 truncate">{c.name ?? c.domain}</p>
              <p className="text-[10.5px] text-emerald-700">
                {c.pagesCrawled !== undefined && c.pagesCrawled !== null
                  ? `${c.pagesCrawled.toLocaleString()} pages — crawl complete`
                  : "Crawl complete"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[10.5px] text-slate-400">
        Automatic background sync runs continuously. Results appear in your gap analysis once site scans complete.
      </p>
    </div>
  );
}

const DEFAULT_TAB = "overview";

export default function CompetitorIntelligencePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading Competitor Intelligence...</div>}>
      <CompetitorIntelligenceClient />
    </Suspense>
  );
}

function CompetitorIntelligenceClient() {
  const { orgId, projectId } = useWorkspace();
  const qc = useQueryClient();
  const portfolio = usePortfolio(orgId);
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const localSeo = useLocalSeo(projectId);
  const visibility = useVisibility(projectId, 28);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = searchParams.get("tab") || DEFAULT_TAB;
  const resolvedTab = LEGACY_TAB_MAP[rawTab] || rawTab;
  const initialTab = TABS.some((t) => t.id === resolvedTab) ? resolvedTab : DEFAULT_TAB;

  const [activeTab, setActiveTabState] = useState<string>(initialTab);
  const lastTabRef = useRef(activeTab);

  // Sync state when URL changes externally
  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw) {
      const mapped = LEGACY_TAB_MAP[raw] || raw;
      if (TABS.some((t) => t.id === mapped) && mapped !== lastTabRef.current) {
        lastTabRef.current = mapped;
        setActiveTabState(mapped);
      }
    }
  }, [searchParams]);

  const setActiveTab = (id: string) => {
    lastTabRef.current = id;
    setActiveTabState(id);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", id);
      const targetUrl = `${pathname}?${params.toString()}`;
      window.history.replaceState(null, "", targetUrl);
      router.replace(targetUrl, { scroll: false });
    } catch {
      // ignore
    }
  };

  // Fix Plan Toast state
  const [fixPlanToast, setFixPlanToast] = useState<{
    count: number;
    label: string;
  } | null>(null);

  const handleAddToFixPlan = (count: number, label?: string) => {
    const resolvedLabel = label || `${count} Items`;
    setFixPlanToast({ count, label: resolvedLabel });
    // Clear toast automatically after 8 seconds
    setTimeout(() => {
      setFixPlanToast(null);
    }, 8000);
  };

  // Add Competitor modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [competitorDomain, setCompetitorDomain] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [formError, setFormError] = useState("");

  const competitorsQuery = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => api.listCompetitors(projectId!),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      const activelyCrawling = list.some(
        (c) => c.crawlStatus === "IN_PROGRESS" || c.crawlStatus === "QUEUED" || c.status === "PENDING",
      );
      return activelyCrawling ? 4000 : false;
    },
  });

  const competitorsList = competitorsQuery.data ?? [];

  const addCompetitorMutation = useMutation({
    mutationFn: (data: { domain: string; name?: string }) =>
      api.addCompetitor(projectId!, data.domain, data.name),
    onSuccess: (newComp) => {
      setShowAddModal(false);
      setCompetitorDomain("");
      setCompetitorName("");
      qc.invalidateQueries({ queryKey: ["competitors", projectId] });
      if (newComp?.id) {
        crawlCompetitorMutation.mutate(newComp.id);
      }
    },
    onError: (err: Error) => {
      setFormError(err.message || "Failed to add competitor.");
    },
  });

  const crawlCompetitorMutation = useMutation({
    mutationFn: (competitorId: string) => api.crawlCompetitorSite(projectId!, competitorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitors", projectId] });
    },
  });

  const [competitorToDelete, setCompetitorToDelete] = useState<{ id: string; name: string } | null>(null);

  const removeCompetitorMutation = useMutation({
    mutationFn: (competitorId: string) => api.removeCompetitor(projectId!, competitorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitors", projectId] });
      setCompetitorToDelete(null);
    },
    onError: () => {
      setCompetitorToDelete(null);
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
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
  };

  const currentTabObj = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const customerDomain = clientRow?.domain || "aivaenterprises.com";

  return (
    <div className="space-y-6 pb-12">
      {/* ── BREADCRUMB & SUB-NAVIGATION BAR ── */}
      <div className="space-y-4">
        {/* Breadcrumb row */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-slate-800 transition">
            <Home className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
          <span>/</span>
          <Link href="/competitor-intelligence" className="hover:text-slate-800 transition">
            Competitor Intelligence
          </Link>
          <span>/</span>
          <span className="text-purple-700 font-bold">{currentTabObj.label}</span>
        </div>

        {/* Global Horizontal Sub-navigation Pill Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-purple-600 text-white shadow-sm shadow-purple-500/20"
                    : "text-slate-600 hover:text-slate-950 hover:bg-slate-100/80 font-semibold"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── FIX PLAN INTEGRATION TOAST NOTIFICATION ── */}
      {fixPlanToast && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-purple-950 text-white shadow-xl shadow-purple-950/20 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Added to 30-Day Fix Plan</span>
                <span className="bg-purple-800 text-purple-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  Fix Engine Ready
                </span>
              </div>
              <p className="text-[11px] text-purple-200 mt-0.5">
                Staged <strong>{fixPlanToast.count} items ({fixPlanToast.label})</strong>. Fix Engine will consolidate Website Audit, Competitors, and AI Visibility findings into your single-approval 30-day plan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
            <Link
              href="/fix-engine"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-purple-950 font-bold text-xs hover:bg-purple-50 transition shadow-2xs"
            >
              <span>View in Fix Engine</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setFixPlanToast(null)}
              className="p-1 text-purple-300 hover:text-white rounded-lg transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── REAL-TIME CRAWL STATUS STRIP ── */}
      <CrawlStatusStrip competitors={competitorsList} />

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === "overview" && (
        <CompetitorOverviewTab
          projectId={projectId || ""}
          domain={customerDomain}
          competitors={competitorsList}
          onAddCompetitor={() => setShowAddModal(true)}
          onGenerateInsights={() => handleAddToFixPlan(10, "Top Opportunities")}
          onViewAllKeywordGaps={() => setActiveTab("keywords")}
          onViewAllContentGaps={() => setActiveTab("content")}
          onGenerateReport={() => setActiveTab("reports")}
        />
      )}

      {/* ── TAB 2: COMPETITORS DIRECTORY ── */}
      {activeTab === "competitors" && (
        <CompetitorsDiscoveryTab
          projectId={projectId || ""}
          customerDomain={customerDomain}
          competitors={competitorsList}
          onAddCompetitor={() => setShowAddModal(true)}
          onAddToFixPlan={handleAddToFixPlan}
        />
      )}

      {/* ── TAB 3: KEYWORD GAPS ── */}
      {activeTab === "keywords" && (
        <CompetitorKeywordGapsTab
          projectId={projectId || ""}
          customerDomain={customerDomain}
          competitors={competitorsList}
          onAddToFixPlan={handleAddToFixPlan}
          onExport={() => handleAddToFixPlan(Math.min(50, competitorsList.length * 10), "Exported Keywords")}
        />
      )}

      {/* ── TAB 4: CONTENT GAPS ── */}
      {activeTab === "content" && (
        <CompetitorContentGapsTab
          projectId={projectId || ""}
          customerDomain={customerDomain}
          competitors={competitorsList}
          onAddToFixPlan={handleAddToFixPlan}
          onExport={() => handleAddToFixPlan(Math.min(25, competitorsList.length * 5), "Exported Content Gaps")}
        />
      )}

      {/* ── TAB 5: TECHNICAL GAPS ── */}
      {activeTab === "technical" && (
        <CompetitorTechnicalGapsTab
          projectId={projectId || ""}
          customerDomain={customerDomain}
          competitors={competitorsList}
          onAddToFixPlan={handleAddToFixPlan}
        />
      )}

      {/* ── TAB 6: AI VISIBILITY ── */}
      {activeTab === "ai-visibility" && (
        <CompetitorAiVisibilityTab
          projectId={projectId || ""}
          customerDomain={customerDomain}
          competitors={competitorsList}
          onAddToFixPlan={handleAddToFixPlan}
        />
      )}

      {/* ── TAB 7: OPPORTUNITIES (AI ENGINE) ── */}
      {activeTab === "opportunities" && (
        <CompetitorOpportunitiesTab
          projectId={projectId || ""}
          customerDomain={customerDomain}
          competitors={competitorsList}
          onAddToFixPlan={handleAddToFixPlan}
        />
      )}

      {/* ── TAB 8: REPORTS ── */}
      {activeTab === "reports" && (
        <CompetitorReportsTab
          domain={customerDomain}
          competitors={competitorsList}
          onGenerateReport={() => handleAddToFixPlan(1, "Executive Strategy Report")}
        />
      )}

      {/* ── ADD COMPETITOR MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Tracked Competitor</h3>
                  <p className="text-[11px] text-slate-500">Initiate automated crawl and cross-signal gap audit</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Competitor Domain *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. competitor.com"
                  value={competitorDomain}
                  onChange={(e) => setCompetitorDomain(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Brand / Company Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addCompetitorMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-500/20 disabled:opacity-60"
                >
                  {addCompetitorMutation.isPending ? "Starting Crawl..." : "Add & Start Crawl"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE COMPETITOR CONFIRMATION ── */}
      {competitorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Remove Competitor?</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to stop tracking <strong>{competitorToDelete.name}</strong>? Crawled keyword and content gap history will be archived.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompetitorToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeCompetitorMutation.mutate(competitorToDelete.id)}
                disabled={removeCompetitorMutation.isPending}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-60"
              >
                {removeCompetitorMutation.isPending ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
