"use client";

import React from "react";
import {
  Star,
  Eye,
  PhoneCall,
  Navigation,
  Globe,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Sparkles,
  Info,
  ChevronRight,
  BadgeCheck,
  HelpCircle,
  Clock,
  Edit3,
} from "lucide-react";
import type { GbpTabKey } from "../gbp-tabs";
import { GbpTabGate, GbpStatePanel, formatGbpTimestamp, metricValue } from "../gbp-states";
import { useGbpMetrics, useGbpOverview, useGbpReviews } from "@/hooks/use-growthx";
import type { GbpFixProposal, GbpOverview, LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { GoogleGLogo } from "../gbp-icons";

interface OverviewTabProps {
  projectId: string | null;
  /** Only used for the locally tracked keyword rankings, which are not a Google source. */
  localSeo: LocalSeoData | null | undefined;
  proposals: GbpFixProposal[];
  onSelectTab: (tab: GbpTabKey) => void;
  onConnect?: () => void;
  onEditManual?: () => void;
  onChooseLocation?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

/** Human labels for the completeness fields the backend reports by key. */
const FIELD_LABELS: Record<string, string> = {
  title: "Business name",
  address: "Address",
  phone: "Phone number",
  website: "Website",
  description: "Business description",
  primaryCategory: "Primary category",
  additionalCategories: "Additional categories",
  regularHours: "Business hours",
  serviceItems: "Services",
};

export function OverviewTab({
  projectId,
  localSeo,
  proposals,
  onSelectTab,
  onConnect,
  onEditManual,
  onChooseLocation,
  onSync,
  isSyncing,
}: OverviewTabProps) {
  const query = useGbpOverview(projectId);

  // When a local listing is tracked (via manual entry or Places search) but Google OAuth
  // has not been connected yet, show the tracked listing overview rather than a blank gate.
  const isGoogleConnected = query.data?.connection && query.data.connection.state !== "NOT_CONNECTED";
  if (!isGoogleConnected && localSeo && localSeo.businessName) {
    return (
      <LocalTrackedOverview
        localSeo={localSeo}
        proposals={proposals}
        onSelectTab={onSelectTab}
        onConnect={onConnect}
        onEditManual={onEditManual}
      />
    );
  }

  return (
    <GbpTabGate
      query={query}
      label="Overview"
      onConnect={onConnect}
      onChooseLocation={onChooseLocation}
      onSync={onSync}
      isSyncing={isSyncing}
    >
      {(data) => (
        <OverviewContent
          data={data}
          projectId={projectId}
          localSeo={localSeo}
          proposals={proposals}
          onSelectTab={onSelectTab}
          onSync={onSync}
          isSyncing={isSyncing}
        />
      )}
    </GbpTabGate>
  );
}

function LocalTrackedOverview({
  localSeo,
  proposals,
  onSelectTab,
  onConnect,
  onEditManual,
}: {
  localSeo: LocalSeoData;
  proposals: GbpFixProposal[];
  onSelectTab: (tab: GbpTabKey) => void;
  onConnect?: () => void;
  onEditManual?: () => void;
}) {
  const pendingProposals = proposals.filter((p) => p.status === "PENDING");
  const rankings = localSeo.rankings ?? [];

  return (
    <div className="space-y-6">
      {/* ── Identity + Tracked Details ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div
          className="lg:col-span-7 rounded-2xl border bg-white p-5 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-brand-950 truncate">
                  {localSeo.businessName}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700 border border-success-200">
                  <BadgeCheck size={11} /> Tracked Listing
                </span>
              </div>
              <p className="mt-1 text-xs text-brand-500 flex items-center gap-1">
                <MapPin size={12} className="shrink-0 text-brand-400" />
                <span>{localSeo.address}</span>
              </p>
            </div>
            <div className="flex items-center gap-1 bg-warning-50 border border-warning-200 px-2.5 py-1 rounded-lg shrink-0">
              <Star size={14} className="fill-warning-500 text-warning-500" />
              <span className="text-sm font-bold text-warning-700">
                {localSeo.rating > 0 ? localSeo.rating.toFixed(1) : "—"}
              </span>
              <span className="text-xs text-warning-600">({localSeo.reviewCount})</span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-brand-100 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[11px] text-brand-400 block">Total Reviews</span>
                <span className="text-sm font-bold text-brand-950">{localSeo.reviewCount}</span>
              </div>
              <div className="h-6 w-px bg-brand-100" />
              <div>
                <span className="text-[11px] text-brand-400 block">Average Rating</span>
                <span className="text-sm font-bold text-brand-950">
                  {localSeo.rating > 0 ? `${localSeo.rating.toFixed(1)} / 5.0` : "Not set"}
                </span>
              </div>
              <div className="h-6 w-px bg-brand-100" />
              <div>
                <span className="text-[11px] text-brand-400 block">Citations Found</span>
                <span className="text-sm font-bold text-brand-950">{localSeo.citationsCount || 0}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onEditManual && (
                <button
                  type="button"
                  onClick={onEditManual}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border bg-white text-brand-700 text-xs font-semibold hover:bg-brand-50 transition"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <Edit3 size={12} className="text-brand-500" />
                  <span>Edit Details</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectTab("rankings")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition"
              >
                <span>Scan Geo-Grid</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Sync with Google prompt banner */}
        <div
          className="lg:col-span-5 rounded-2xl border bg-brand-50/70 p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-white border border-brand-200 flex items-center justify-center shadow-xs">
                <GoogleGLogo size={14} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
                Connect Google Account (Optional)
              </h3>
            </div>
            <p className="text-xs text-brand-600 leading-relaxed">
              To pull private merchant analytics directly from Google — such as Search impressions, customer calls, direction requests, photos, and direct post publishing — connect your Google Business Profile manager account.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-200/60 flex items-center justify-between">
            <span className="text-[11px] text-brand-500">OAuth API Integration</span>
            <button
              type="button"
              onClick={onConnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-brand-200 text-brand-950 text-xs font-semibold hover:bg-brand-50 shadow-xs transition"
            >
              <GoogleGLogo size={12} />
              <span>Connect with Google</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Feature Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Geo Grid Rank Tracker */}
        <div
          onClick={() => onSelectTab("rankings")}
          className="rounded-xl border bg-white p-4 shadow-xs hover:border-brand-300 transition cursor-pointer flex flex-col justify-between group"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="w-8 h-8 rounded-lg bg-success-50 text-success-700 flex items-center justify-center mb-3">
              <Navigation size={16} />
            </div>
            <h4 className="text-sm font-bold text-brand-950 group-hover:text-accent-600 transition">
              Local Rankings & Geo-Grid
            </h4>
            <p className="text-xs text-brand-500 mt-1 leading-relaxed">
              Track local search positions across a map grid for key terms around your location.
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-brand-100 flex items-center justify-between text-xs text-brand-600 font-semibold">
            <span>{rankings.length > 0 ? `${rankings.length} tracked terms` : "Run grid scan"}</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Profile Audit */}
        <div
          onClick={() => onSelectTab("audit")}
          className="rounded-xl border bg-white p-4 shadow-xs hover:border-brand-300 transition cursor-pointer flex flex-col justify-between group"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="w-8 h-8 rounded-lg bg-accent-50 text-accent-700 flex items-center justify-center mb-3">
              <CheckCircle2 size={16} />
            </div>
            <h4 className="text-sm font-bold text-brand-950 group-hover:text-accent-600 transition">
              Profile Audit & Fixes
            </h4>
            <p className="text-xs text-brand-500 mt-1 leading-relaxed">
              Audit profile consistency, NAP accuracy, and high-impact local SEO optimizations.
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-brand-100 flex items-center justify-between text-xs text-brand-600 font-semibold">
            <span>{pendingProposals.length} suggestions</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Competitors */}
        <div
          onClick={() => onSelectTab("competitors")}
          className="rounded-xl border bg-white p-4 shadow-xs hover:border-brand-300 transition cursor-pointer flex flex-col justify-between group"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-800 flex items-center justify-center mb-3">
              <Eye size={16} />
            </div>
            <h4 className="text-sm font-bold text-brand-950 group-hover:text-accent-600 transition">
              Local Competitor Intelligence
            </h4>
            <p className="text-xs text-brand-500 mt-1 leading-relaxed">
              Benchmark rating, review velocity, and citations against local competitors in your category.
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-brand-100 flex items-center justify-between text-xs text-brand-600 font-semibold">
            <span>View competitors</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewContent({
  data,
  projectId,
  localSeo,
  proposals,
  onSelectTab,
  onSync,
  isSyncing,
}: {
  data: GbpOverview;
  projectId: string | null;
  localSeo: LocalSeoData | null | undefined;
  proposals: GbpFixProposal[];
  onSelectTab: (tab: GbpTabKey) => void;
  onSync?: () => void;
  isSyncing?: boolean;
}) {
  const metricsQuery = useGbpMetrics(projectId, 28);
  const reviewsQuery = useGbpReviews(projectId);

  const profile = data.profile;
  const completeness = data.completeness;
  const metrics = metricsQuery.data;
  const totals = metrics?.totals ?? null;
  const reviews = reviewsQuery.data;

  // The profile itself could not be read. Nothing below this point has a value
  // that is safe to draw, so the source's own answer stands in for the tab.
  if (!profile) {
    return (
      <GbpStatePanel
        icon={AlertTriangle}
        tone={data.source.state === "UNAVAILABLE" ? "warning" : "info"}
        title={
          data.source.state === "UNAVAILABLE"
            ? "Google would not return this profile"
            : "This profile has not been read yet"
        }
        detail={data.source.message}
        body={
          data.source.state === "UNAVAILABLE" ? (
            <>
              The last sync asked Google for this location&apos;s profile and was refused, so there is
              nothing to show. This is a Google-side answer, not an empty listing.
            </>
          ) : (
            <>No sync has stored a profile for this location yet.</>
          )
        }
        action={onSync ? { label: "Sync now", onClick: onSync, pending: isSyncing } : undefined}
      />
    );
  }

  const missingFields = (completeness?.fields ?? []).filter((field) => !field.present);
  const rangeLabel = metrics ? `${metrics.range.from} → ${metrics.range.to}` : null;

  const metricTiles: { label: string; icon: React.ElementType; tint: string; value: number | null }[] = [
    { label: "Views", icon: Eye, tint: "text-blue-600", value: totals?.impressions ?? null },
    { label: "Calls", icon: PhoneCall, tint: "text-emerald-600", value: totals?.callClicks ?? null },
    {
      label: "Direction requests",
      icon: Navigation,
      tint: "text-slate-900",
      value: totals?.directionRequests ?? null,
    },
    { label: "Website clicks", icon: Globe, tint: "text-amber-600", value: totals?.websiteClicks ?? null },
  ];

  const activeRankings = localSeo?.rankings && localSeo.rankings.length > 0 ? localSeo.rankings : [];
  const pendingProposals = proposals.filter((proposal) => proposal.status === "PENDING");

  return (
    <div className="space-y-6">
      {/* ── Identity + completeness ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div
          className="lg:col-span-7 rounded-2xl border bg-white p-5 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-brand-950 truncate">
                {profile.businessName ?? "No business name from Google"}
              </h2>
              <p className="mt-0.5 text-xs text-brand-500 flex items-start gap-1.5">
                <MapPin size={12} className="shrink-0 mt-0.5 text-brand-400" />
                <span>{profile.address ?? "No address on this listing"}</span>
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold border",
                profile.verified === true
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : profile.verified === false
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-brand-50 text-brand-600 border-brand-200",
              )}
            >
              {profile.verified === true ? (
                <>
                  <BadgeCheck size={11} /> Verified
                </>
              ) : profile.verified === false ? (
                "Not verified"
              ) : (
                <>
                  <HelpCircle size={11} /> Verification unknown
                </>
              )}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {[
              { label: "Primary category", value: profile.primaryCategory },
              { label: "Phone", value: profile.phone },
              { label: "Website", value: profile.website },
              {
                label: "Additional categories",
                value: profile.additionalCategories.length
                  ? profile.additionalCategories
                      .map((category) => category.displayName ?? category.categoryId)
                      .filter(Boolean)
                      .join(", ")
                  : null,
              },
            ].map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                  {row.label}
                </dt>
                {/* Absent on the profile means an em dash, never a stand-in. */}
                <dd className="text-xs font-medium text-brand-800 truncate">{row.value || "—"}</dd>
              </div>
            ))}
          </dl>

          {profile.description && (
            <p className="mt-4 pt-3 border-t border-brand-100 text-xs text-brand-600 leading-relaxed line-clamp-3">
              {profile.description}
            </p>
          )}
        </div>

        {/* Profile completeness — a count of fields Google returned, not a score. */}
        <div
          className="lg:col-span-5 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-950">Profile Completeness</h3>
              <span className="font-mono text-sm font-bold text-brand-950">
                {completeness ? `${completeness.present} of ${completeness.total}` : "—"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-brand-400 leading-relaxed">
              Fields Google returned a value for on the last sync. Not a score — there is no weighting
              and no target.
            </p>

            {completeness && (
              <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2.5">
                {completeness.fields.map((field) => (
                  <div key={field.field} className="flex items-center gap-1.5 text-xs">
                    {field.present ? (
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-brand-300 shrink-0" />
                    )}
                    <span
                      className={
                        field.present
                          ? "text-brand-800 font-medium truncate"
                          : "text-brand-500 truncate"
                      }
                    >
                      {FIELD_LABELS[field.field] ?? field.field}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-brand-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onSelectTab("action-plan")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              <span>Improve Profile</span>
              <ArrowRight size={13} />
            </button>
            <span className="text-[10px] text-brand-400">
              Synced {formatGbpTimestamp(profile.syncedAt) ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Performance tiles ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-brand-950">Performance</h3>
            <Info size={13} className="text-brand-400" />
          </div>
          {/* How many days of the requested window Google actually reported — a
              28-day request answered with 11 days is a fact the tab states. */}
          {metrics && rangeLabel && (
            <span className="text-[11px] text-brand-400">
              {rangeLabel} · Google reported {metrics.coveredDays} day
              {metrics.coveredDays === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {metricsQuery.isLoading ? (
          <div
            className="rounded-2xl border bg-white p-8 shadow-xs text-center text-xs text-brand-500"
            style={{ borderColor: "var(--border-color)" }}
          >
            Loading performance figures…
          </div>
        ) : metrics?.source.state === "UNAVAILABLE" ? (
          <GbpStatePanel
            compact
            icon={AlertTriangle}
            tone="warning"
            title="Performance metrics are unavailable"
            detail={metrics.source.message}
            body={
              <>
                Google refused this project&apos;s request for this location&apos;s performance data, so
                no views, calls or direction requests can be shown. This is a refusal, not a quiet
                month.
              </>
            }
            action={onSync ? { label: "Try syncing again", onClick: onSync, pending: isSyncing } : undefined}
          />
        ) : totals == null ? (
          <GbpStatePanel
            compact
            icon={Clock}
            tone="info"
            title="No performance data in this window"
            body={
              <>
                Google reported no day in the last 28 days for this location. Nothing is shown rather
                than zeroes — a zero would say this business was seen by nobody, which is a
                measurement, and none was taken.
              </>
            }
            action={onSync ? { label: "Sync now", onClick: onSync, pending: isSyncing } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metricTiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <div
                  key={tile.label}
                  className="rounded-2xl border bg-white p-5 shadow-xs"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-brand-500">
                    <Icon size={14} className={tile.tint} />
                    <span>{tile.label}</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-brand-950">
                    {/* A metric Google never reported is an em dash, never a 0. */}
                    {metricValue(tile.value)}
                  </div>
                  <p className="text-[11px] text-brand-400 mt-0.5">Last 28 days, from Google</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Reviews, local visibility, keywords ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div
          className="lg:col-span-4 rounded-2xl border bg-white p-5 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-950">Reviews</h3>
            <button
              type="button"
              onClick={() => onSelectTab("reviews")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="mt-3 flex items-baseline gap-4">
            <div>
              <div className="text-2xl font-bold font-mono text-brand-950">
                {reviews?.summary.averageRating == null
                  ? "—"
                  : reviews.summary.averageRating.toFixed(1)}
              </div>
              <p className="text-[11px] text-brand-400">Average rating</p>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-brand-950">
                {reviews ? reviews.summary.total : "—"}
              </div>
              <p className="text-[11px] text-brand-400">Synced reviews</p>
            </div>
          </div>

          {reviews?.source.state === "UNAVAILABLE" ? (
            <p className="mt-3 pt-3 border-t border-brand-100 text-[11px] text-amber-700 leading-relaxed">
              Google will not let this project read reviews for this location, so none can be shown
              here. {reviews.source.message}
            </p>
          ) : (
            <div className="mt-3 pt-3 border-t border-brand-100 space-y-3">
              {reviews && reviews.reviews.length > 0 ? (
                reviews.reviews.slice(0, 2).map((review) => (
                  <div
                    key={review.id}
                    className="p-3 rounded-xl border border-brand-100 bg-brand-50/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-950 truncate max-w-[140px]">
                        {review.authorName}
                      </span>
                      <span className="text-[10px] text-brand-400">
                        {formatGbpTimestamp(review.updateTime ?? review.createTime) ?? "—"}
                      </span>
                    </div>
                    {review.rating != null && (
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, index) => (
                          <Star
                            key={index}
                            size={11}
                            className={
                              index < review.rating! ? "text-amber-500 fill-amber-500" : "text-brand-200"
                            }
                          />
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-brand-700 line-clamp-2">
                      {review.text || "Rating left without comment."}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-brand-400">
                  This listing has no reviews on Google yet.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Local Visibility GeoGrid preview — a separate, locally run scan. */}
        <div
          className="lg:col-span-5 rounded-2xl border bg-white p-5 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-brand-950">Local Visibility (GeoGrid)</h3>
              <Info size={13} className="text-brand-400" />
            </div>
            <button
              type="button"
              onClick={() => onSelectTab("rankings")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View Full Report</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="relative mt-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-4 min-h-[170px] flex flex-col items-center justify-center text-center gap-2">
            <MapPin size={20} className="text-brand-300" />
            <p className="text-xs text-brand-500 max-w-[240px]">
              GeoGrid is a scan GrowthX runs itself, not part of the Google sync. Run one from Local
              Rankings to see your position across nearby areas.
            </p>
            <button
              type="button"
              onClick={() => onSelectTab("rankings")}
              className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Go to Local Rankings
            </button>
          </div>
        </div>

        <div
          className="lg:col-span-3 rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-950">Top Local Keywords</h3>
              <button
                type="button"
                onClick={() => onSelectTab("rankings")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="mt-3 divide-y divide-brand-100">
              {activeRankings.length > 0 ? (
                activeRankings.slice(0, 5).map((ranking) => (
                  <div key={ranking.id} className="py-2.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-brand-800 truncate pr-2">
                      {ranking.keyword}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-xs font-bold px-2 py-0.5 rounded-full shrink-0",
                        ranking.position <= 3
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : ranking.position <= 10
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200",
                      )}
                    >
                      {ranking.position}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs text-brand-400">
                    No keywords tracked yet. Track one from Local Rankings to see its position here.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-100">
            <button
              type="button"
              onClick={() => onSelectTab("rankings")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Track New Keyword</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Missing fields + AI recommendations ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div
          className="lg:col-span-6 rounded-2xl border bg-white p-5 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-950">Fields Google returned nothing for</h3>
            <button
              type="button"
              onClick={() => onSelectTab("audit")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View Audit</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {missingFields.length > 0 ? (
              missingFields.map((field) => (
                <button
                  key={field.field}
                  type="button"
                  onClick={() => onSelectTab("action-plan")}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-brand-100 hover:bg-brand-50/70 transition text-left"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-brand-950 truncate">
                      {FIELD_LABELS[field.field] ?? field.field}
                    </p>
                    <p className="text-[11px] text-brand-500 truncate">
                      Google returned no value for this on the last sync
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-brand-400 shrink-0" />
                </button>
              ))
            ) : (
              <p className="text-xs text-brand-400 py-4 text-center">
                Google returned a value for every field on this profile.
              </p>
            )}
          </div>
        </div>

        <div
          className="lg:col-span-6 rounded-2xl border bg-white p-5 shadow-xs"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-slate-900" />
              <h3 className="text-sm font-bold text-brand-950">AI Recommendations</h3>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab("ai-recommendations")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View Plan</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <p className="mt-1 text-xs text-brand-500 leading-normal">
            {pendingProposals.length > 0
              ? "Open suggestions from your last profile analysis:"
              : "Run an AI audit to get suggestions for this profile."}
          </p>

          <div className="mt-3.5 space-y-2.5">
            {pendingProposals.length > 0 ? (
              pendingProposals.slice(0, 5).map((proposal, index) => (
                <div key={proposal.id} className="flex items-start gap-2.5 text-xs text-brand-800">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 border border-blue-200">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 leading-snug truncate">
                    {proposal.field}: {proposal.proposedValue}
                  </span>
                </div>
              ))
            ) : (
              <button
                type="button"
                onClick={() => onSelectTab("audit")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Run AI Audit →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
