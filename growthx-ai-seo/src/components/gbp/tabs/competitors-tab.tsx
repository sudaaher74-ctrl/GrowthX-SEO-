"use client";

import React, { useState } from "react";
import {
  Users,
  Search,
  Star,
  Trophy,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { useSearchLocalBusiness } from "@/hooks/use-growthx";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface CompetitorsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
}

interface RivalItem {
  id: string;
  name: string;
  address: string;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  category: string;
  visibilitySharePct: number;
}

export function CompetitorsTab({ localSeo, projectId }: CompetitorsTabProps) {
  const [rivals, setRivals] = useState<RivalItem[]>([
    {
      id: "1",
      name: "City Dental Care & Orthodontics",
      address: "Main High St, Baner",
      rating: 4.8,
      reviewCount: 420,
      distanceKm: 0.8,
      category: "Dentist",
      visibilitySharePct: 34,
    },
    {
      id: "2",
      name: "Smile Aesthetics Clinic",
      address: "Commercial Plaza, Aundh",
      rating: 4.6,
      reviewCount: 310,
      distanceKm: 1.4,
      category: "Cosmetic Dentist",
      visibilitySharePct: 28,
    },
    {
      id: "3",
      name: "Apex Multi-Specialty Dental",
      address: "Green Road, Balewadi",
      rating: 4.5,
      reviewCount: 285,
      distanceKm: 2.1,
      category: "Dental Clinic",
      visibilitySharePct: 22,
    },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const searchMutation = useSearchLocalBusiness(projectId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    searchMutation.mutate(searchQuery.trim());
  };

  const handleAddRival = (place: { name: string; address: string; rating: number; userRatingsTotal: number }) => {
    const newRival: RivalItem = {
      id: `rival-${place.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${rivals.length + 1}`,
      name: place.name,
      address: place.address,
      rating: place.rating,
      reviewCount: place.userRatingsTotal,
      distanceKm: 1.5,
      category: "Dental Clinic",
      visibilitySharePct: 15,
    };
    setRivals([...rivals, newRival]);
  };

  const handleRemove = (id: string) => {
    setRivals(rivals.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border shadow-xs" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <h2 className="text-sm font-bold text-brand-950">Local Competitors Intelligence</h2>
          <p className="text-xs text-brand-500">
            Track and benchmark your Google Maps profile against nearby rivals competing for the same 3-Pack keywords.
          </p>
        </div>

        <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200">
          Tracking {rivals.length} Local Rivals
        </span>
      </div>

      {/* Competitors Table */}
      <div className="rounded-2xl border bg-white p-5 shadow-xs" style={{ borderColor: "var(--border-color)" }}>
        <h3 className="text-sm font-bold text-brand-950 mb-3">Nearby Google Maps Rivals</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-brand-400" style={{ borderColor: "var(--border-color)" }}>
                <th className="pb-3">Business Name</th>
                <th className="pb-3">Rating & Reviews</th>
                <th className="pb-3">Distance</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Maps Share</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {/* Client business row */}
              <tr className="bg-blue-50/50 font-semibold">
                <td className="py-3 px-2 rounded-l-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="text-blue-900">{localSeo?.businessName || "Your Business (Target)"}</span>
                    <span className="rounded bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2">You</span>
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    <Star size={12} className="fill-amber-500 text-amber-500" />
                    <span className="font-mono font-bold text-brand-950">
                      {localSeo?.rating && localSeo.rating > 0 ? localSeo.rating.toFixed(1) : "—"}
                    </span>
                    <span className="text-brand-400">({localSeo?.reviewCount ?? 0})</span>
                  </div>
                </td>
                <td className="py-3 font-mono text-brand-700">0.0 km (Center)</td>
                <td className="py-3 text-brand-700">Dental Clinic</td>
                <td className="py-3">
                  <span className="font-mono font-bold text-emerald-700">26%</span>
                </td>
                <td className="py-3 text-right px-2 rounded-r-lg text-brand-400 text-[11px]">Listing Owner</td>
              </tr>

              {/* Rivals */}
              {rivals.map((r) => (
                <tr key={r.id} className="hover:bg-brand-50/50 transition">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-300" />
                      <span className="text-brand-950 font-medium">{r.name}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <Star size={12} className="fill-amber-500 text-amber-500" />
                      <span className="font-mono font-bold text-brand-950">{r.rating.toFixed(1)}</span>
                      <span className="text-brand-400">({r.reviewCount})</span>
                    </div>
                  </td>
                  <td className="py-3 font-mono text-brand-600">{r.distanceKm} km</td>
                  <td className="py-3 text-brand-600">{r.category}</td>
                  <td className="py-3 font-mono font-semibold text-brand-800">{r.visibilitySharePct}%</td>
                  <td className="py-3 text-right px-2">
                    <button
                      type="button"
                      onClick={() => handleRemove(r.id)}
                      className="text-brand-400 hover:text-rose-600 transition"
                      title="Remove rival"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Competitor Search */}
      <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-4" style={{ borderColor: "var(--border-color)" }}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-1.5">
          <Plus size={13} className="text-blue-600" />
          <span>Find & Track Local Rivals</span>
        </h3>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              type="text"
              placeholder="Search Google Maps for competitor name or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-950"
            />
          </div>
          <button
            type="submit"
            disabled={searchMutation.isPending || !searchQuery.trim()}
            className="px-4 h-9 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {searchMutation.isPending ? "Searching..." : "Search Places"}
          </button>
        </form>

        {searchMutation.data && searchMutation.data.length > 0 && (
          <div className="space-y-2 pt-2">
            {searchMutation.data.map((place) => (
              <div
                key={place.placeId || place.name}
                className="p-3 rounded-xl border border-brand-100 bg-brand-50/40 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-brand-950">{place.name}</p>
                  <p className="text-[11px] text-brand-500">{place.address}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddRival(place)}
                  className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition"
                >
                  Track Rival
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
