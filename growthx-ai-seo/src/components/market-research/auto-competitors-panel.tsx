"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Loader2,
  TrendingUp,
  ShieldCheck,
  Zap,
  Target,
  RefreshCw,
  Plus,
  Check,
  Globe,
  MapPin,
  Building2,
  SlidersHorizontal,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  api,
  type AutoIdentifyCompetitorsResponse,
  type MarketScopeRegion,
} from "@/lib/api-client";

interface AutoCompetitorsPanelProps {
  projectId: string;
  orgId?: string | null;
  defaultDomain?: string | null;
  onAddedSuccess?: () => void;
  compact?: boolean;
}

const INDUSTRY_PRESETS = [
  { label: "🍎 Fruit Pulp & Food Exports", value: "Fruit Pulp, Concentrates, IQF Fruits & Agro Exports" },
  { label: "🚚 Transport & Logistics", value: "Logistics, Freight & Fleet Transportation Services" },
  { label: "🏭 Manufacturing & Industrial", value: "Industrial Manufacturing & Engineering Solutions" },
  { label: "⚡ SaaS & Cloud Software", value: "Cloud Software, SaaS & Developer Platforms" },
  { label: "💼 SEO & Digital Agency", value: "SEO, Performance Marketing & Digital Growth Agency" },
  { label: "🛒 E-Commerce & Retail", value: "E-Commerce & Digital Merchandising" },
];

const SCOPES: Array<{ value: MarketScopeRegion; label: string; hint: string }> = [
  { value: "worldwide", label: "Worldwide", hint: "International competitors" },
  { value: "india", label: "India", hint: "National companies across India" },
  { value: "maharashtra", label: "Maharashtra", hint: "Mumbai, Pune, Nashik, Jalgaon" },
];

/** Plain-language reason a suggested company was not shown. */
const REJECTION_LABEL: Record<string, string> = {
  offline: "domain does not exist",
  parked: "parked / for-sale domain",
  off_niche: "not in this market",
  duplicate: "already listed",
  placeholder: "placeholder domain",
  invalid_domain: "not a valid domain",
  not_a_competitor: "marketplace or search engine",
  self: "the client's own site",
  empty: "no real website behind it",
};

/**
 * Competitor identification for the Market Research page.
 *
 * Two things about the old panel are deliberately gone.
 *
 * It opened on an empty niche picker: the operator had to classify their own
 * business before the page would do anything, which is a question the client's
 * homepage already answers. The scan now starts on its own, using the business
 * the platform detected from the site, and the picker survives below the fold
 * as a correction for the cases detection gets wrong.
 *
 * And every returned row was rendered as fact. That is how the panel came to
 * show `sugarcane.com` twice and a "MarketPulse" that does not exist — a model
 * asked for five competitors returns five whether or not five are real. The
 * API now fetches each suggestion before returning it, so this component
 * renders only verified companies, badges them as such, and says plainly when
 * the list came back short rather than filling it.
 */
