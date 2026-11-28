"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  MapPin,
  Phone,
  Radar,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import { ActionButton, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import type { LocalCopilotPack } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { GeoGridPanel } from "./geo-grid-panel";
import { ReviewQrKit } from "./review-qr-kit";

const GeoGridMap = dynamic(
  () => import("./geo-grid-map").then((m) => m.GeoGridMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[270px] items-center justify-center rounded-2xl border border-brand-200 bg-surface-1 text-xs text-brand-400">
        Loading map preview…
      </div>
    ),
  },
);

type LocalTab = "overview" | "map" | "reviews" | "growth";
type GrowthSection = "directories" | "posts";
type DirectoryFilter = "missing" | "all" | "listed";
type PostSection = "posts" | "bio" | "qna";

export function LocalSeoWorkspace() {
  const { projectId, projects } = useWorkspace();
  const activeProject = projects.find((p) => p.id === projectId) ?? null;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<LocalTab>("overview");
  const [growthSection, setGrowthSection] = useState<GrowthSection>("directories");
  const [dirFilter, setDirFilter] = useState<DirectoryFilter>("missing");
  const [postSection, setPostSection] = useState<PostSection>("posts");
  const [searchQuery, setSearchQuery] = useState("");
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copilotPack, setCopilotPack] = useState<LocalCopilotPack | null>(null);

  const profileQuery = useQuery({
    queryKey: ["local-profile-audit", projectId],
    queryFn: () => api.getLocalProfileAudit(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const savedListingQuery = useQuery({
    queryKey: ["local-saved-listing", projectId],
    queryFn: () => api.getLocalSeo(projectId!),
    enabled: Boolean(projectId) && profileQuery.isError,
    retry: false,
  });

  const citationsQuery = useQuery({
    queryKey: ["local-citations-audit", projectId],
    queryFn: () => api.getLocalCitationsAudit(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const geoHistoryQuery = useQuery({
    queryKey: ["local-geo-grid-history", projectId],
    queryFn: () => api.getGeoGridHistory(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const latestGridRunId = geoHistoryQuery.data?.[0]?.id ?? null;

  const latestGridRunQuery = useQuery({
    queryKey: ["local-geo-grid-run", projectId, latestGridRunId],
    queryFn: () => api.getGeoGridRun(projectId!, latestGridRunId!),
    enabled: Boolean(projectId && latestGridRunId),
    staleTime: 60_000,
    retry: false,
  });

  const refreshProfile = useMutation({
    mutationFn: () => api.refreshLocalProfileAudit(projectId!),
    onSuccess: (data) => {
      queryClient.setQueryData(["local-profile-audit", projectId], data);
      queryClient.invalidateQueries({ queryKey: ["local-citations-audit", projectId] });
    },
  });

  const searchMaps = useMutation({
    mutationFn: (q: string) => api.searchLocalBusiness(projectId!, q),
  });

  const connectListing = useMutation({
    mutationFn: (place: {
      placeId: string;
      name: string;
      address: string;
      rating: number;
      userRatingsTotal: number;
      latitude?: number;
      longitude?: number;
    }) =>
      api.connectLocalBusiness(projectId!, {
        businessName: place.name,
        address: place.address,
        rating: place.rating,
        reviewCount: place.userRatingsTotal,
        placeId: place.placeId,
        latitude: place.latitude,
        longitude: place.longitude,
      }),
    onSuccess: (location) => {
      if (location.projectId === projectId) setShowConnectForm(false);
      queryClient.setQueryData(["local-saved-listing", location.projectId], location);
      queryClient.invalidateQueries({ queryKey: ["local-profile-audit", location.projectId] });
      queryClient.invalidateQueries({ queryKey: ["local-saved-listing", location.projectId] });
      queryClient.invalidateQueries({ queryKey: ["local-citations-audit", location.projectId] });
    },
  });

  const generateCopilot = useMutation({
    mutationFn: (forceRefresh: boolean) => api.generateLocalCopilotPack(projectId!, forceRefresh),
    onSuccess: (data) => setCopilotPack(data),
  });

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const profile = profileQuery.data;
  const citations = citationsQuery.data;
  const listing = profile?.listing ?? null;
  const audit = profile?.audit ?? null;
  const ctx = profile?.businessContext ?? null;
  const savedListing = profileQuery.isError ? savedListingQuery.data : null;
  const placeId = profile?.placeId || savedListing?.placeId || null;
  const savedMapsUrl = savedListing?.placeId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(savedListing.businessName)}&query_place_id=${encodeURIComponent(savedListing.placeId)}`
    : null;
  const manageProfileUrl =
    profile?.links.manageProfileUrl || "https://www.google.com/search?q=my+business";
  const loadingListing =
    profileQuery.isPending || (profileQuery.isError && savedListingQuery.isPending);
  const effectiveSearchInput = searchQuery || profile?.suggestedQuery || activeProject?.name || "";
  const defaultGeoKeyword =
    ctx?.offerings?.[0] || listing?.primaryTypeDisplayName || ctx?.industry || "";

  const centerLat = listing?.latitude ?? savedListing?.latitude ?? null;
  const centerLng = listing?.longitude ?? savedListing?.longitude ?? null;
  const latestAvgRank = geoHistoryQuery.data?.[0]?.averageRank ?? null;

  const { actionChecks, passingChecks } = useMemo(() => {
    const checks = audit?.checks ?? [];
    return {
      actionChecks: checks.filter((c) => c.status !== "PASS"),
      passingChecks: checks.filter((c) => c.status === "PASS"),
    };
  }, [audit]);

  const filteredDirectories = useMemo(() => {
    const dirs = citations?.directories ?? [];
    if (dirFilter === "missing") return dirs.filter((d) => d.status === "NOT_DETECTED");
    if (dirFilter === "listed") return dirs.filter((d) => d.status !== "NOT_DETECTED");
    return dirs;
  }, [citations, dirFilter]);

  if (!projectId) {
    return (
      <div className="p-6">
        <StatusNote tone="warn">Select a project in the top bar to open Local &amp; Maps.</StatusNote>
      </div>
    );
  }

  const tabs: { id: LocalTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <MapPin size={13} />,
      badge: audit ? `${audit.score}` : undefined,
    },
    {
      id: "map",
      label: "Rank Map",
      icon: <Radar size={13} />,
      badge: latestAvgRank != null ? `#${latestAvgRank.toFixed(1)}` : undefined,
    },
    {
      id: "reviews",
      label: "Reviews",
      icon: <Star size={13} />,
      badge: listing?.userRatingCount != null ? String(listing.userRatingCount) : undefined,
    },
    {
      id: "growth",
      label: "Listings & Posts",
      icon: <Link2 size={13} />,
      badge:
        citations && citations.summary.missingCount > 0
          ? `${citations.summary.missingCount} left`
          : undefined,
    },
  ];

  const scoreTone =
    !audit
      ? "text-brand-500"
      : audit.score >= 80
        ? "text-success-700"
        : audit.score >= 50
          ? "text-warning-700"
          : "text-error-700";

  return (
    <div className="space-y-5 pb-12">
      {/* Clean Executive Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-950">Local &amp; Maps</h1>
          <p className="mt-0.5 text-[13px] text-brand-500">
            Track your Google Maps rankings, fix profile gaps, and grow customer reviews.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {profile?.placeId && (
            <ActionButton
              variant="secondary"
              disabled={refreshProfile.isPending}
              onClick={() => refreshProfile.mutate()}
              icon={<RefreshCw size={12} className={refreshProfile.isPending ? "animate-spin" : ""} />}
            >
              {refreshProfile.isPending ? "Syncing..." : "Sync"}
            </ActionButton>
          )}
          <ActionButton
            variant="secondary"
            onClick={() => setShowConnectForm((prev) => !prev)}
            icon={<Search size={12} />}
          >
            {placeId ? "Switch Listing" : "Connect Google Maps"}
          </ActionButton>
          <a
            href={manageProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink transition hover:bg-signal-500 shadow-xs"
          >
            <span>Open on Google</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Missing API key notice (concise, plain English) */}
      {profile?.state === "NOT_CONFIGURED" && (
        <StatusNote tone="warn">
          Live Google Maps sync isn’t enabled on this server yet (<code>GOOGLE_PLACES_API_KEY</code> is missing). You can still use <strong>Listings &amp; Posts</strong> right away.
        </StatusNote>
      )}

      {/* Connect / Switch Listing Search Card */}
      {(showConnectForm || profile?.state === "NO_PLACE") && profile?.state !== "NOT_CONFIGURED" && (
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-950">Find your business on Google Maps</h2>
            <p className="mt-0.5 text-xs text-brand-500">
              Search by business name and city to pull your live rating, reviews, and location pin.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (effectiveSearchInput.trim() && !searchMaps.isPending) {
                searchMaps.mutate(effectiveSearchInput.trim());
              }
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              type="text"
              value={effectiveSearchInput}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter business name and city..."
              className="min-w-[240px] flex-1 rounded-xl border border-brand-200 bg-surface-2 px-3 py-2 text-[13px] text-brand-950 focus:border-primary-600 focus:outline-none"
            />
            <ActionButton
              variant="primary"
              disabled={!effectiveSearchInput.trim() || searchMaps.isPending}
              onClick={() => searchMaps.mutate(effectiveSearchInput.trim())}
              icon={searchMaps.isPending ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            >
              {searchMaps.isPending ? "Searching..." : "Search Google Maps"}
            </ActionButton>
          </form>

          {searchMaps.isError && (
            <StatusNote tone="bad">
              {searchMaps.error instanceof Error ? searchMaps.error.message : "Search failed."}
            </StatusNote>
          )}
          {connectListing.isError && (
            <StatusNote tone="bad">Could not save this listing. Try connecting it again.</StatusNote>
          )}

          {(searchMaps.data?.length ?? 0) > 0 && (
            <div className="divide-y divide-brand-100 rounded-xl border border-brand-200">
              {searchMaps.data!.map((item) => (
                <div key={item.placeId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-brand-950">{item.name}</p>
                    <p className="text-xs text-brand-500">{item.address}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-brand-500">
                      {item.rating > 0 ? `${item.rating.toFixed(1)}★` : "No rating"} · {item.userRatingsTotal} reviews
                    </p>
                  </div>
                  <ActionButton
                    variant="primary"
                    disabled={connectListing.isPending}
                    onClick={() => connectListing.mutate(item)}
                  >
                    {connectListing.isPending ? "Connecting..." : "Connect Listing"}
                  </ActionButton>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clean 4-Tab Pill Bar */}
      <div
        role="tablist"
        aria-label="Local and Maps sections"
        className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-brand-200 bg-surface-1 p-1 shadow-2xs"
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                active
                  ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                  : "text-brand-600 hover:bg-brand-100/70 hover:text-brand-950",
              )}
            >
              <span>{t.label}</span>
              {t.badge && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums",
                    active ? "bg-signal-ink/15 text-signal-ink" : "bg-brand-100 text-brand-700",
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW (3 Minimal Surfaces) ── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {listing && audit ? (
            <>
              {/* Surface 1: Compact Business & Score Strip */}
              <div className="rounded-2xl border border-brand-200 bg-surface-1 shadow-2xs overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-y divide-brand-100 sm:grid-cols-4 sm:divide-y-0">
                  <div className="p-4 sm:p-5">
                    <p className="text-[11px] font-medium text-brand-400">Profile Health</p>
                    <p className={cn("mt-1 font-mono text-2xl font-bold tabular-nums", scoreTone)}>
                      {audit.score}
                      <span className="text-sm font-medium text-brand-400">/100</span>
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-brand-500">
                      {audit.passedCount} of {audit.totalChecks} checks passing
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTab("reviews")}
                    className="p-4 text-left transition hover:bg-surface-2 sm:p-5 cursor-pointer"
                  >
                    <p className="text-[11px] font-medium text-brand-400">Google Rating</p>
                    <p className="mt-1 flex items-center gap-1 font-mono text-2xl font-bold text-brand-950 tabular-nums">
                      {listing.rating != null ? listing.rating.toFixed(1) : "—"}
                      <Star size={16} className="text-warning-500" />
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-brand-500 tabular-nums">
                      {listing.userRatingCount != null
                        ? `${listing.userRatingCount.toLocaleString()} reviews`
                        : "No reviews yet"}
                    </p>
                  </button>

                  <div className="p-4 sm:p-5">
                    <p className="text-[11px] font-medium text-brand-400">Photos</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-brand-950 tabular-nums">
                      {listing.photos.length}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-brand-500">
                      {listing.photos.length >= 8 ? "Good gallery" : "Aim for 10+"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setGrowthSection("directories");
                      setTab("growth");
                    }}
                    className="p-4 text-left transition hover:bg-surface-2 sm:p-5 cursor-pointer"
                  >
                    <p className="text-[11px] font-medium text-brand-400">Directories</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-brand-950 tabular-nums">
                      {citations
                        ? `${citations.summary.coveredCount}/${citations.summary.totalDirectories}`
                        : "—"}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-brand-500">
                      {citations
                        ? citations.summary.missingCount > 0
                          ? `${citations.summary.missingCount} missing →`
                          : "All covered"
                        : "Checking…"}
                    </p>
                  </button>
                </div>

                {/* Compact Business Identity Footer + Collapsible Details */}
                <div className="border-t border-brand-100 bg-surface-2/60 px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-semibold text-brand-950">
                        {listing.name || "Connected Listing"}
                      </span>
                      {listing.primaryTypeDisplayName && (
                        <Pill tone="default">{listing.primaryTypeDisplayName}</Pill>
                      )}
                      {listing.shortAddress || listing.address ? (
                        <span className="truncate text-brand-500">
                          {listing.shortAddress || listing.address}
                        </span>
                      ) : null}
                    </div>
                    {profile?.fetchedAt && (
                      <span className="text-[11px] text-brand-400">
                        Synced {relativeTime(profile.fetchedAt)}
                      </span>
                    )}
                  </div>

                  <details className="faq-details mt-2">
                    <summary className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-500 hover:text-brand-950 cursor-pointer list-none">
                      <ChevronDown size={13} />
                      <span>Hours, phone &amp; tracking link</span>
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-4 border-t border-brand-200/60 pt-3 text-xs sm:grid-cols-2">
                      <div className="space-y-2 text-brand-700">
                        {listing.address && (
                          <p className="flex items-start gap-2">
                            <MapPin size={13} className="mt-0.5 shrink-0 text-brand-400" />
                            <span>{listing.address}</span>
                          </p>
                        )}
                        {(listing.phone || listing.internationalPhone) && (
                          <p className="flex items-center gap-2">
                            <Phone size={13} className="shrink-0 text-brand-400" />
                            <span>{listing.phone || listing.internationalPhone}</span>
                          </p>
                        )}
                        {listing.website && (
                          <p className="flex items-center gap-2 break-all">
                            <Globe size={13} className="shrink-0 text-brand-400" />
                            <a
                              href={listing.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-brand-950"
                            >
                              {listing.website}
                            </a>
                          </p>
                        )}
                        {profile?.links.utmWebsiteUrl && (
                          <div className="pt-1">
                            <ActionButton
                              variant="secondary"
                              onClick={() => copyText(profile.links.utmWebsiteUrl!, "utm-url")}
                              icon={copiedKey === "utm-url" ? <Check size={11} /> : <Copy size={11} />}
                            >
                              {copiedKey === "utm-url"
                                ? "Copied Maps Tracking Link"
                                : "Copy Website Tracking Link"}
                            </ActionButton>
                          </div>
                        )}
                      </div>

                      {listing.hours?.weekdayDescriptions?.length ? (
                        <div>
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-400">
                            <Clock size={12} /> Opening Hours
                          </p>
                          <ul className="mt-1 space-y-0.5 text-[11.5px] text-brand-600">
                            {listing.hours.weekdayDescriptions.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              </div>

              {/* Surface 2 & 3: Action-Only Fix Checklist + Live Map Preview */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {/* Action-Only Checklist */}
                <div className="lg:col-span-7 rounded-2xl border border-brand-200 bg-surface-1 shadow-2xs overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b border-brand-100 px-5 py-4">
                    <div>
                      <h2 className="text-sm font-semibold text-brand-950">What to fix next</h2>
                      <p className="mt-0.5 text-xs text-brand-500">
                        {actionChecks.length > 0
                          ? `${actionChecks.length} profile ${actionChecks.length === 1 ? "item needs" : "items need"} attention on Google Maps.`
                          : "Your Google Maps profile is in great shape."}
                      </p>
                    </div>
                    {actionChecks.length > 0 && (
                      <a
                        href={manageProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-950"
                      >
                        <span>Edit on Google</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>

                  {actionChecks.length === 0 ? (
                    <div className="flex items-center gap-3 px-5 py-6 text-sm text-success-700">
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                      <span className="font-medium">All {audit.totalChecks} profile checks passed.</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-brand-100">
                      {actionChecks.map((c) => (
                        <div key={c.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                          <div className="flex items-start gap-2.5 min-w-0">
                            {c.status === "FAIL" ? (
                              <XCircle size={15} className="mt-0.5 shrink-0 text-error-600" />
                            ) : (
                              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning-600" />
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-semibold text-brand-950">
                                  {c.label}
                                </span>
                                <span className="font-mono text-[11px] text-brand-400">{c.value}</span>
                              </div>
                              <p className="mt-0.5 text-xs text-brand-500">{c.recommendation}</p>
                            </div>
                          </div>
                          <a
                            href={manageProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 rounded-lg border border-brand-200 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100/70 hover:text-brand-950"
                          >
                            Fix ↗
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {passingChecks.length > 0 && (
                    <details className="faq-details border-t border-brand-100 bg-surface-2/50 px-5 py-3">
                      <summary className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-950 cursor-pointer list-none">
                        <CheckCircle2 size={13} className="text-success-600" />
                        <span>{passingChecks.length} checks passed</span>
                        <ChevronDown size={13} />
                      </summary>
                      <div className="mt-2.5 divide-y divide-brand-100">
                        {passingChecks.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                            <span className="text-brand-700">{c.label}</span>
                            <span className="font-mono text-[11px] text-brand-500">{c.value}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                {/* Live Neighborhood Map Preview */}
                <div className="lg:col-span-5 flex flex-col gap-2">
                  <GeoGridMap
                    run={latestGridRunQuery.data ?? null}
                    businessName={listing.name || activeProject?.name || "Your Business"}
                    centerLat={centerLat}
                    centerLng={centerLng}
                    selectedNode={null}
                    mode="compact"
                    onOpenFullMap={() => setTab("map")}
                  />
                  <div className="flex items-center justify-between px-1 text-[11.5px] text-brand-500">
                    <span>
                      {latestGridRunQuery.data
                        ? `Last rank map: ${relativeTime(latestGridRunQuery.data.scannedAt)}`
                        : "See where you rank across nearby areas."}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTab("map")}
                      className="font-semibold text-brand-950 hover:underline cursor-pointer"
                    >
                      Open Rank Map →
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : loadingListing ? (
            <div className="rounded-2xl border border-brand-200 bg-surface-1 p-6 shadow-2xs">
              <p role="status" className="text-[13px] text-brand-500">
                Checking your saved Google Maps listing…
              </p>
            </div>
          ) : savedListing?.placeId ? (
            <div className="rounded-2xl border border-brand-200 bg-surface-1 p-6 shadow-2xs space-y-2.5">
              <h2 className="text-sm font-semibold text-brand-950">Google Maps listing connected</h2>
              <p className="text-sm font-semibold text-brand-950">{savedListing.businessName}</p>
              <p className="text-[13px] text-brand-600">{savedListing.address}</p>
              {savedMapsUrl && (
                <a
                  href={savedMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-950 underline"
                >
                  Open listing in Google Maps <ExternalLink size={12} />
                </a>
              )}
              <StatusNote tone="warn">
                The full Maps audit is currently unavailable. Your listing is saved.
              </StatusNote>
            </div>
          ) : profileQuery.isError && savedListingQuery.isError ? (
            <div className="rounded-2xl border border-brand-200 bg-surface-1 p-6 shadow-2xs space-y-3">
              <StatusNote tone="warn">Could not check your saved Google Maps listing.</StatusNote>
              <ActionButton
                onClick={() => void Promise.all([profileQuery.refetch(), savedListingQuery.refetch()])}
              >
                Try again
              </ActionButton>
            </div>
          ) : (
            <div className="rounded-2xl border border-brand-200 bg-surface-1 p-6 shadow-2xs">
              <h2 className="text-sm font-semibold text-brand-950">No Google Maps listing connected yet</h2>
              <p className="mt-1 text-xs text-brand-500">
                Search for your business above to connect it, or jump into{" "}
                <button
                  type="button"
                  onClick={() => setTab("growth")}
                  className="font-semibold text-brand-950 underline cursor-pointer"
                >
                  Listings &amp; Posts
                </button>{" "}
                to check directories and draft Google updates right away.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: RANK MAP (Live Street Heatmap + Competitors) ── */}
      {tab === "map" && (
        <GeoGridPanel
          projectId={projectId}
          defaultKeyword={defaultGeoKeyword}
          businessName={
            listing?.name || savedListing?.businessName || ctx?.businessName || activeProject?.name || ""
          }
          hasListing={Boolean(placeId)}
          centerLat={centerLat}
          centerLng={centerLng}
          yourReviewCount={listing?.userRatingCount ?? savedListing?.reviewCount ?? null}
          yourRating={listing?.rating ?? savedListing?.rating ?? null}
          onConnectClick={() => {
            setTab("overview");
            setShowConnectForm(true);
          }}
        />
      )}

      {/* ── TAB 3: REVIEWS ── */}
      {tab === "reviews" && (
        <ReviewQrKit
          businessName={listing?.name || ctx?.businessName || activeProject?.name || "Your Business"}
          domain={ctx?.domain ?? null}
          reviewUrl={
            profile?.links.reviewUrl ??
            (placeId
              ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
              : null)
          }
          manageProfileUrl={manageProfileUrl}
          reviews={listing?.reviews ?? []}
          copilot={copilotPack}
          onGenerateCopilot={() => generateCopilot.mutate(false)}
          generatingCopilot={generateCopilot.isPending}
        />
      )}

      {/* ── TAB 4: LISTINGS & POSTS (Directories + Google Updates) ── */}
      {tab === "growth" && (
        <div className="space-y-4">
          {/* Clean 2-Way Inner Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-surface-1 p-1">
              <button
                type="button"
                onClick={() => setGrowthSection("directories")}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer",
                  growthSection === "directories"
                    ? "bg-signal-400 text-signal-ink font-bold"
                    : "text-brand-600 hover:text-brand-950",
                )}
              >
                Directories{" "}
                {citations ? `(${citations.summary.coveredCount}/${citations.summary.totalDirectories})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setGrowthSection("posts")}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer",
                  growthSection === "posts"
                    ? "bg-signal-400 text-signal-ink font-bold"
                    : "text-brand-600 hover:text-brand-950",
                )}
              >
                Google Posts &amp; Bio
              </button>
            </div>

            {growthSection === "directories" && citations && (
              <ActionButton
                variant="secondary"
                onClick={() => copyText(citations.canonicalNap.formattedBlock, "nap-block")}
                icon={copiedKey === "nap-block" ? <Check size={12} /> : <Copy size={12} />}
              >
                {copiedKey === "nap-block" ? "Copied Business Details" : "Copy Business Details"}
              </ActionButton>
            )}

            {growthSection === "posts" && (
              <ActionButton
                variant="primary"
                disabled={generateCopilot.isPending}
                onClick={() => generateCopilot.mutate(Boolean(copilotPack))}
                icon={
                  generateCopilot.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )
                }
              >
                {generateCopilot.isPending
                  ? "Generating..."
                  : copilotPack
                    ? "Regenerate Updates"
                    : "Generate Google Updates"}
              </ActionButton>
            )}
          </div>

          {/* SECTION A: DIRECTORIES CHECKLIST */}
          {growthSection === "directories" && (
            citations ? (
              <div className="rounded-2xl border border-brand-200 bg-surface-1 shadow-2xs overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-5 py-3.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-brand-950">Where you’re listed</span>
                    <span className="text-brand-400">·</span>
                    <span className="text-brand-500">
                      Use the exact same name, address, and phone on every site.
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11.5px]">
                    {(
                      [
                        { id: "missing", label: `Missing (${citations.summary.missingCount})` },
                        { id: "listed", label: `Listed (${citations.summary.coveredCount})` },
                        { id: "all", label: `All (${citations.summary.totalDirectories})` },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setDirFilter(f.id)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 font-medium transition cursor-pointer",
                          dirFilter === f.id
                            ? "bg-brand-100 text-brand-950 font-semibold"
                            : "text-brand-500 hover:text-brand-950",
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-brand-100">
                  {filteredDirectories.length === 0 ? (
                    <div className="px-5 py-8 text-center text-xs text-brand-500">
                      {dirFilter === "missing"
                        ? "You’re listed on all tracked directories."
                        : "No directories match this filter."}
                    </div>
                  ) : (
                    filteredDirectories.map((dir) => {
                      const isListed = dir.status !== "NOT_DETECTED";
                      return (
                        <div
                          key={dir.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-semibold text-brand-950">
                                {dir.name}
                              </span>
                              <span className="font-mono text-[11px] text-brand-400">
                                {dir.domain}
                              </span>
                              {dir.priority === "HIGH" && !isListed && (
                                <Pill tone="warn">Important</Pill>
                              )}
                              <Pill tone={isListed ? "good" : "default"}>
                                {isListed ? "Listed" : "Not listed"}
                              </Pill>
                            </div>
                          </div>
                          <a
                            href={dir.submitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                              isListed
                                ? "border border-brand-200 text-brand-700 hover:bg-brand-100/70"
                                : "bg-signal-400 text-signal-ink font-bold hover:bg-signal-500 shadow-2xs",
                            )}
                          >
                            <span>{isListed ? "Manage" : "List Now"}</span>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-brand-200 bg-surface-1 p-6 text-xs text-brand-500">
                Checking your directory listings…
              </div>
            )
          )}

          {/* SECTION B: GOOGLE POSTS, BIO & Q&A (Segmented, zero wall of text) */}
          {growthSection === "posts" && (
            !copilotPack ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-200 bg-surface-1 px-6 py-12 text-center">
                <Sparkles className="h-6 w-6 text-brand-400" />
                <h2 className="mt-3 text-sm font-semibold text-brand-950">
                  Ready-to-post Google updates
                </h2>
                <p className="mt-1 max-w-md text-xs text-brand-500">
                  Generate weekly Google Business posts, a clean business bio, category picks, and Q&amp;As tailored to your business — copy and paste in seconds.
                </p>
                <ActionButton
                  variant="primary"
                  className="mt-4"
                  disabled={generateCopilot.isPending}
                  onClick={() => generateCopilot.mutate(false)}
                  icon={
                    generateCopilot.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )
                  }
                >
                  {generateCopilot.isPending ? "Generating..." : "Generate Google Updates"}
                </ActionButton>
              </div>
            ) : copilotPack.status === "ERROR" ? (
              <StatusNote tone="bad">
                {copilotPack.error || "Could not generate Google updates right now."}
              </StatusNote>
            ) : (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-surface-1 p-1 text-xs">
                  {(
                    [
                      { id: "posts", label: `Weekly Posts (${copilotPack.weeklyPosts.length})` },
                      { id: "bio", label: "Bio & Categories" },
                      { id: "qna", label: `Q&A (${copilotPack.qnaPairs.length})` },
                    ] as const
                  ).map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setPostSection(sec.id)}
                      className={cn(
                        "rounded-lg px-3 py-1 font-semibold transition cursor-pointer",
                        postSection === sec.id
                          ? "bg-brand-100 text-brand-950"
                          : "text-brand-500 hover:text-brand-950",
                      )}
                    >
                      {sec.label}
                    </button>
                  ))}
                </div>

                {postSection === "posts" && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {copilotPack.weeklyPosts.map((post, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Pill tone={post.postType === "OFFER" ? "good" : "info"}>
                              {post.postType}
                            </Pill>
                            <p className="text-[13px] font-semibold text-brand-950">{post.title}</p>
                          </div>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-brand-700">
                            {post.body}
                          </p>
                          {post.photoTip && (
                            <p className="text-[11px] text-brand-500">
                              <strong className="text-brand-700">Photo idea:</strong> {post.photoTip}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 pt-3">
                          <ActionButton
                            variant="secondary"
                            onClick={() =>
                              copyText(`${post.body}\n\n${post.ctaLabel}: ${post.ctaUrl}`, `post-${idx}`)
                            }
                            icon={copiedKey === `post-${idx}` ? <Check size={11} /> : <Copy size={11} />}
                          >
                            {copiedKey === `post-${idx}` ? "Copied" : "Copy Post"}
                          </ActionButton>
                          <a
                            href={copilotPack.manageProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 shadow-2xs"
                          >
                            <span>Post on Google</span>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {postSection === "bio" && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-8 rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-brand-950">Business Description</h3>
                          <p className="text-[11px] font-mono text-brand-400">
                            {copilotPack.businessDescription.length} / 750 characters
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ActionButton
                            variant="secondary"
                            onClick={() => copyText(copilotPack.businessDescription, "gbp-desc")}
                            icon={copiedKey === "gbp-desc" ? <Check size={11} /> : <Copy size={11} />}
                          >
                            {copiedKey === "gbp-desc" ? "Copied" : "Copy"}
                          </ActionButton>
                          <a
                            href={copilotPack.manageProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 shadow-2xs"
                          >
                            <span>Edit on Google</span>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>
                      <p className="text-[13px] leading-relaxed text-brand-800">
                        {copilotPack.businessDescription}
                      </p>
                    </div>

                    <div className="lg:col-span-4 rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs space-y-2.5">
                      <h3 className="text-sm font-semibold text-brand-950">Suggested Categories</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {copilotPack.categorySuggestions.map((cat) => (
                          <Pill key={cat} tone="info">
                            {cat}
                          </Pill>
                        ))}
                      </div>
                      <p className="text-xs text-brand-500">
                        Set the first match as your primary Google category and add the rest as secondary categories.
                      </p>
                    </div>
                  </div>
                )}

                {postSection === "qna" && (
                  <div className="divide-y divide-brand-100 rounded-2xl border border-brand-200 bg-surface-1 shadow-2xs">
                    {copilotPack.qnaPairs.map((qa, idx) => (
                      <div key={idx} className="p-4 space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[13px] font-semibold text-brand-950">{qa.question}</p>
                          <button
                            type="button"
                            onClick={() => copyText(`Q: ${qa.question}\nA: ${qa.answer}`, `qna-${idx}`)}
                            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100/70 cursor-pointer"
                          >
                            {copiedKey === `qna-${idx}` ? (
                              <Check size={11} className="text-success-600" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span>{copiedKey === `qna-${idx}` ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed text-brand-600">{qa.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
