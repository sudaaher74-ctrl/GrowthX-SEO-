"use client";

import { useState, useEffect } from "react";
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
  ArrowRight,
  RefreshCw,
  Plus,
  Check,
  Layers,
  Globe,
  MapPin,
  Flag,
} from "lucide-react";
import { api, type AutoIdentifiedCompetitor, type AutoIdentifyCompetitorsResponse, type MarketScopeRegion } from "@/lib/api-client";
import { Pill, Panel, MeterBar } from "@/components/ui/console";

interface AutoCompetitorsPanelProps {
  projectId: string;
  orgId?: string | null;
  defaultDomain?: string | null;
  onAddedSuccess?: () => void;
  compact?: boolean;
}

export function AutoCompetitorsPanel({
  projectId,
  orgId,
  defaultDomain,
  onAddedSuccess,
  compact = false,
}: AutoCompetitorsPanelProps) {
  const qc = useQueryClient();

  const [inputDomain, setInputDomain] = useState(defaultDomain || "");
  const [inputIndustry, setInputIndustry] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<MarketScopeRegion>("maharashtra");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryData, setDiscoveryData] = useState<AutoIdentifyCompetitorsResponse | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (defaultDomain && !inputDomain) {
      setInputDomain(defaultDomain);
    }
  }, [defaultDomain]);

  async function handleAutoDiscover(
    targetDomain?: string,
    overrideRegion?: MarketScopeRegion,
    overrideIndustry?: string,
  ) {
    const domainToScan = (targetDomain || inputDomain || defaultDomain || "").trim();
    const regionToUse = overrideRegion || selectedRegion;
    const industryToUse = (overrideIndustry !== undefined ? overrideIndustry : inputIndustry).trim();

    setIsDiscovering(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.autoIdentifyCompetitors(projectId, {
        domain: domainToScan || undefined,
        region: regionToUse,
        industry: industryToUse || undefined,
      });

      setDiscoveryData(res);
      if (res.customerDomain && !inputDomain) {
        setInputDomain(res.customerDomain);
      }
      if (res.industry && !inputIndustry) {
        setInputIndustry(res.industry);
      }

      // Pre-select top 3 competitors that are not already added (or top 3 by default)
      const unadded = res.topCompetitors.filter((c) => !c.isAlreadyAdded);
      const toSelect = (unadded.length > 0 ? unadded : res.topCompetitors)
        .slice(0, 3)
        .map((c) => c.domain.toLowerCase());

      setSelectedDomains(toSelect);
    } catch (err: any) {
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
      if (prev.includes(lower)) {
        return prev.filter((d) => d !== lower);
      } else {
        if (prev.length >= 3) {
          return [...prev.slice(1), lower];
        }
        return [...prev, lower];
      }
    });
  }

  function selectTopThree() {
    if (!discoveryData) return;
    const top3 = discoveryData.topCompetitors.slice(0, 3).map((c) => c.domain.toLowerCase());
    setSelectedDomains(top3);
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

      const res = await api.addSelectedCompetitors(projectId, {
        competitors: selectedItems,
      });

      setSuccessMessage(
        `Successfully added ${res.count} competitor${res.count === 1 ? "" : "s"} to your project tracking! SEO and AI citation monitoring are now active.`,
      );

      // Invalidate relevant React Query caches
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["competitors", projectId] }),
        qc.invalidateQueries({ queryKey: ["ai-visibility", projectId] }),
        qc.invalidateQueries({ queryKey: ["portfolio", orgId] }),
        qc.invalidateQueries({ queryKey: ["research-suggested-questions", projectId] }),
      ]);

      // Update local state to mark newly added
      setDiscoveryData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          topCompetitors: prev.topCompetitors.map((c) =>
            selectedDomains.includes(c.domain.toLowerCase())
              ? { ...c, isAlreadyAdded: true }
              : c,
          ),
        };
      });

      onAddedSuccess?.();
    } catch (err: any) {
      console.error("Failed to add selected competitors:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to add selected competitors. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const INDUSTRY_PRESETS = [
    { label: "🍎 Fruit Pulp & Food Exports", value: "Fruit Pulp, Concentrates, IQF Fruits & Agro Exports" },
    { label: "🚚 Transport & Logistics", value: "Logistics, Freight & Fleet Transportation Services" },
    { label: "🏭 Manufacturing & Industrial", value: "Industrial Manufacturing & Engineering Solutions" },
    { label: "⚡ SaaS & Cloud Software", value: "Cloud Software, SaaS & Developer Platforms" },
    { label: "💼 SEO & Digital Agency", value: "SEO, Performance Marketing & Digital Growth Agency" },
    { label: "🛒 E-Commerce & Retail", value: "E-Commerce & Digital Merchandising" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-gradient-to-b from-[var(--surface-1)] to-[var(--surface-2)] shadow-sm">
      {/* Header Banner */}
      <div className="border-b border-[var(--border-color)] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm shadow-indigo-500/20">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Automatic Competitor Identification
                </h3>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Verified Real Companies
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Select your market geography (Worldwide, India, or Maharashtra) and niche to identify genuine direct market competitors and add any 3 to your tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!discoveryData ? (
              <button
                onClick={() => handleAutoDiscover()}
                disabled={isDiscovering}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:opacity-95 disabled:opacity-50"
              >
                {isDiscovering ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Scanning Market…
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    Auto-Identify Top 5
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => handleAutoDiscover()}
                disabled={isDiscovering}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition"
              >
                <RefreshCw size={12} className={isDiscovering ? "animate-spin" : ""} />
                Re-Scan Market
              </button>
            )}
          </div>
        </div>

        {/* Geographic Scope Selector Tabs & Industry Filters */}
        <div className="mt-4 pt-3 border-t border-[var(--border-color)]/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mr-1">
                Target Scope:
              </span>
              <div className="inline-flex rounded-xl bg-[var(--surface-2)] p-1 border border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRegion("worldwide");
                    handleAutoDiscover(undefined, "worldwide");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
                    selectedRegion === "worldwide"
                      ? "bg-blue-600 text-white shadow-xs font-semibold"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Globe size={13} />
                  Worldwide
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRegion("india");
                    handleAutoDiscover(undefined, "india");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
                    selectedRegion === "india"
                      ? "bg-blue-600 text-white shadow-xs font-semibold"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>🇮🇳</span>
                  India
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRegion("maharashtra");
                    handleAutoDiscover(undefined, "maharashtra");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
                    selectedRegion === "maharashtra"
                      ? "bg-blue-600 text-white shadow-xs font-semibold"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <MapPin size={13} className="text-amber-400" />
                  Maharashtra
                </button>
              </div>
            </div>

            {/* Current Region Indicator badge */}
            <span className="text-[11px] text-[var(--text-muted)]">
              {selectedRegion === "maharashtra" && "Targeting companies in Maharashtra (Mumbai, Pune, Nashik, Jalgaon, etc.)"}
              {selectedRegion === "india" && "Targeting national companies across India"}
              {selectedRegion === "worldwide" && "Targeting international global competitors"}
            </span>
          </div>

          {/* Quick Industry / Niche presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <span className="shrink-0 text-[10.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Niche:
            </span>
            {INDUSTRY_PRESETS.map((preset) => {
              const isMatched = inputIndustry.toLowerCase() === preset.value.toLowerCase();
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setInputIndustry(preset.value);
                    handleAutoDiscover(undefined, undefined, preset.value);
                  }}
                  className={`shrink-0 rounded-lg px-2.5 py-1 transition border ${
                    isMatched
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-medium"
                      : "bg-[var(--surface-1)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Domain & Industry Custom Input Bar if not discovered yet */}
        {!discoveryData && !isDiscovering && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={inputDomain}
                onChange={(e) => setInputDomain(e.target.value)}
                placeholder="Enter website domain (e.g. aivaenterprises.com)"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="relative sm:w-64">
              <input
                value={inputIndustry}
                onChange={(e) => setInputIndustry(e.target.value)}
                placeholder="Industry (e.g. Fruit Pulp, Logistics)"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] py-2 px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <button
              onClick={() => handleAutoDiscover()}
              disabled={isDiscovering || !inputDomain.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-950 px-4 py-2 text-xs font-medium text-white hover:bg-brand-900 transition disabled:opacity-50"
            >
              <Target size={13} />
              Identify Top 5 Competitors
            </button>
          </div>
        )}
      </div>

      {/* Loading Scanning State */}
      {isDiscovering && (
        <div className="p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-3">
            <Loader2 size={28} className="animate-spin" />
          </div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
            Analyzing Market & Search Overlap for {inputDomain || defaultDomain || "your website"}…
          </h4>
          <p className="mt-1 max-w-md mx-auto text-xs text-[var(--text-muted)]">
            Evaluating search ranking overlap, direct product alternatives, search intent volume, and competitor authority.
          </p>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="m-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="m-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Discovered 5 Competitors Matrix */}
      {discoveryData && !isDiscovering && (
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Top 5 Real Competitors for <span className="font-mono text-blue-600 dark:text-blue-400">{discoveryData.customerDomain}</span>
                </span>
                <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  {discoveryData.region === "maharashtra" ? "🚩 Maharashtra" : discoveryData.region === "india" ? "🇮🇳 India" : "🌍 Worldwide"}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Market niche: <strong>{discoveryData.industry}</strong> · Verified real companies · Select any 3 to track SEO & AI citations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] border border-[var(--border-color)]">
                Selected: <span className={selectedDomains.length === 3 ? "text-emerald-600 font-bold" : "text-blue-600"}>{selectedDomains.length} / 3</span>
              </span>
              <button
                type="button"
                onClick={selectTopThree}
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Select Top 3
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {discoveryData.topCompetitors.map((comp, index) => {
              const isSelected = selectedDomains.includes(comp.domain.toLowerCase());
              const isAlreadyAdded = comp.isAlreadyAdded;

              return (
                <div
                  key={comp.domain}
                  onClick={() => !isAlreadyAdded && toggleCompetitor(comp.domain)}
                  className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm ring-1 ring-blue-500/30"
                      : "border-[var(--border-color)] bg-[var(--surface-1)] hover:border-accent-600"
                  } ${isAlreadyAdded ? "opacity-75 cursor-default bg-emerald-50/20" : ""}`}
                >
                  {/* Top Row: Rank Badge, Info, Checkbox */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[10.5px] font-bold text-[var(--text-secondary)] border border-[var(--border-color)]">
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
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline truncate"
                          >
                            <span>{comp.domain}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                        </div>
                      </div>

                      {/* Selection Control */}
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
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "border-[var(--border-color)] bg-[var(--surface-2)] text-transparent hover:border-blue-500"
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Location Badge */}
                    {comp.location && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md w-fit">
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate">{comp.location}</span>
                      </div>
                    )}

                    {/* Market Position & Overlap Score */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400 truncate max-w-[140px]">
                        {comp.marketPosition}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        <TrendingUp size={12} />
                        <span>{comp.overlapScore}% overlap</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                      {comp.description}
                    </p>

                    {/* Differentiator */}
                    {comp.keyDifferentiator && (
                      <p className="mt-1.5 text-[11px] text-[var(--text-muted)] italic">
                        “{comp.keyDifferentiator}”
                      </p>
                    )}
                  </div>

                  {/* Keywords footer */}
                  <div className="mt-3 pt-2.5 border-t border-[var(--border-color)]">
                    <div className="flex flex-wrap gap-1">
                      {comp.sampleKeywords.slice(0, 3).map((kw, i) => (
                        <span
                          key={i}
                          className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[9.5px] text-[var(--text-muted)] truncate max-w-[120px]"
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

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-secondary)]">
              {selectedDomains.length === 0 ? (
                <span>Please select up to 3 competitors to add to your workspace.</span>
              ) : (
                <span>
                  Ready to track <strong>{selectedDomains.length}</strong> competitor{selectedDomains.length === 1 ? "" : "s"} ({selectedDomains.join(", ")})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleAddSelected}
                disabled={selectedDomains.length === 0 || isSaving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition hover:opacity-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Adding Competitors…
                  </>
                ) : (
                  <>
                    <Plus size={13} />
                    Add {selectedDomains.length > 0 ? selectedDomains.length : 3} Selected Competitor{selectedDomains.length === 1 ? "" : "s"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
