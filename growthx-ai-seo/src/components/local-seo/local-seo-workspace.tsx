"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  MapPin,
  Phone,
  QrCode,
  Radar,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import { ActionButton, Panel, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import type { LocalCopilotPack } from "@/lib/api-types";
import { GeoGridPanel } from "./geo-grid-panel";
import { ReviewQrKit } from "./review-qr-kit";

type LocalTab = "overview" | "grid" | "reviews" | "copilot" | "citations";

export function LocalSeoWorkspace() {
  const { projectId, projects } = useWorkspace();
  const activeProject = projects.find((p) => p.id === projectId) ?? null;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<LocalTab>("overview");
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

  const citationsQuery = useQuery({
    queryKey: ["local-citations-audit", projectId],
    queryFn: () => api.getLocalCitationsAudit(projectId!),
    enabled: Boolean(projectId),
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
    onSuccess: () => {
      setShowConnectForm(false);
      queryClient.invalidateQueries({ queryKey: ["local-profile-audit", projectId] });
      queryClient.invalidateQueries({ queryKey: ["local-citations-audit", projectId] });
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
      // Clipboard API unavailable
    }
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <StatusNote tone="warn">Select a project in the top bar to open Local &amp; Maps Off-Page SEO.</StatusNote>
      </div>
    );
  }

  const profile = profileQuery.data;
  const citations = citationsQuery.data;
  const listing = profile?.listing ?? null;
  const audit = profile?.audit ?? null;
  const ctx = profile?.businessContext ?? null;
  const effectiveSearchInput = searchQuery || profile?.suggestedQuery || activeProject?.name || "";
  const defaultGeoKeyword = ctx?.offerings?.[0] || listing?.primaryTypeDisplayName || ctx?.industry || "";

  const tabs: { id: LocalTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: "overview",
      label: "Maps Profile & Audit",
      icon: <MapPin size={13} />,
      badge: audit ? `${audit.score}/100` : undefined,
    },
    { id: "grid", label: "Maps Rivals & Geo-Grid", icon: <Radar size={13} /> },
    {
      id: "reviews",
      label: "Review Growth Kit",
      icon: <QrCode size={13} />,
      badge: listing?.userRatingCount != null ? String(listing.userRatingCount) : undefined,
    },
    { id: "copilot", label: "GBP Post & Profile Co-Pilot", icon: <Sparkles size={13} /> },
    {
      id: "citations",
      label: "Local Citations & Directories",
      icon: <Link2 size={13} />,
      badge: citations ? `${citations.summary.coveredCount}/${citations.summary.totalDirectories}` : undefined,
    },
  ];

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-950">Local &amp; Google Maps Off-Page SEO</h1>
          <p className="mt-0.5 text-[13px] text-brand-500">
            Strengthen local off-page authority alongside Backlink Intelligence — Google Maps audit, neighborhood Geo-Grid ranks, review QR kit, copy-ready GBP updates, and directory citations.
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
              {refreshProfile.isPending ? "Syncing..." : "Sync Maps"}
            </ActionButton>
          )}
          <ActionButton
            variant="secondary"
            onClick={() => setShowConnectForm((prev) => !prev)}
            icon={<Search size={12} />}
          >
            {profile?.placeId ? "Switch Listing" : "Connect Google Maps"}
          </ActionButton>
          <a
            href={profile?.links.manageProfileUrl || "https://www.google.com/search?q=my+business"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-primary-700 transition"
          >
            <span>Open My Google Profile</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Places API notice if key missing */}
      {profile?.state === "NOT_CONFIGURED" && (
        <StatusNote tone="warn">
          <strong>Google Maps live sync needs GOOGLE_PLACES_API_KEY:</strong> Enable <strong>Places API (New)</strong> in Google Cloud Console (instant activation, no Google Business Profile approval required) and add <code>GOOGLE_PLACES_API_KEY</code> to your backend <code>.env</code>. You can still use <strong>GBP Co-Pilot</strong> and <strong>Local Citations &amp; Directories</strong> immediately below.
        </StatusNote>
      )}

      {/* Connect / Switch Google Maps Listing Drawer */}
      {(showConnectForm || profile?.state === "NO_PLACE") && profile?.state !== "NOT_CONFIGURED" && (
        <Panel
          title="Connect Your Google Maps Listing"
          subtitle="Powered by Google Places API (New) — instant public sync with zero GBP OAuth rejection"
          padded
        >
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={effectiveSearchInput}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter business name and city..."
              className="min-w-[260px] flex-1 rounded-lg border border-brand-200 bg-surface-0 px-3 py-2 text-[13px] text-brand-950 focus:border-accent-500 focus:outline-none"
            />
            <ActionButton
              variant="primary"
              disabled={!effectiveSearchInput.trim() || searchMaps.isPending}
              onClick={() => searchMaps.mutate(effectiveSearchInput.trim())}
              icon={searchMaps.isPending ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            >
              {searchMaps.isPending ? "Searching..." : "Search Google Maps"}
            </ActionButton>
          </div>

          {searchMaps.isError && (
            <div className="mt-3">
              <StatusNote tone="bad">
                {searchMaps.error instanceof Error ? searchMaps.error.message : "Search failed."}
              </StatusNote>
            </div>
          )}

          {(searchMaps.data?.length ?? 0) > 0 && (
            <div className="mt-3 divide-y divide-brand-100 rounded-xl border border-brand-200">
              {searchMaps.data!.map((item) => (
                <div key={item.placeId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-[13px] font-bold text-brand-950">{item.name}</p>
                    <p className="text-[11.5px] text-brand-500">{item.address}</p>
                    <p className="mt-0.5 text-[11px] font-mono text-brand-600">
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
        </Panel>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-brand-200 pb-2">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition cursor-pointer ${
                active
                  ? "bg-primary-600 text-white"
                  : "bg-brand-50 text-brand-700 hover:bg-brand-100"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                    active ? "bg-surface-0/20 text-white" : "bg-brand-200/80 text-brand-800"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & HEALTH AUDIT */}
      {tab === "overview" && (
        <div className="space-y-4">
          {listing && audit ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-brand-200 bg-surface-0 p-4">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                    Local Profile Score
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-brand-950">{audit.score}/100</p>
                  <p className="mt-0.5 text-[11px] text-brand-500">
                    {audit.passedCount} of {audit.totalChecks} checks passing
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-surface-0 p-4">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                    Google Rating
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-brand-950 flex items-center gap-1">
                    {listing.rating != null ? listing.rating.toFixed(1) : "—"}
                    <Star size={16} className="text-warning-600" />
                  </p>
                  <p className="mt-0.5 text-[11px] text-brand-500">
                    {listing.userRatingCount != null ? `${listing.userRatingCount.toLocaleString()} reviews` : "No reviews"}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-surface-0 p-4">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                    Public Photos
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-brand-950">{listing.photos.length}</p>
                  <p className="mt-0.5 text-[11px] text-brand-500">
                    {listing.photos.length >= 8 ? "Strong visual gallery" : "Target 10+ authentic photos"}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-surface-0 p-4">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                    Local Citations
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-brand-950">
                    {citations ? `${citations.summary.coveredCount}/${citations.summary.totalDirectories}` : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-brand-500">
                    {citations ? `${citations.summary.highPriorityMissing} high-priority missing` : "Checking directories"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-5 space-y-4">
                  <Panel
                    title={listing.name || "Connected Google Maps Listing"}
                    subtitle={profile?.fetchedAt ? `Last synced ${relativeTime(profile.fetchedAt)}` : undefined}
                    padded
                  >
                    <div className="space-y-2.5 text-[12.5px]">
                      {listing.address && (
                        <p className="flex items-start gap-2 text-brand-700">
                          <MapPin size={14} className="mt-0.5 shrink-0 text-accent-600" />
                          <span>{listing.address}</span>
                        </p>
                      )}
                      {(listing.phone || listing.internationalPhone) && (
                        <p className="flex items-center gap-2 text-brand-700">
                          <Phone size={14} className="shrink-0 text-accent-600" />
                          <span>{listing.phone || listing.internationalPhone}</span>
                        </p>
                      )}
                      {listing.website && (
                        <p className="flex items-center gap-2 text-brand-700 break-all">
                          <Globe size={14} className="shrink-0 text-accent-600" />
                          <a href={listing.website} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">
                            {listing.website}
                          </a>
                        </p>
                      )}
                      {listing.primaryTypeDisplayName && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <Pill tone="info">{listing.primaryTypeDisplayName}</Pill>
                          {listing.types
                            .filter((t) => t.type !== listing.primaryType)
                            .slice(0, 4)
                            .map((t) => (
                              <Pill key={t.type} tone="default">{t.displayName}</Pill>
                            ))}
                        </div>
                      )}
                      {listing.hours?.weekdayDescriptions?.length ? (
                        <div className="border-t border-brand-200/70 pt-2.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-400">
                            <Clock size={12} /> Opening Hours
                          </p>
                          <ul className="mt-1 space-y-0.5 text-[11.5px] text-brand-600">
                            {listing.hours.weekdayDescriptions.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {profile?.links.utmWebsiteUrl && (
                        <div className="border-t border-brand-200/70 pt-2.5 space-y-1.5">
                          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">
                            Recommended UTM Website URL for GBP
                          </p>
                          <p className="break-all rounded-lg bg-brand-50 p-2 font-mono text-[11px] text-brand-900">
                            {profile.links.utmWebsiteUrl}
                          </p>
                          <ActionButton
                            variant="secondary"
                            onClick={() => copyText(profile.links.utmWebsiteUrl!, "utm-url")}
                            icon={copiedKey === "utm-url" ? <Check size={11} /> : <Copy size={11} />}
                          >
                            {copiedKey === "utm-url" ? "Copied UTM URL" : "Copy UTM Link for GBP"}
                          </ActionButton>
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>

                <div className="lg:col-span-7">
                  <Panel
                    title="8-Point Google Maps Off-Page Health Audit"
                    subtitle="Every check comes strictly from your live Google Maps snapshot — fix WARN and FAIL items directly in Google Business Profile"
                    padded
                  >
                    <div className="space-y-2.5">
                      {audit.checks.map((c) => (
                        <div key={c.id} className="rounded-xl border border-brand-200 p-3 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {c.status === "PASS" ? (
                                <CheckCircle2 size={14} className="text-success-600 shrink-0" />
                              ) : c.status === "WARN" ? (
                                <AlertTriangle size={14} className="text-warning-600 shrink-0" />
                              ) : (
                                <XCircle size={14} className="text-error-600 shrink-0" />
                              )}
                              <span className="text-[12.5px] font-bold text-brand-950">{c.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-brand-600">{c.value}</span>
                              <Pill tone={c.status === "PASS" ? "good" : c.status === "WARN" ? "warn" : "bad"}>
                                {c.status}
                              </Pill>
                            </div>
                          </div>
                          <p className="pl-5 text-[11.5px] text-brand-600">{c.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            </>
          ) : (
            <Panel title="Google Maps Listing Not Connected Yet" padded>
              <p className="text-[13px] text-brand-600">
                Use the search box above to connect your public Google Maps listing (or explore the <strong>GBP Post &amp; Profile Co-Pilot</strong> and <strong>Local Citations &amp; Directories</strong> tabs right now — both work immediately using your crawled website &amp; Backlink Intelligence data).
              </p>
            </Panel>
          )}
        </div>
      )}

      {/* TAB 2: MAPS RIVALS & GEO-GRID */}
      {tab === "grid" && (
        <GeoGridPanel
          projectId={projectId}
          defaultKeyword={defaultGeoKeyword}
          businessName={listing?.name || ctx?.businessName || activeProject?.name || ""}
          hasListing={Boolean(profile?.placeId)}
        />
      )}

      {/* TAB 3: REVIEW GROWTH KIT */}
      {tab === "reviews" && (
        <ReviewQrKit
          businessName={listing?.name || ctx?.businessName || activeProject?.name || "Your Business"}
          domain={ctx?.domain ?? null}
          reviewUrl={profile?.links.reviewUrl ?? null}
          manageProfileUrl={profile?.links.manageProfileUrl || "https://www.google.com/search?q=my+business"}
          reviews={listing?.reviews ?? []}
          copilot={copilotPack}
          onGenerateCopilot={() => generateCopilot.mutate(false)}
          generatingCopilot={generateCopilot.isPending}
        />
      )}

      {/* TAB 4: GBP POST & PROFILE CO-PILOT */}
      {tab === "copilot" && (
        <div className="space-y-4">
          <Panel
            title="AI Google Business Profile Co-Pilot (Copy & Open in Google)"
            subtitle="Ready-to-publish weekly posts (with GA4 UTMs), 750-char description, category checklist, and local Q&As — zero Google API rejection or account suspension risk"
            actions={
              <ActionButton
                variant="primary"
                disabled={generateCopilot.isPending}
                onClick={() => generateCopilot.mutate(Boolean(copilotPack))}
                icon={generateCopilot.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              >
                {generateCopilot.isPending
                  ? "Generating..."
                  : copilotPack
                    ? "Regenerate Co-Pilot Pack"
                    : "Generate Co-Pilot Pack"}
              </ActionButton>
            }
            padded
          >
            {!copilotPack ? (
              <p className="text-[12.5px] text-brand-600">
                Click <strong>Generate Co-Pilot Pack</strong> to create tailored weekly Google Maps posts, a 750-character business description, local Q&amp;As, and review replies grounded in your real products, neighborhoods, and Maps listing.
              </p>
            ) : copilotPack.status === "ERROR" ? (
              <StatusNote tone="bad">{copilotPack.error || "Could not generate Co-Pilot pack."}</StatusNote>
            ) : (
              <div className="space-y-5">
                {/* Description & Categories */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-8 rounded-xl border border-brand-200 p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-brand-950">Optimized Google Business Description</p>
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
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1 text-[11px] font-semibold text-accent-700 hover:bg-brand-50"
                        >
                          <span>Paste in GBP</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-brand-800">{copilotPack.businessDescription}</p>
                    <p className="text-[11px] font-mono text-brand-400">
                      {copilotPack.businessDescription.length} / 750 characters
                    </p>
                  </div>

                  <div className="lg:col-span-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4 space-y-2">
                    <p className="text-[12.5px] font-bold text-brand-950">Recommended GBP Categories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {copilotPack.categorySuggestions.map((cat) => (
                        <Pill key={cat} tone="info">{cat}</Pill>
                      ))}
                    </div>
                    <p className="text-[11px] text-brand-500">
                      In Google Business Profile → Edit Profile → Business Category, add your #1 match as Primary and the rest as Additional categories.
                    </p>
                  </div>
                </div>

                {/* Weekly Posts */}
                {copilotPack.weeklyPosts.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-[11.5px] font-semibold uppercase tracking-wider text-brand-400">
                      Weekly Google Business Profile Posts (UTM Tracked)
                    </p>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {copilotPack.weeklyPosts.map((post, idx) => (
                        <div key={idx} className="rounded-xl border border-brand-200 p-4 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Pill tone={post.postType === "OFFER" ? "good" : "info"}>{post.postType}</Pill>
                              <p className="text-[13px] font-bold text-brand-950">{post.title}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => copyText(`${post.body}\n\n${post.ctaLabel}: ${post.ctaUrl}`, `post-${idx}`)}
                                className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-900 hover:bg-brand-100 cursor-pointer"
                              >
                                {copiedKey === `post-${idx}` ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                                <span>{copiedKey === `post-${idx}` ? "Copied" : "Copy Post"}</span>
                              </button>
                              <a
                                href={copilotPack.manageProfileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-brand-200 px-2 py-1 text-[11px] font-semibold text-accent-700 hover:bg-brand-50"
                              >
                                <span>Post on Google</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-brand-800">{post.body}</p>
                          <p className="break-all font-mono text-[11px] text-accent-700">
                            Button ({post.ctaLabel}): {post.ctaUrl}
                          </p>
                          {post.photoTip && (
                            <p className="text-[11px] text-brand-500">
                              <strong className="text-brand-800">Photo tip:</strong> {post.photoTip}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Q&A Pairs */}
                {copilotPack.qnaPairs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11.5px] font-semibold uppercase tracking-wider text-brand-400">
                      Local Q&amp;A Pairs to Seed on Your Google Maps Profile
                    </p>
                    <div className="space-y-2">
                      {copilotPack.qnaPairs.map((qa, idx) => (
                        <div key={idx} className="rounded-xl border border-brand-200 p-3.5 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[12.5px] font-bold text-brand-950">Q: {qa.question}</p>
                            <button
                              type="button"
                              onClick={() => copyText(`Q: ${qa.question}\nA: ${qa.answer}`, `qna-${idx}`)}
                              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-900 hover:bg-brand-100 cursor-pointer"
                            >
                              {copiedKey === `qna-${idx}` ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                              <span>{copiedKey === `qna-${idx}` ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                          <p className="text-[12px] text-brand-700">A: {qa.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* TAB 5: LOCAL CITATIONS & DIRECTORIES */}
      {tab === "citations" && citations && (
        <div className="space-y-4">
          <Panel
            title="Canonical NAP Block (Name · Address · Phone · Website)"
            subtitle={`Detected market: ${citations.market} · Paste this exact information identically across every local directory to maximize Google Maps & AI entity trust`}
            actions={
              <ActionButton
                variant="secondary"
                onClick={() => copyText(citations.canonicalNap.formattedBlock, "nap-block")}
                icon={copiedKey === "nap-block" ? <Check size={12} /> : <Copy size={12} />}
              >
                {copiedKey === "nap-block" ? "Copied NAP" : "Copy Canonical NAP"}
              </ActionButton>
            }
            padded
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <pre className="lg:col-span-7 whitespace-pre-wrap rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 font-mono text-[12px] leading-relaxed text-brand-950">
                {citations.canonicalNap.formattedBlock}
              </pre>
              <div className="lg:col-span-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-brand-200 p-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">Detected / Connected</p>
                  <p className="mt-1 font-mono text-xl font-bold text-success-700">{citations.summary.coveredCount}</p>
                  <p className="text-[11px] text-brand-500">of {citations.summary.totalDirectories} directories</p>
                </div>
                <div className="rounded-xl border border-brand-200 p-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">High-Priority Gaps</p>
                  <p className="mt-1 font-mono text-xl font-bold text-warning-700">{citations.summary.highPriorityMissing}</p>
                  <p className="text-[11px] text-brand-500">
                    Scanned {citations.summary.backlinkSourcesScanned} backlinks
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Local Off-Page Directory & Citation Matrix"
            subtitle="Cross-referenced against your Backlink Intelligence referring domains — claim missing high-priority directories to build local authority & AI citations"
            padded
          >
            <div className="divide-y divide-brand-100">
              {citations.directories.map((dir) => (
                <div key={dir.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-[260px] flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 size={13} className="text-accent-600" />
                      <p className="text-[13px] font-bold text-brand-950">{dir.name}</p>
                      <span className="font-mono text-[11px] text-brand-400">{dir.domain}</span>
                      <Pill tone={dir.priority === "HIGH" ? "warn" : "default"}>{dir.priority}</Pill>
                      <Pill
                        tone={
                          dir.status === "CONNECTED" || dir.status === "DETECTED_IN_BACKLINKS"
                            ? "good"
                            : "default"
                        }
                      >
                        {dir.status === "CONNECTED"
                          ? "Connected"
                          : dir.status === "DETECTED_IN_BACKLINKS"
                            ? "Detected in Backlinks"
                            : "Not Detected"}
                      </Pill>
                    </div>
                    <p className="text-[11.5px] text-brand-600">{dir.whyItMatters}</p>
                    {dir.detectedUrl && (
                      <p className="text-[11px] font-mono text-accent-700 truncate">{dir.detectedUrl}</p>
                    )}
                  </div>
                  <a
                    href={dir.submitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-0 px-3 py-1.5 text-[11.5px] font-semibold text-brand-900 hover:bg-brand-50"
                  >
                    <span>{dir.status === "NOT_DETECTED" ? "Claim / List Here" : "Manage Listing"}</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
