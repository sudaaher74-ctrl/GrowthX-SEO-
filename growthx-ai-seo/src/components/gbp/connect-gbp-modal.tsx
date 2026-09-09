"use client";

import { useState } from "react";
import { Search, Loader2, MapPin, Star, Building2, Check, AlertCircle, X } from "lucide-react";
import { GoogleGLogo } from "./gbp-icons";
import { useSearchLocalBusiness, useConnectLocalBusiness } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";

interface ConnectGbpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onConnected?: () => void;
}

export function ConnectGbpModal({
  open,
  onOpenChange,
  projectId,
  onConnected,
}: ConnectGbpModalProps) {
  const [activeMode, setActiveMode] = useState<"search" | "manual">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualRating, setManualRating] = useState("");
  const [manualReviews, setManualReviews] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);

  const searchMutation = useSearchLocalBusiness(projectId);
  const connectMutation = useConnectLocalBusiness(projectId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setErrorText(null);
    searchMutation.mutate(searchQuery.trim(), {
      onError: (err) => {
        setErrorText(errorMessage(err));
      },
    });
  };

  const handleSelectPlace = (place: {
    placeId?: string;
    name: string;
    address: string;
    rating: number;
    userRatingsTotal: number;
    latitude?: number;
    longitude?: number;
  }) => {
    setErrorText(null);
    connectMutation.mutate(
      {
        businessName: place.name,
        address: place.address,
        rating: place.rating,
        reviewCount: place.userRatingsTotal,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onConnected?.();
        },
        onError: (err) => {
          setErrorText(errorMessage(err));
        },
      }
    );
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualAddress.trim()) return;
    setErrorText(null);

    const parsedRating = parseFloat(manualRating) || 0;
    const parsedReviews = parseInt(manualReviews, 10) || 0;

    connectMutation.mutate(
      {
        businessName: manualName.trim(),
        address: manualAddress.trim(),
        rating: parsedRating,
        reviewCount: parsedReviews,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onConnected?.();
        },
        onError: (err) => {
          setErrorText(errorMessage(err));
        },
      }
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border bg-white shadow-2xl animate-in fade-in zoom-in-95">
        <div className="bg-brand-950 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md">
              <GoogleGLogo size={22} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Connect Google Business Profile
              </h3>
              <p className="text-xs text-brand-300">
                Link your verified Google Maps storefront to unlock audit & analytics
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-brand-400 hover:text-white transition p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Mode Switcher */}
          <div className="flex rounded-lg bg-brand-100 p-1">
            <button
              type="button"
              onClick={() => {
                setActiveMode("search");
                setErrorText(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeMode === "search"
                  ? "bg-white text-brand-950 shadow-xs"
                  : "text-brand-600 hover:text-brand-950"
              }`}
            >
              Search Google Places
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode("manual");
                setErrorText(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeMode === "manual"
                  ? "bg-white text-brand-950 shadow-xs"
                  : "text-brand-600 hover:text-brand-950"
              }`}
            >
              Enter Details Manually
            </button>
          </div>

          {errorText && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-error-50 border border-error-200 text-xs text-error-800">
              <AlertCircle size={15} className="text-error-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorText}</div>
            </div>
          )}

          {activeMode === "search" ? (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                  <input
                    type="text"
                    placeholder="Search by business name and city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-950"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchMutation.isPending || !searchQuery.trim()}
                  className="px-4 h-10 rounded-lg bg-brand-950 text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition disabled:opacity-50"
                >
                  {searchMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                  Search
                </button>
              </form>

              {/* Results */}
              <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-brand-100">
                {searchMutation.data && searchMutation.data.length > 0 ? (
                  searchMutation.data.map((place) => (
                    <div
                      key={place.placeId || place.name}
                      className="pt-2 first:pt-0 flex items-center justify-between p-3 rounded-lg hover:bg-brand-50 border border-transparent hover:border-brand-200 transition"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-semibold text-brand-950 truncate">{place.name}</p>
                        <p className="text-xs text-brand-500 truncate flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="shrink-0 text-brand-400" />
                          {place.address}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-brand-600">
                          <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                            <Star size={11} className="fill-amber-500 text-amber-500" />
                            {place.rating > 0 ? place.rating.toFixed(1) : "—"}
                          </span>
                          <span>•</span>
                          <span>{place.userRatingsTotal} reviews</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectPlace(place)}
                        disabled={connectMutation.isPending}
                        className="shrink-0 px-3 py-1.5 rounded-md bg-brand-950 text-white text-xs font-medium hover:opacity-90 transition flex items-center gap-1"
                      >
                        {connectMutation.isPending ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Check size={11} />
                        )}
                        Select
                      </button>
                    </div>
                  ))
                ) : searchMutation.isSuccess ? (
                  <p className="text-center py-6 text-xs text-brand-500">
                    No matching Google places found. Try a different search query or switch to manual entry.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-brand-700 mb-1">
                  Business Name <span className="text-error-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Dental Care"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-950"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-700 mb-1">
                  Physical Storefront Address <span className="text-error-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Street, City, State, ZIP code"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-700 mb-1">
                    Google Rating (optional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    placeholder="e.g. 4.8"
                    value={manualRating}
                    onChange={(e) => setManualRating(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-700 mb-1">
                    Review Count (optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 150"
                    value={manualReviews}
                    onChange={(e) => setManualReviews(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-950"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-2 rounded-lg border border-brand-200 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectMutation.isPending || !manualName.trim() || !manualAddress.trim()}
                  className="px-4 py-2 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {connectMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                  Connect Profile
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
