"use client";

import { Suspense, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
  relativeTime,
} from "@/components/ui/console";
import { useWorkspace, useVisibility, usePortfolio, useLocalSeo } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import {
  TruthfulState,
  MetricBadge,
  TruthfulKpiCard,
  LoadingState,
} from "@/components/ui/truthful-state";

export default function CompetitorIntelligencePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-brand-400">Loading Competitor Intelligence...</div>}>
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

  const [activeTab, setActiveTab] = useState<string>("benchmarks");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"website" | "local" | "manual">("website");

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
      qc.invalidateQueries({ queryKey: ["competitors", projectId] });
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to add competitor.");
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

  const tabs = [
    { id: "benchmarks", label: "Comparison Benchmarks" },
    { id: "website", label: "Website Competitors" },
    { id: "local", label: "Local Competitors (Public Only)" },
    { id: "market-trends", label: "Market Trends & AI Strategy" },
  ];

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
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Comparison Benchmarks */}
      {activeTab === "benchmarks" && (
        <div className="space-y-4">
          <Panel
            title="Customer vs Competitor Benchmarks"
            subtitle="Side-by-side comparison of authoritative search presence and reputation"
          >
            <div className="p-0">
              <Table minWidth={850}>
                <thead>
                  <tr>
                    <Th>Entity</Th>
                    <Th>Domain</Th>
                    <Th align="right">Google Rating</Th>
                    <Th align="right">Review Count</Th>
                    <Th align="right">AI Citation Share</Th>
                    <Th align="right">Tech Health</Th>
                  </tr>
                </thead>
                <tbody>
                  {/* Your Business (Customer) */}
                  <Tr className="bg-brand-50/30 font-medium">
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-brand-950 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white">
                          You
                        </span>
                        <span className="font-bold text-brand-950">{clientRow?.name || "Your Business"}</span>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px] text-brand-700">{clientRow?.domain || "—"}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-bold text-brand-950">
                        {localSeo.data && localSeo.data.reviewCount > 0
                          ? `${localSeo.data.rating.toFixed(1)} ★`
                          : "No rating"}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-brand-700">
                        {localSeo.data?.reviewCount ? localSeo.data.reviewCount.toLocaleString() : "0"}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono font-bold text-brand-950">
                        {clientRow?.aiCitationSharePct != null ? `${clientRow.aiCitationSharePct}%` : "—"}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono font-bold text-emerald-700">
                        {clientRow?.health != null ? `${clientRow.health}/100` : "—"}
                      </span>
                    </Td>
                  </Tr>

                  {/* Tracked Competitors */}
                  {competitorsList.length === 0 ? (
                    <Tr>
                      <Td colSpan={6}>
                        <div className="py-8 text-center text-[12px] text-brand-400">
                          No competitors tracked yet. Click Add Competitor to begin benchmarking.
                        </div>
                      </Td>
                    </Tr>
                  ) : (
                    competitorsList.map((comp) => (
                      <Tr key={comp.id}>
                        <Td>
                          <span className="font-semibold text-brand-950">{comp.label || comp.domain}</span>
                        </Td>
                        <Td>
                          <span className="font-mono text-[12px] text-brand-500">{comp.domain}</span>
                        </Td>
                        <Td align="right">
                          <span className="font-medium text-brand-600">
                            {(comp as any).rating ? `${(comp as any).rating.toFixed(1)} ★` : "Public data pending"}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-brand-500">
                            {(comp as any).reviewCount ? (comp as any).reviewCount.toLocaleString() : "—"}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-brand-600">
                            {(comp as any).aiCitationSharePct != null ? `${(comp as any).aiCitationSharePct}%` : "—"}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-brand-500">
                            {(comp as any).healthScore != null ? `${(comp as any).healthScore}/100` : "Public only"}
                          </span>
                        </Td>
                      </Tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 2: Website Competitors */}
      {activeTab === "website" && (
        <Panel title="Website & Organic Competitors" subtitle="Domain crawl benchmarks and content gap detection">
          <div className="p-0">
            {competitorsList.length === 0 ? (
              <div className="p-8">
                <TruthfulState
                  icon={Crosshair}
                  title="No Competitors Tracked"
                  missing="Add competitor websites to inspect keyword gaps, schema, and page counts."
                  action={{ label: "Add Website Competitor", onClick: () => setShowAddModal(true) }}
                  compact
                />
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--color-brand-100)" }}>
                {competitorsList.map((comp) => (
                  <div key={comp.id} className="p-4 flex items-center justify-between hover:bg-brand-50/30 transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-brand-500" />
                        <h4 className="font-bold text-brand-950 text-[13px]">{comp.label || comp.domain}</h4>
                        <span className="font-mono text-[11px] text-brand-400">({comp.domain})</span>
                      </div>
                      <p className="text-[11.5px] text-brand-500 mt-1">
                        Publicly crawled pages: {(comp as any).crawledPagesCount ?? "Available upon sweep"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold text-brand-600 bg-brand-100 px-2 py-0.5 rounded">
                        Tracked
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 3: Local Competitors (Public Only) */}
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
                <p className="text-[12px] text-brand-500 mt-1 leading-relaxed">
                  {marketIntelligence.data?.sentimentSummary ||
                    "Aggregating weekly market search patterns and competitive velocity across your niche. Connect Google Search Console and add 3+ competitors to unlock high-precision market trends."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded bg-white border px-2.5 py-1 text-[11px] font-medium text-brand-700">
                    Search Demand: Moderate Growth
                  </span>
                  <span className="rounded bg-white border px-2.5 py-1 text-[11px] font-medium text-brand-700">
                    Competitive Velocity: High
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