export function AutoCompetitorsPanel({
  projectId,
  orgId,
  defaultDomain,
  onAddedSuccess,
}: AutoCompetitorsPanelProps) {
  const qc = useQueryClient();

  // Null until the operator types one, so a `defaultDomain` that resolves after
  // mount is picked up without an effect writing state back into render.
  const [domainOverride, setDomainOverride] = useState<string | null>(null);
  const [industryOverride, setIndustryOverride] = useState("");
  const [regionOverride, setRegionOverride] = useState<MarketScopeRegion | null>(null);
  const [showRefine, setShowRefine] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryData, setDiscoveryData] = useState<AutoIdentifyCompetitorsResponse | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The scan runs itself. Detection resolves the niche and the geography from
  // the client's own site, so there is nothing for the operator to choose
  // before the page can be useful — which is the whole point of the change.
  const autoRunFor = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId) return;
    const key = `${projectId}:${defaultDomain || ""}`;
    if (autoRunFor.current === key) return;
    autoRunFor.current = key;
    void runDiscovery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, defaultDomain]);

  async function runDiscovery(options?: {
    industry?: string;
    region?: MarketScopeRegion;
    refreshProfile?: boolean;
  }) {
    const domainToScan = (domainOverride ?? defaultDomain ?? "").trim();
    const industry = options?.industry !== undefined ? options.industry : industryOverride;
    const region = options?.region !== undefined ? options.region : regionOverride;

    setIsDiscovering(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.autoIdentifyCompetitors(projectId, {
        domain: domainToScan || undefined,
        // Omitted rather than defaulted: an absent industry or region is what
        // tells the API to use what it detected from the client's website.
        industry: industry?.trim() || undefined,
        region: region || undefined,
        refreshProfile: options?.refreshProfile || undefined,
      });

      setDiscoveryData(res);

      const unadded = res.topCompetitors.filter((c) => !c.isAlreadyAdded);
      setSelectedDomains(
        (unadded.length > 0 ? unadded : res.topCompetitors).slice(0, 3).map((c) => c.domain.toLowerCase()),
      );
    } catch (err: unknown) {
      console.error("Failed to auto-identify competitors:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to auto-identify competitors. Please try again.",
      );
    } finally {
      setIsDiscovering(false);
    }
  }

  function toggleCompetitor(domain: string) {
    const lower = domain.toLowerCase();
    setSelectedDomains((prev) => {
      if (prev.includes(lower)) return prev.filter((d) => d !== lower);
      if (prev.length >= 3) return [...prev.slice(1), lower];
      return [...prev, lower];
    });
  }

  function selectTopThree() {
    if (!discoveryData) return;
    setSelectedDomains(discoveryData.topCompetitors.slice(0, 3).map((c) => c.domain.toLowerCase()));
  }

  async function handleAddSelected() {
    if (!discoveryData || selectedDomains.length === 0 || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const selectedItems = discoveryData.topCompetitors
        .filter((c) => selectedDomains.includes(c.domain.toLowerCase()))
        .map((c) => ({
          domain: c.domain,
          name: c.name,
          label: c.name,
          industry: c.industry,
          description: c.description,
          location: c.location,
          confidenceScore: c.overlapScore,
        }));

      const res = await api.addSelectedCompetitors(projectId, { competitors: selectedItems });

      setSuccessMessage(
        `Successfully added ${res.count} competitor${res.count === 1 ? "" : "s"} to your project tracking! SEO and AI citation monitoring are now active.`,
      );

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["competitors", projectId] }),
        qc.invalidateQueries({ queryKey: ["ai-visibility", projectId] }),
        qc.invalidateQueries({ queryKey: ["portfolio", orgId] }),
        qc.invalidateQueries({ queryKey: ["research-suggested-questions", projectId] }),
      ]);

      setDiscoveryData((prev) =>
        prev
          ? {
              ...prev,
              topCompetitors: prev.topCompetitors.map((c) =>
                selectedDomains.includes(c.domain.toLowerCase()) ? { ...c, isAlreadyAdded: true } : c,
              ),
            }
          : null,
      );

      onAddedSuccess?.();
    } catch (err: unknown) {
      console.error("Failed to add selected competitors:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to add selected competitors. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const shownDomain = domainOverride ?? discoveryData?.customerDomain ?? defaultDomain ?? "";
  const profile = discoveryData?.businessProfile;
  const activeRegion = (discoveryData?.region as MarketScopeRegion) || regionOverride || "worldwide";
  const activeIndustry = discoveryData?.industry || industryOverride;
  const location = profile
    ? [profile.city, profile.state, profile.country].filter(Boolean).join(", ")
    : "";
  const rejected = discoveryData?.rejected ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-gradient-to-b from-[var(--surface-1)] to-[var(--surface-2)] shadow-sm">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm shadow-indigo-500/20">
              <Sparkles size={20} className={isDiscovering ? "animate-pulse" : ""} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Automatic Competitor Identification
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck size={11} />
                  Every domain checked live
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                We read your website to work out what you sell and where you sell it, then find real
                companies competing for the same customers. Pick any 3 to track.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Kept outside the detected-business card on purpose. The card is
                the usual home for this control, but it does not render when
                detection returns nothing — an API that predates detection, a
                site that could not be read — and gating the only niche and
                scope control on a successful detection leaves the operator
                with no way to steer the search at all. */}
            {!profile && (
              <button
                type="button"
                onClick={() => setShowRefine((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                <SlidersHorizontal size={12} />
                {showRefine ? "Hide" : "Set niche & scope"}
              </button>
            )}
            <button
              onClick={() => runDiscovery({ refreshProfile: true })}
              disabled={isDiscovering}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              <RefreshCw size={12} className={isDiscovering ? "animate-spin" : ""} />
              Re-Scan Market
            </button>
          </div>
        </div>

        {/* What we detected about this business */}
        {profile && (
          <div className="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-3.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <Building2 size={12} />
                  Your business, detected from {profile.domain}
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                  {profile.businessName}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {activeIndustry}
                  {location && (
                    <span className="text-[var(--text-muted)]">
                      {" · "}
                      <MapPin size={10} className="inline -mt-0.5" /> {location}
                    </span>
                  )}
                </p>
                {profile.summary && (
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
                    {profile.summary}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                    profile.confidence === "high"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : profile.confidence === "medium"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}
                >
                  {profile.confidence} confidence
                </span>
                <button
                  type="button"
                  onClick={() => setShowRefine((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                >
                  <SlidersHorizontal size={11} />
                  {showRefine ? "Hide" : "Not right?"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Refine: only shown when detection got it wrong */}
        {showRefine && (
          <div className="mt-3 space-y-3 rounded-xl border border-dashed border-[var(--border-color)] p-3.5">
            <p className="text-[11px] text-[var(--text-muted)]">
              {profile
                ? "Override what we detected. Anything you set here wins over the website reading."
                : "We could not read your business from the site. Set the niche and scope by hand."}
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Scope:
              </span>
              <div className="inline-flex rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
                {SCOPES.map((scope) => (
                  <button
                    key={scope.value}
                    type="button"
                    title={scope.hint}
                    onClick={() => {
                      setRegionOverride(scope.value);
                      void runDiscovery({ region: scope.value });
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
                      activeRegion === scope.value
                        ? "bg-blue-600 font-semibold text-white shadow-xs"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {scope.value === "worldwide" ? <Globe size={13} /> : <MapPin size={13} />}
                    {scope.label}
                  </button>
                ))}
              </div>
              {discoveryData?.regionWasDetected && !regionOverride && (
                <span className="text-[10.5px] text-[var(--text-muted)]">
                  detected from your address
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Niche:
              </span>
              {INDUSTRY_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setIndustryOverride(preset.value);
                    void runDiscovery({ industry: preset.value });
                  }}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 transition ${
                    industryOverride === preset.value
                      ? "border-blue-500/30 bg-blue-500/10 font-medium text-blue-600 dark:text-blue-400"
                      : "border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={industryOverride}
                onChange={(e) => setIndustryOverride(e.target.value)}
                placeholder="Or describe your niche in your own words"
                className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <input
                value={shownDomain}
                onChange={(e) => setDomainOverride(e.target.value)}
                placeholder="Website domain"
                className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:w-56"
              />
              <button
                onClick={() => void runDiscovery({ refreshProfile: true })}
                disabled={isDiscovering}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-900 disabled:opacity-50"
              >
                <Target size={13} />
                Re-run with these
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scanning */}
      {isDiscovering && (
        <div className="p-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Loader2 size={28} className="animate-spin" />
          </div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
            Reading {shownDomain || "your website"} and verifying competitors…
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-[var(--text-muted)]">
            Working out what you sell, then fetching every candidate company to confirm it is a real
            business in your market before showing it.
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="m-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="m-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {discoveryData && !isDiscovering && (
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {discoveryData.topCompetitors.length} verified competitor
                  {discoveryData.topCompetitors.length === 1 ? "" : "s"} for{" "}
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {discoveryData.customerDomain}
                  </span>
                </span>
                <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  {activeRegion === "maharashtra"
                    ? "🚩 Maharashtra"
                    : activeRegion === "india"
                      ? "🇮🇳 India"
                      : "🌍 Worldwide"}
                  {discoveryData.regionWasDetected ? " · detected" : ""}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                Market niche: <strong>{activeIndustry}</strong>
                {discoveryData.industryWasDetected ? " (read from your website)" : ""} · Select any 3 to
                track SEO &amp; AI citations.
              </p>
            </div>

            {discoveryData.topCompetitors.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                  Selected:{" "}
                  <span className={selectedDomains.length === 3 ? "font-bold text-emerald-600" : "text-blue-600"}>
                    {selectedDomains.length} / 3
                  </span>
                </span>
                <button
                  type="button"
                  onClick={selectTopThree}
                  className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Select Top 3
                </button>
              </div>
            )}
          </div>

          {/* Why the list is what it is */}
          {(discoveryData.notes ?? []).map((note) => (
            <div
              key={note}
              className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11.5px] text-amber-700 dark:text-amber-400"
            >
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>{note}</span>
            </div>
          ))}

          {discoveryData.topCompetitors.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--border-color)] p-8 text-center">
              <AlertTriangle size={22} className="mx-auto mb-2 text-[var(--text-muted)]" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                Nothing we could verify in this market
              </h4>
              <p className="mx-auto mt-1 max-w-md text-xs text-[var(--text-muted)]">
                We would rather show you nothing than a list of companies that turn out not to exist.
                Describe your niche more precisely, or widen the scope.
              </p>
              <button
                type="button"
                onClick={() => setShowRefine(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-900"
              >
                <SlidersHorizontal size={13} />
                Refine the search
              </button>
            </div>
          )}

          {/* Cards */}
          {discoveryData.topCompetitors.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {discoveryData.topCompetitors.map((comp, index) => {
                const isSelected = selectedDomains.includes(comp.domain.toLowerCase());
                const isAlreadyAdded = comp.isAlreadyAdded;

                return (
                  <div
                    key={comp.domain}
                    onClick={() => !isAlreadyAdded && toggleCompetitor(comp.domain)}
                    className={`relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/30 dark:bg-blue-950/20"
                        : "border-[var(--border-color)] bg-[var(--surface-1)] hover:border-accent-600"
                    } ${isAlreadyAdded ? "cursor-default bg-emerald-50/20 opacity-75" : ""}`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] text-[10.5px] font-bold text-[var(--text-secondary)]">
                            #{index + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="truncate text-xs font-bold text-[var(--text-primary)]">
                              {comp.name}
                            </h4>
                            <a
                              href={`https://${comp.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 truncate font-mono text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                            >
                              <span>{comp.domain}</span>
                              <ExternalLink size={10} className="shrink-0" />
                            </a>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isAlreadyAdded ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <Check size={11} /> Tracked
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCompetitor(comp.domain);
                              }}
                              className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                                isSelected
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-[var(--border-color)] bg-[var(--surface-2)] text-transparent hover:border-blue-500"
                              }`}
                            >
                              <Check size={12} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {comp.verified && (
                          <span
                            title={
                              comp.source === "curated"
                                ? "From our hand-checked list of real companies in this market"
                                : `Live site checked${comp.verifiedTitle ? `: “${comp.verifiedTitle}”` : ""}`
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                          >
                            <ShieldCheck size={10} />
                            {comp.source === "curated" ? "Known company" : "Site verified"}
                          </span>
                        )}
                        {comp.location && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            <MapPin size={10} className="shrink-0" />
                            <span className="truncate">{comp.location}</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="max-w-[140px] truncate rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                          {comp.marketPosition}
                        </span>
                        <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <TrendingUp size={12} />
                          <span>{comp.overlapScore}% overlap</span>
                        </div>
                      </div>

                      <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
                        {comp.description}
                      </p>

                      {comp.keyDifferentiator && (
                        <p className="mt-1.5 text-[11px] italic text-[var(--text-muted)]">
                          “{comp.keyDifferentiator}”
                        </p>
                      )}
                    </div>

                    <div className="mt-3 border-t border-[var(--border-color)] pt-2.5">
                      <div className="flex flex-wrap gap-1">
                        {comp.sampleKeywords.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="max-w-[120px] truncate rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[9.5px] text-[var(--text-muted)]"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* What we threw away, and why */}
          {rejected.length > 0 && (
            <details className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-3">
              <summary className="cursor-pointer text-[11px] font-medium text-[var(--text-secondary)]">
                {rejected.length} suggestion{rejected.length === 1 ? "" : "s"} discarded during
                verification
              </summary>
              <ul className="mt-2 space-y-1">
                {rejected.map((r) => (
                  <li key={`${r.domain}-${r.reason}`} className="text-[11px] text-[var(--text-muted)]">
                    <span className="font-mono">{r.domain}</span>
                    {r.name ? ` (${r.name})` : ""} —{" "}
                    <span className="text-[var(--text-secondary)]">
                      {REJECTION_LABEL[r.reason] || r.reason}
                    </span>
                    . {r.detail}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Action bar */}
          {discoveryData.topCompetitors.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border-color)] pt-3 sm:flex-row">
              <div className="text-xs text-[var(--text-secondary)]">
                {selectedDomains.length === 0 ? (
                  <span>Please select up to 3 competitors to add to your workspace.</span>
                ) : (
                  <span>
                    Ready to track <strong>{selectedDomains.length}</strong> competitor
                    {selectedDomains.length === 1 ? "" : "s"} ({selectedDomains.join(", ")})
                  </span>
                )}
              </div>

              <button
                onClick={handleAddSelected}
                disabled={selectedDomains.length === 0 || isSaving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition hover:opacity-95 disabled:opacity-50 sm:w-auto"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Adding Competitors…
                  </>
                ) : (
                  <>
                    <Plus size={13} />
                    Add {selectedDomains.length > 0 ? selectedDomains.length : 3} Selected Competitor
                    {selectedDomains.length === 1 ? "" : "s"}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* First paint, before the automatic scan has returned anything */}
      {!discoveryData && !isDiscovering && !errorMessage && (
        <div className="p-8 text-center">
          <button
            onClick={() => void runDiscovery()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition hover:opacity-95"
          >
            <Zap size={13} />
            Identify My Competitors
          </button>
        </div>
      )}
    </div>
  );
}
