"use client";

import { useState } from "react";
import {
  ActionButton,
  Kpi,
  PageHeader,
  Panel,
  relativeTime,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from "@/components/ui/console";
import {
  MapPin,
  Star,
  Link as LinkIcon,
  BarChart3,
  Zap,
  Loader2,
  Search,
  Map,
  ShieldAlert,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  Building2,
  ExternalLink,
} from "lucide-react";
import {
  useWorkspace,
  useLocalSeo,
  useSearchLocalBusiness,
  useConnectLocalBusiness,
  useGbpProposals,
  useAnalyzeGbp,
  useApproveGbpFix,
  useRejectGbpFix,
} from "@/hooks/use-growthx";
import { GeoGridPanel } from "./GeoGridPanel";
import { ReviewsPanel } from "./ReviewsPanel";
import { LocalCompetitorsPanel } from "./LocalCompetitorsPanel";
import { CitationsAuditPanel } from "./CitationsAuditPanel";
import {
  TruthfulState,
  MetricBadge,
  TruthfulKpiCard,
  LoadingState,
  NotConnectedState,
} from "@/components/ui/truthful-state";

interface LocalBusinessPlace {
  placeId: string;
  name: string;
  address: string;
  rating: number;
  userRatingsTotal: number;
}

interface GbpFixProposal {
  id: string;
  field: string;
  currentValue: string | null;
  proposedValue: string;
  rationale: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PUSHED";
}

export default function LocalPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const { projectId } = useWorkspace();
  const { data: localSeo, isLoading, refetch } = useLocalSeo(projectId);

  const [searchQuery, setSearchQuery] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualRating, setManualRating] = useState("");
  const [manualReviewCount, setManualReviewCount] = useState("");

  const searchMutation = useSearchLocalBusiness(projectId);
  const connectMutation = useConnectLocalBusiness(projectId);
  const analyzeMutation = useAnalyzeGbp(projectId);

  // 7 Required Tabs
  const tabs = [
    { id: "profile", label: "Profile", icon: MapPin },
    { id: "reviews", label: "Reviews", icon: Star },
    { id: "citations", label: "Citations", icon: LinkIcon },
    { id: "rankings", label: "Local Rankings", icon: BarChart3 },
    { id: "competitors", label: "Competitors", icon: Users },
    { id: "geogrid", label: "GeoGrid", icon: Map },
    { id: "audit", label: "Local Audit", icon: Zap },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const handleConnect = (place: LocalBusinessPlace) => {
    connectMutation.mutate({
      businessName: place.name,
      address: place.address,
      rating: place.rating,
      reviewCount: place.userRatingsTotal,
    });
  };

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    connectMutation.mutate({
      businessName: manualName.trim(),
      address: manualAddress.trim(),
      rating: parseFloat(manualRating) || 0,
      reviewCount: parseInt(manualReviewCount, 10) || 0,
    });
  };

  // Known Bug Fix: If review count is 0, display "No rating available", not 5.0
  const hasReviews = (localSeo?.reviewCount ?? 0) > 0;
  const ratingDisplay: string = hasReviews && localSeo ? localSeo.rating.toFixed(1) : "No rating available";
  const ratingMeter = hasReviews ? ((localSeo?.rating ?? 0) / 5) * 100 : 0;

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Local SEO"
        subtitle="Google Business Profile, verified reviews, local citations, and geo-visibility."
        actions={
          <ActionButton
            variant="primary"
            icon={analyzeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            onClick={() => {
              analyzeMutation.mutate(undefined, {
                onSuccess: () => setActiveTab("audit"),
              });
            }}
            disabled={analyzeMutation.isPending || !localSeo}
          >
            {analyzeMutation.isPending ? "Auditing Profile..." : "Run Local Audit"}
          </ActionButton>
        }
      />

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="pt-2 flex items-start gap-4">
        <div className="flex-1 space-y-4 w-full">
          {isLoading ? (
            <Panel>
              <LoadingState title="Loading Local SEO Data..." message="Querying Google Business Profile records..." />
            </Panel>
          ) : !localSeo ? (
            <Panel
              title="Connect Google Business Profile"
              subtitle={!isManual ? "Search for your verified business to link it to this project" : "Enter your business details manually"}
              actions={
                <button
                  type="button"
                  onClick={() => {
                    setIsManual(!isManual);
                    if (!isManual && searchQuery && !manualName) {
                      setManualName(searchQuery);
                    }
                  }}
                  className="text-xs text-accent-700 hover:text-accent-800 font-semibold underline underline-offset-2"
                >
                  {!isManual ? "Or connect manually →" : "← Back to place search"}
                </button>
              }
            >
              <div className="p-6">
                {!isManual ? (
                  <>
                    <form onSubmit={handleSearch} className="flex max-w-xl gap-2 mb-6">
                      <input
                        type="text"
                        placeholder="Search by business name and location (e.g. Acme Plumbing Chicago)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 h-9 rounded-lg border px-3 text-xs text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
                        style={{ borderColor: "var(--border-color)" }}
                      />
                      <ActionButton
                        variant="primary"
                        icon={searchMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                        disabled={searchMutation.isPending || !searchQuery.trim()}
                      >
                        Search Places
                      </ActionButton>
                    </form>

                    {searchMutation.data && searchMutation.data.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                          Google Places Results
                        </h3>
                        {searchMutation.data.map((place: LocalBusinessPlace) => (
                          <div
                            key={place.placeId}
                            className="flex items-center justify-between p-4 border rounded-xl bg-white shadow-2xs"
                            style={{ borderColor: "var(--border-color)" }}
                          >
                            <div>
                              <p className="font-bold text-brand-950 text-[13px]">{place.name}</p>
                              <p className="text-[12px] text-brand-500 mt-0.5">{place.address}</p>
                              {place.rating > 0 ? (
                                <div className="flex items-center gap-1 mt-1 text-[11.5px] text-amber-700 font-medium">
                                  <Star size={12} className="fill-amber-500 text-amber-500" />
                                  <span>{place.rating.toFixed(1)}</span>
                                  <span className="text-brand-400">({place.userRatingsTotal.toLocaleString()} reviews)</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-brand-400 italic mt-1 block">No public rating</span>
                              )}
                            </div>
                            <ActionButton
                              variant="secondary"
                              onClick={() => handleConnect(place)}
                              disabled={connectMutation.isPending}
                            >
                              {connectMutation.isPending ? "Connecting..." : "Connect Profile"}
                            </ActionButton>
                          </div>
                        ))}
                      </div>
                    )}

                    {searchMutation.data && searchMutation.data.length === 0 && (
                      <div className="p-4 rounded-lg bg-brand-50 text-center text-xs text-brand-500">
                        No businesses found. Try searching with city and state or enter details manually.
                      </div>
                    )}
                  </>
                ) : (
                  <form onSubmit={handleManualConnect} className="max-w-xl space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-brand-700 mb-1">
                        Business Name <span className="text-error-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. GrowthX Consulting"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full h-9 rounded-lg border px-3 text-xs"
                        style={{ borderColor: "var(--border-color)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-brand-700 mb-1">
                        Business Address
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 100 Market St, San Francisco, CA"
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        className="w-full h-9 rounded-lg border px-3 text-xs"
                        style={{ borderColor: "var(--border-color)" }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-brand-700 mb-1">
                          Current Rating (0 - 5)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          placeholder="e.g. 4.8"
                          value={manualRating}
                          onChange={(e) => setManualRating(e.target.value)}
                          className="w-full h-9 rounded-lg border px-3 text-xs"
                          style={{ borderColor: "var(--border-color)" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-brand-700 mb-1">
                          Review Count
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={manualReviewCount}
                          onChange={(e) => setManualReviewCount(e.target.value)}
                          className="w-full h-9 rounded-lg border px-3 text-xs"
                          style={{ borderColor: "var(--border-color)" }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <ActionButton
                        variant="primary"
                        disabled={connectMutation.isPending || !manualName.trim()}
                      >
                        {connectMutation.isPending ? "Connecting..." : "Save Profile"}
                      </ActionButton>
                      <button
                        type="button"
                        onClick={() => setIsManual(false)}
                        className="text-xs text-brand-500 hover:text-brand-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </Panel>
          ) : (
            <>
              {/* Tab 1: Profile */}
              {activeTab === "profile" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <TruthfulKpiCard
                      label="Average Rating"
                      value={hasReviews ? `${localSeo.rating.toFixed(1)} ★` : null}
                      sub={hasReviews ? "out of 5 stars" : "No rating available"}
                      state={hasReviews ? "MEASURED" : "NOT_CONFIGURED"}
                      source="Google Places API"
                      lastUpdated={relativeTime(localSeo.updatedAt)}
                    />
                    <TruthfulKpiCard
                      label="Total Reviews"
                      value={localSeo.reviewCount.toLocaleString()}
                      sub="Verified customer reviews"
                      state="MEASURED"
                      source="Google Business Profile"
                      lastUpdated={relativeTime(localSeo.updatedAt)}
                    />
                    <TruthfulKpiCard
                      label="Active Citations (NAP)"
                      value={localSeo.citationsCount > 0 ? localSeo.citationsCount.toString() : null}
                      sub={localSeo.citationsCount > 0 ? "Consistent directory listings" : "Scan not run"}
                      state={localSeo.citationsCount > 0 ? "MEASURED" : "NOT_CONFIGURED"}
                      source="Local Directory Sweep"
                      actionHref="#"
                      actionLabel="Run citation scan →"
                    />
                    <TruthfulKpiCard
                      label="Local Rankings"
                      value={localSeo.rankings && localSeo.rankings.length > 0 ? `${localSeo.rankings.length} tracked` : null}
                      sub="Target local search queries"
                      state={localSeo.rankings && localSeo.rankings.length > 0 ? "MEASURED" : "NOT_CONFIGURED"}
                      source="Local SERP Engine"
                    />
                  </div>

                  <Panel title="Google Business Profile Details" subtitle="Connected listing information">
                    <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border rounded-xl p-4 bg-brand-50/20" style={{ borderColor: "var(--border-color)" }}>
                        <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider">Business Name</span>
                        <p className="text-[15px] font-bold text-brand-950 mt-1">{localSeo.businessName}</p>
                      </div>
                      <div className="border rounded-xl p-4 bg-brand-50/20" style={{ borderColor: "var(--border-color)" }}>
                        <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider">Registered Address</span>
                        <p className="text-[13px] font-medium text-brand-800 mt-1">{localSeo.address || "Not specified"}</p>
                      </div>
                      <div className="border rounded-xl p-4 bg-brand-50/20" style={{ borderColor: "var(--border-color)" }}>
                        <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider">Last Sync</span>
                        <p className="text-[13px] font-medium text-brand-800 mt-1">{relativeTime(localSeo.updatedAt)}</p>
                      </div>
                    </div>
                  </Panel>
                </div>
              )}

              {/* Tab 2: Reviews */}
              {activeTab === "reviews" && (
                <div className="space-y-4">
                  <Panel title="Reviews & Reputation" subtitle="Customer feedback and automated AI response drafting">
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Kpi
                        label="Average Rating"
                        value={ratingDisplay}
                        meter={ratingMeter}
                        sub={hasReviews ? "out of 5 stars" : "No verified reviews on record"}
                      />
                      <Kpi
                        label="Total Reviews"
                        value={localSeo.reviewCount.toLocaleString()}
                        sub="Google Business reviews"
                      />
                    </div>
                  </Panel>
                  <ReviewsPanel
                    projectId={projectId}
                    businessName={localSeo.businessName}
                    placeId={(localSeo as any).placeId}
                  />
                </div>
              )}

              {/* Tab 3: Citations */}
              {activeTab === "citations" && (
                <CitationsAuditPanel
                  business={localSeo}
                  onConnectClick={() => setActiveTab("profile")}
                />
              )}

              {/* Tab 4: Local Rankings */}
              {activeTab === "rankings" && (
                <Panel title="Local SERP Rankings" subtitle="Proximity-based positions for target regional keywords">
                  <div className="p-0">
                    {localSeo.rankings && localSeo.rankings.length > 0 ? (
                      <Table minWidth={650}>
                        <thead>
                          <tr>
                            <Th>Target Keyword</Th>
                            <Th>Position</Th>
                            <Th>Change</Th>
                            <Th>Search Volume</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {localSeo.rankings.map((r) => {
                            const delta = r.previousPos ? r.previousPos - r.position : 0;
                            return (
                              <Tr key={r.id}>
                                <Td><span className="font-semibold text-brand-950">{r.keyword}</span></Td>
                                <Td><span className="font-bold font-mono text-brand-950">#{r.position}</span></Td>
                                <Td>
                                  {delta > 0 ? (
                                    <span className="text-emerald-600 font-semibold">+{delta}</span>
                                  ) : delta < 0 ? (
                                    <span className="text-rose-600 font-semibold">{delta}</span>
                                  ) : (
                                    <span className="text-brand-400">—</span>
                                  )}
                                </Td>
                                <Td><span className="font-mono text-brand-500">{r.searchVolume.toLocaleString()}</span></Td>
                              </Tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    ) : (
                      <div className="p-8">
                        <TruthfulState
                          icon={BarChart3}
                          title="Local Rank Tracking Not Configured"
                          missing="No local geo-keywords are currently set up for rank monitoring."
                          whyItMatters="Tracking localized queries reveals whether your Google Maps 3-Pack presence is rising or falling."
                          actionRequired="Add local keywords to track."
                          action={{ label: "Configure Local Keywords", href: "/settings" }}
                          compact
                        />
                      </div>
                    )}
                  </div>
                </Panel>
              )}

              {/* Tab 5: Competitors Benchmark Matrix */}
              {activeTab === "competitors" && (
                <LocalCompetitorsPanel
                  projectId={projectId}
                  currentBusiness={localSeo}
                  onOpenReviewsTab={() => setActiveTab("reviews")}
                />
              )}

              {/* Tab 6: GeoGrid */}
              {activeTab === "geogrid" && (
                <GeoGridPanel projectId={projectId} businessName={localSeo?.businessName} />
              )}

              {/* Tab 7: Local Audit (Fixing "No pending fixes" bug) */}
              {activeTab === "audit" && (
                <GbpAuditPanel projectId={projectId} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GbpAuditPanel({ projectId }: { projectId: string | null }) {
  const { data: proposals, isLoading: proposalsLoading, isFetched } = useGbpProposals(projectId);
  const analyzeMutation = useAnalyzeGbp(projectId);
  const approveMutation = useApproveGbpFix(projectId);
  const rejectMutation = useRejectGbpFix(projectId);

  // Known Bug Fix: If audit has NOT run, display "Audit not run", NOT "No pending fixes"
  const hasProposals = Boolean(proposals && proposals.length > 0);
  const auditNotRun = !hasProposals && !analyzeMutation.isPending;

  return (
    <Panel
      title="AI Google Business Profile Audit"
      subtitle="Automated audit of categories, business hours, and profile attributes"
      actions={
        <ActionButton
          variant="primary"
          icon={analyzeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
        >
          {analyzeMutation.isPending ? "Auditing Profile..." : "Run AI Audit"}
        </ActionButton>
      }
    >
      <div className="p-0">
        {proposalsLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 size={24} className="animate-spin text-brand-300" />
          </div>
        ) : auditNotRun ? (
          <div className="p-8">
            <TruthfulState
              icon={Zap}
              title="Audit Not Run"
              missing="The automated Google Business Profile analysis has not been executed yet."
              whyItMatters="Incomplete business categories or missing attributes prevent inclusion in Google Local 3-Pack results."
              actionRequired="Click Run AI Audit to inspect your profile."
              action={{
                label: "Run AI Audit Now",
                onClick: () => analyzeMutation.mutate(),
                variant: "primary",
              }}
              compact
            />
          </div>
        ) : !hasProposals ? (
          <div className="p-8 text-center text-brand-500 text-xs">
            Audit complete: No pending optimization fixes required. Profile is fully optimized!
          </div>
        ) : (
          <Table minWidth={800}>
            <thead>
              <tr>
                <Th>Field</Th>
                <Th>Current Value</Th>
                <Th>Proposed Value</Th>
                <Th>Rationale</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {proposals?.map((proposal: GbpFixProposal) => (
                <Tr key={proposal.id}>
                  <Td><span className="font-mono text-xs font-semibold text-brand-950">{proposal.field}</span></Td>
                  <Td>
                    <div className="max-w-[200px] truncate text-xs text-rose-600 line-through font-mono">
                      {proposal.currentValue || "Empty / Unset"}
                    </div>
                  </Td>
                  <Td>
                    <div className="max-w-[200px] text-xs text-emerald-700 font-semibold font-mono">
                      {proposal.proposedValue}
                    </div>
                  </Td>
                  <Td>
                    <div className="max-w-[250px] text-xs text-brand-600 whitespace-normal">
                      {proposal.rationale}
                    </div>
                  </Td>
                  <Td>
                    {proposal.status === "PENDING" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveMutation.mutate(proposal.id)}
                          disabled={approveMutation.isPending}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(proposal.id)}
                          disabled={rejectMutation.isPending}
                          className="text-xs font-medium text-brand-400 hover:text-brand-950"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-700">
                        {proposal.status}
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </Panel>
  );
}
