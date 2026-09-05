"use client";

import { useState, useEffect } from "react";
import { Panel, ActionButton, Table, Th, Td, Tr } from "@/components/ui/console";
import {
  Users,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Star,
  Trophy,
  TrendingUp,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Target,
  Sparkles,
  MapPin,
} from "lucide-react";
import { useSearchLocalBusiness } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";

export interface LocalCompetitorItem {
  id: string;
  name: string;
  address?: string;
  rating: number;
  reviewCount: number;
  category?: string;
  placeId?: string;
  isCurrentBusiness?: boolean;
}

interface LocalCompetitorsPanelProps {
  projectId: string | null;
  currentBusiness?: {
    businessName: string;
    address: string;
    rating: number;
    reviewCount: number;
  } | null;
  onOpenReviewsTab?: () => void;
}

export function LocalCompetitorsPanel({
  projectId,
  currentBusiness,
  onOpenReviewsTab,
}: LocalCompetitorsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [trackedCompetitors, setTrackedCompetitors] = useState<LocalCompetitorItem[]>([]);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualRating, setManualRating] = useState("4.5");
  const [manualReviews, setManualReviews] = useState("50");
  const [manualCategory, setManualCategory] = useState("");

  const searchMutation = useSearchLocalBusiness(projectId);

  // Load tracked competitors from local storage for persistence per project
  useEffect(() => {
    if (!projectId) return;
    try {
      const stored = localStorage.getItem(`growthx_local_competitors_${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setTrackedCompetitors(parsed);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, [projectId]);

  const saveCompetitors = (items: LocalCompetitorItem[]) => {
    setTrackedCompetitors(items);
    if (projectId) {
      try {
        localStorage.setItem(`growthx_local_competitors_${projectId}`, JSON.stringify(items));
      } catch {
        // Ignore storage write errors
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    searchMutation.mutate(searchQuery.trim());
  };

  const handleAddFromSearch = (place: {
    placeId: string;
    name: string;
    address: string;
    rating: number;
    userRatingsTotal: number;
  }) => {
    // Avoid duplicate
    if (trackedCompetitors.some((c) => c.placeId === place.placeId || c.name.toLowerCase() === place.name.toLowerCase())) {
      return;
    }

    const newItem: LocalCompetitorItem = {
      id: place.placeId || `comp_${Date.now()}`,
      name: place.name,
      address: place.address,
      rating: place.rating,
      reviewCount: place.userRatingsTotal,
      category: "Local Competitor",
      placeId: place.placeId,
    };

    saveCompetitors([...trackedCompetitors, newItem]);
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    const newItem: LocalCompetitorItem = {
      id: `manual_${Date.now()}`,
      name: manualName.trim(),
      address: manualAddress.trim() || undefined,
      rating: parseFloat(manualRating) || 0,
      reviewCount: parseInt(manualReviews, 10) || 0,
      category: manualCategory.trim() || "Local Business",
    };

    saveCompetitors([...trackedCompetitors, newItem]);
    setManualName("");
    setManualAddress("");
    setManualRating("4.5");
    setManualReviews("50");
    setManualCategory("");
    setIsAddingManual(false);
  };

  const handleRemove = (id: string) => {
    saveCompetitors(trackedCompetitors.filter((c) => c.id !== id));
  };

  // Build combined list including current business for honest side-by-side comparison
  const combinedList: LocalCompetitorItem[] = [];
  if (currentBusiness && currentBusiness.businessName) {
    combinedList.push({
      id: "current_business_node",
      name: currentBusiness.businessName,
      address: currentBusiness.address,
      rating: currentBusiness.rating,
      reviewCount: currentBusiness.reviewCount,
      category: "Your Business Profile",
      isCurrentBusiness: true,
    });
  }
  combinedList.push(...trackedCompetitors);

  // Sort descending by review count to establish local leaderboard
  const sortedLeaderboard = [...combinedList].sort((a, b) => b.reviewCount - a.reviewCount);

  // Leader analysis
  const topLeader = sortedLeaderboard[0] || null;
  const currentReviews = currentBusiness?.reviewCount || 0;
  const topLeaderReviews = topLeader ? topLeader.reviewCount : currentReviews;
  const reviewGap = Math.max(0, topLeaderReviews - currentReviews);

  return (
    <div className="space-y-6">
      {/* Overview & Gap Analysis */}
      <Panel
        title="Local Competitor Benchmark Matrix"
        subtitle="Benchmark your Google Business Profile against nearby local rivals to identify ranking and review gaps."
      >
        <div className="p-5 space-y-6">
          <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/50 p-3 text-xs text-brand-600">
            <ShieldAlert size={14} className="shrink-0 text-brand-500" />
            <span>
              All competitor metrics are publicly listed Google Maps and Google Places profile data.
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-brand-200 bg-brand-50/40">
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">Your Local Standing</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-brand-950 font-mono">
                  {currentBusiness?.rating ? currentBusiness.rating.toFixed(1) : "—"} ★
                </span>
                <span className="text-xs text-brand-500 font-mono">
                  ({currentBusiness?.reviewCount.toLocaleString() || 0} reviews)
                </span>
              </div>
              <p className="text-[11.5px] text-brand-500 mt-1">Connected Google profile</p>
            </div>

            <div className="p-4 rounded-xl border border-brand-200 bg-brand-50/40">
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">Area Category Leader</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-brand-950 font-mono">
                  {topLeader ? `${topLeader.rating.toFixed(1)} ★` : "—"}
                </span>
                <span className="text-xs text-brand-500 font-mono">
                  ({topLeader ? topLeader.reviewCount.toLocaleString() : 0} reviews)
                </span>
              </div>
              <p className="text-[11.5px] text-brand-600 truncate mt-1">
                {topLeader ? topLeader.name : "Add competitors below"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-accent-200 bg-accent-50/40">
              <p className="text-xs font-semibold text-accent-700 uppercase tracking-wider mb-1">Review Deficit to #1</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-accent-950 font-mono">
                  {reviewGap === 0 ? "Leading Area" : `-${reviewGap.toLocaleString()}`}
                </span>
              </div>
              <p className="text-[11.5px] text-accent-700 mt-1">
                {reviewGap === 0
                  ? "Your business holds top review volume"
                  : "Reviews needed to match trade area leader"}
              </p>
            </div>
          </div>

          {/* Competitors Leaderboard Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-brand-950 flex items-center gap-2">
                <Trophy size={16} className="text-amber-500" />
                Local Trade Area Leaderboard ({combinedList.length} Businesses)
              </h4>
            </div>

            {combinedList.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-brand-200 rounded-xl bg-brand-50/30 text-xs text-brand-500">
                No local businesses tracked yet. Search Google Places below or add your key competitors manually.
              </div>
            ) : (
              <Table minWidth={700}>
                <thead>
                  <tr>
                    <Th>Rank</Th>
                    <Th>Business Name</Th>
                    <Th>Category / Note</Th>
                    <Th>Google Rating</Th>
                    <Th>Total Reviews</Th>
                    <Th>Review Gap</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((item, index) => {
                    const diff = item.reviewCount - currentReviews;
                    return (
                      <Tr key={item.id} className={item.isCurrentBusiness ? "bg-accent-50/50 font-medium" : ""}>
                        <Td>
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            index === 0 ? 'bg-amber-400 text-amber-950' :
                            index === 1 ? 'bg-slate-200 text-slate-800' :
                            index === 2 ? 'bg-amber-700/80 text-white' :
                            'bg-brand-100 text-brand-700'
                          }`}>
                            #{index + 1}
                          </span>
                        </Td>
                        <Td>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-brand-950">{item.name}</span>
                              {item.isCurrentBusiness && (
                                <span className="text-[10px] bg-accent-600 text-white px-1.5 py-0.2 rounded font-semibold">
                                  You
                                </span>
                              )}
                            </div>
                            {item.address && (
                              <p className="text-[11px] text-brand-500 truncate max-w-[240px]">
                                {item.address}
                              </p>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <span className="text-xs text-brand-600">{item.category || "Local Business"}</span>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1 font-mono font-semibold text-brand-900">
                            <Star size={12} className="text-amber-500 fill-amber-500" />
                            {item.rating.toFixed(1)}
                          </div>
                        </Td>
                        <Td>
                          <span className="font-mono font-semibold text-brand-900">
                            {item.reviewCount.toLocaleString()}
                          </span>
                        </Td>
                        <Td>
                          {item.isCurrentBusiness ? (
                            <span className="text-xs font-mono text-brand-400">—</span>
                          ) : diff > 0 ? (
                            <span className="text-xs font-mono font-semibold text-rose-600">+{diff.toLocaleString()} ahead</span>
                          ) : diff < 0 ? (
                            <span className="text-xs font-mono font-semibold text-emerald-600">{diff.toLocaleString()} behind</span>
                          ) : (
                            <span className="text-xs font-mono text-brand-500">Tied</span>
                          )}
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${item.name} ${item.address || ""}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-brand-400 hover:text-accent-600 rounded transition-colors"
                              title="View on Google Maps"
                            >
                              <ExternalLink size={14} />
                            </a>
                            {!item.isCurrentBusiness && (
                              <button
                                type="button"
                                onClick={() => handleRemove(item.id)}
                                className="p-1 text-brand-400 hover:text-rose-600 rounded transition-colors"
                                title="Remove competitor"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </Panel>

      {/* Review Velocity & Acquisition Simulator */}
      {reviewGap > 0 && (
        <Panel
          title="Review Velocity Overtake Simulator"
          subtitle="Model how quickly your business can surpass the top local competitor based on monthly review velocity."
        >
          <div className="p-5 space-y-4">
            <p className="text-xs text-brand-600 leading-relaxed">
              To close the <span className="font-bold text-brand-950 font-mono">{reviewGap.toLocaleString()} review gap</span> with{" "}
              <span className="font-semibold text-brand-900">{topLeader?.name}</span>, here is how long it will take at various collection speeds:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-brand-200 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-brand-700">Steady Pace</span>
                  <span className="text-[10px] bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full font-semibold">+5 reviews/mo</span>
                </div>
                <p className="text-2xl font-bold font-mono text-brand-950 mt-2">
                  {Math.ceil(reviewGap / 5)} <span className="text-xs font-normal text-brand-500">months</span>
                </p>
                <p className="text-[11.5px] text-brand-500 mt-1">Achievable with standard in-person asks</p>
              </div>

              <div className="p-4 rounded-xl border border-accent-300 bg-accent-50/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-accent-900">Automated Autopilot</span>
                  <span className="text-[10px] bg-accent-600 text-white px-2 py-0.5 rounded-full font-semibold">+15 reviews/mo</span>
                </div>
                <p className="text-2xl font-bold font-mono text-accent-950 mt-2">
                  {Math.ceil(reviewGap / 15)} <span className="text-xs font-normal text-accent-700">months</span>
                </p>
                <p className="text-[11.5px] text-accent-800 mt-1">With SMS/email review shortlinks after each job</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-emerald-900">Aggressive Campaign</span>
                  <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-semibold">+30 reviews/mo</span>
                </div>
                <p className="text-2xl font-bold font-mono text-emerald-950 mt-2">
                  {Math.ceil(reviewGap / 30)} <span className="text-xs font-normal text-emerald-700">months</span>
                </p>
                <p className="text-[11.5px] text-emerald-800 mt-1">Multi-channel customer engagement campaign</p>
              </div>
            </div>

            {onOpenReviewsTab && (
              <div className="pt-2">
                <ActionButton
                  variant="primary"
                  icon={<Sparkles size={13} />}
                  onClick={onOpenReviewsTab}
                >
                  Generate Review Acquisition Shortlink
                </ActionButton>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Add Competitors Section */}
      <Panel
        title="Add Local Competitors"
        subtitle="Search Google Places for nearby rivals or enter competitor profile information."
        actions={
          <ActionButton
            variant="secondary"
            icon={<Plus size={13} />}
            onClick={() => setIsAddingManual(!isAddingManual)}
          >
            {isAddingManual ? "Cancel Manual Entry" : "Add Competitor Manually"}
          </ActionButton>
        }
      >
        <div className="p-5 space-y-6">
          {/* Search Google Places Form */}
          <form onSubmit={handleSearch} className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                type="text"
                placeholder="Search competitor by name or query (e.g. 'Apex Dental Seattle')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-brand-200 bg-white text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-600"
              />
            </div>
            <ActionButton
              variant="primary"
              icon={searchMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              disabled={searchMutation.isPending || !searchQuery.trim()}
            >
              {searchMutation.isPending ? "Searching Google..." : "Search Places"}
            </ActionButton>
          </form>

          {/* Search Results */}
          {searchMutation.data && searchMutation.data.length > 0 && (
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-brand-600">
                Google Places Matches ({searchMutation.data.length})
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchMutation.data.map((place) => {
                  const alreadyAdded = trackedCompetitors.some(
                    (c) => c.placeId === place.placeId || c.name.toLowerCase() === place.name.toLowerCase()
                  );
                  return (
                    <div
                      key={place.placeId}
                      className="p-3.5 rounded-xl border border-brand-200 bg-white shadow-sm flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-brand-950 truncate">{place.name}</p>
                        <p className="text-[11px] text-brand-500 truncate mt-0.5">{place.address}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-brand-800">
                            <Star size={11} className="text-amber-500 fill-amber-500" />
                            {place.rating.toFixed(1)}
                          </span>
                          <span className="text-[11px] text-brand-500">
                            ({place.userRatingsTotal.toLocaleString()} reviews)
                          </span>
                        </div>
                      </div>
                      <ActionButton
                        variant={alreadyAdded ? "secondary" : "primary"}
                        icon={alreadyAdded ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Plus size={12} />}
                        onClick={() => handleAddFromSearch(place)}
                        disabled={alreadyAdded}
                      >
                        {alreadyAdded ? "Tracked" : "Track"}
                      </ActionButton>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {searchMutation.error && (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Notice regarding Google Places live search:</p>
              <p className="text-amber-800">{errorMessage(searchMutation.error)}</p>
              <p className="text-amber-700">
                You can easily track any local competitor right now using the manual entry form above!
              </p>
            </div>
          )}

          {/* Manual Entry Form */}
          {isAddingManual && (
            <form onSubmit={handleAddManual} className="p-4 bg-brand-50/70 rounded-xl border border-brand-200 space-y-4">
              <h5 className="text-xs font-bold text-brand-950">Add Competitor Profile Information</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-brand-700 mb-1">Business Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Plumbing Services"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full h-9 rounded-md border border-brand-200 bg-white px-3 text-xs shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-brand-700 mb-1">Address / Trade Area</label>
                  <input
                    type="text"
                    placeholder="e.g. 450 Market St, Downtown"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    className="w-full h-9 rounded-md border border-brand-200 bg-white px-3 text-xs shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-brand-700 mb-1">Google Star Rating (0 - 5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={manualRating}
                    onChange={(e) => setManualRating(e.target.value)}
                    className="w-full h-9 rounded-md border border-brand-200 bg-white px-3 text-xs shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-brand-700 mb-1">Total Google Reviews</label>
                  <input
                    type="number"
                    min="0"
                    value={manualReviews}
                    onChange={(e) => setManualReviews(e.target.value)}
                    className="w-full h-9 rounded-md border border-brand-200 bg-white px-3 text-xs shadow-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-brand-700 mb-1">Category / Specialty</label>
                  <input
                    type="text"
                    placeholder="e.g. Emergency Plumber, 24/7 HVAC"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-brand-200 bg-white px-3 text-xs shadow-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <ActionButton variant="secondary" onClick={() => setIsAddingManual(false)}>
                  Cancel
                </ActionButton>
                <ActionButton variant="primary" icon={<Plus size={13} />}>
                  Save to Leaderboard
                </ActionButton>
              </div>
            </form>
          )}
        </div>
      </Panel>
    </div>
  );
}
