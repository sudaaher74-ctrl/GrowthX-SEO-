"use client";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, ActionButton, relativeTime } from "@/components/ui/console";
import { MapPin, Star, Link as LinkIcon, BarChart3, Zap, Loader2, Search } from "lucide-react";
import { useWorkspace, useLocalSeo, useSearchLocalBusiness, useConnectLocalBusiness, useGbpProposals, useAnalyzeGbp, useApproveGbpFix, useRejectGbpFix } from "@/hooks/use-growthx";

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
  const [activeTab, setActiveTab] = useState("gbp");
  const { projectId } = useWorkspace();
  const { data: localSeo, isLoading } = useLocalSeo(projectId);

  const [searchQuery, setSearchQuery] = useState("");
  const searchMutation = useSearchLocalBusiness(projectId);
  const connectMutation = useConnectLocalBusiness(projectId);

  const tabs = [
    { id: "gbp", label: "Google Business Profile", icon: MapPin },
    { id: "reviews", label: "Reviews & Ratings", icon: Star },
    { id: "citations", label: "Citations", icon: LinkIcon },
    { id: "rankings", label: "Local Rankings", icon: BarChart3 },
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Local SEO"
        subtitle="Google Business Profile, Reviews, and Local Rankings."
        actions={
          <ActionButton variant="secondary" icon={<Zap size={12} />}>
            Run Local Audit
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-brand-200 overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-accent-600 text-accent-600"
                : "border-transparent text-brand-500 hover:text-brand-950 hover:border-brand-300"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-2 flex items-start gap-4">
        <div className="flex-1 space-y-4 w-full">
          {isLoading ? (
            <Panel>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 size={32} className="text-brand-200 mb-4 animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Loading local data...</p>
              </div>
            </Panel>
          ) : !localSeo ? (
            <Panel title="Connect Google Business Profile" subtitle="Search for your business to link it to this project">
              <div className="p-6">
                <form onSubmit={handleSearch} className="flex max-w-xl gap-2 mb-6">
                  <input
                    type="text"
                    placeholder="Search by business name and location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 h-9 rounded-md border border-brand-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-brand-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-600"
                  />
                  <ActionButton 
                    variant="primary" 
                    icon={searchMutation.isPending ? <Loader2 size={12} className="animate-spin"/> : <Search size={12} />}
                    disabled={searchMutation.isPending || !searchQuery.trim()}
                  >
                    Search
                  </ActionButton>
                </form>

                {searchMutation.data && searchMutation.data.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Search Results</h3>
                    {searchMutation.data.map((place: LocalBusinessPlace) => (
                      <div key={place.placeId} className="flex items-center justify-between p-4 border border-brand-200 rounded-md">
                        <div>
                          <p className="font-medium text-brand-950">{place.name}</p>
                          <p className="text-sm text-brand-500">{place.address}</p>
                          {place.rating > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-sm text-brand-500">
                              <Star size={12} className="text-yellow-500 fill-yellow-500" />
                              <span className="font-medium">{place.rating.toFixed(1)}</span>
                              <span>({place.userRatingsTotal.toLocaleString()} reviews)</span>
                            </div>
                          )}
                        </div>
                        <ActionButton 
                          variant="secondary"
                          onClick={() => handleConnect(place)}
                          disabled={connectMutation.isPending}
                        >
                          {connectMutation.isPending ? "Connecting..." : "Connect"}
                        </ActionButton>
                      </div>
                    ))}
                  </div>
                )}
                
                {searchMutation.data && searchMutation.data.length === 0 && (
                  <p className="text-sm text-brand-500">No businesses found matching that query.</p>
                )}
                {searchMutation.isError && (
                  <p className="text-sm text-red-500">Failed to search for businesses. Check API key.</p>
                )}
              </div>
            </Panel>
          ) : (
            <>
              {(activeTab === "gbp" || activeTab === "overview") && (
                <div className="space-y-4">
                  <Panel title="Google Business Profile Performance" subtitle="Profile overview and details">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-brand-200 rounded-md p-4">
                         <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1">Business Name</h3>
                         <p className="text-lg font-medium">{localSeo?.businessName || "N/A"}</p>
                      </div>
                      <div className="border border-brand-200 rounded-md p-4">
                         <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1">Registered Address</h3>
                         <p className="text-[15px] font-medium">{localSeo?.address || "N/A"}</p>
                      </div>
                      <div className="border border-brand-200 rounded-md p-4">
                         <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1">Last Updated</h3>
                         <p className="text-[15px] font-medium">{relativeTime(localSeo.updatedAt)}</p>
                      </div>
                    </div>
                  </Panel>
                  <GbpAuditPanel projectId={projectId} />
                </div>
              )}

              {(activeTab === "reviews") && (
                <Panel title="Reviews & Ratings" subtitle="Manage your local reputation">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* No deltas: nothing records a previous rating or review
                        count, so any change figure here would be invented. */}
                    <Kpi label="Average Rating" value={localSeo.rating.toFixed(1)} />
                    <Kpi label="Total Reviews" value={localSeo.reviewCount.toLocaleString()} />
                  </div>
                </Panel>
              )}

              {(activeTab === "citations") && (
                <Panel title="Citations" subtitle="Monitor your local business listings">
                  <div className="p-4">
                    <Kpi label="Active Citations (NAP)" value={(localSeo?.citationsCount || 0).toString()} />
                  </div>
                </Panel>
              )}

              {(activeTab === "rankings") && (
                <Panel title="Local Rankings" subtitle="Track your local search performance">
                  {localSeo?.rankings && localSeo.rankings.length > 0 ? (
                    <Table minWidth={600}>
                      <thead>
                        <tr>
                          <Th>Keyword</Th>
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
                              <Td><span className="font-medium text-brand-950">{r.keyword}</span></Td>
                              <Td><span className="font-bold text-brand-950">#{r.position}</span></Td>
                              <Td>
                                {delta > 0 ? (
                                  <span className="text-success-500 text-[13px] font-medium">+{delta}</span>
                                ) : delta < 0 ? (
                                  <span className="text-error-500 text-[13px] font-medium">{delta}</span>
                                ) : (
                                  <span className="text-brand-400 text-[13px]">—</span>
                                )}
                              </Td>
                              <Td><span className="text-brand-500">{r.searchVolume.toLocaleString()}</span></Td>
                            </Tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <BarChart3 size={48} className="text-brand-200 mb-4" />
                      <h3 className="text-lg font-medium text-[var(--text-primary)]">No Rankings Data</h3>
                      <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                        Your local ranking data will appear here once tracked.
                      </p>
                    </div>
                  )}
                </Panel>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GbpAuditPanel({ projectId }: { projectId: string | null }) {
  const { data: proposals, isLoading: proposalsLoading } = useGbpProposals(projectId);
  const analyzeMutation = useAnalyzeGbp(projectId);
  const approveMutation = useApproveGbpFix(projectId);
  const rejectMutation = useRejectGbpFix(projectId);

  return (
    <Panel 
      title="AI GBP Audit" 
      subtitle="Automated analysis of your Google Business Profile."
      actions={
        <ActionButton 
          variant="primary" 
          icon={analyzeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
        >
          {analyzeMutation.isPending ? "Auditing..." : "Run AI Audit"}
        </ActionButton>
      }
    >
      <div className="p-0">
        {proposalsLoading ? (
          <div className="p-8 flex justify-center"><Loader2 size={24} className="animate-spin text-brand-200" /></div>
        ) : !proposals || proposals.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">
            No pending fixes. Run an audit to analyze your profile.
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
              {proposals.map((proposal: GbpFixProposal) => (
                <Tr key={proposal.id}>
                  <Td><span className="font-medium text-xs font-mono">{proposal.field}</span></Td>
                  <Td>
                    <div className="max-w-[200px] truncate text-xs text-red-600 line-through">
                      {proposal.currentValue || "N/A"}
                    </div>
                  </Td>
                  <Td>
                    <div className="max-w-[200px] text-xs text-green-600 font-medium">
                      {proposal.proposedValue}
                    </div>
                  </Td>
                  <Td>
                    <div className="max-w-[250px] text-xs text-[var(--text-muted)] whitespace-normal">
                      {proposal.rationale}
                    </div>
                  </Td>
                  <Td>
                    {proposal.status === "PENDING" ? (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => approveMutation.mutate(proposal.id)}
                          disabled={approveMutation.isPending}
                          className="text-xs font-medium text-green-600 hover:text-green-700 bg-green-50 px-2 py-1 rounded"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => rejectMutation.mutate(proposal.id)}
                          disabled={rejectMutation.isPending}
                          className="text-xs font-medium text-brand-500 hover:text-brand-950"
                        >
                          Reject
                        </button>
                      </div>
                    ) : proposal.status === "PUSHED" ? (
                      <span className="text-xs font-medium text-green-600">Pushed Live</span>
                    ) : proposal.status === "REJECTED" ? (
                      <span className="text-xs font-medium text-brand-500">Rejected</span>
                    ) : null}
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
