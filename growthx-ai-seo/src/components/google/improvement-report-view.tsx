"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  FileText,
  Globe,
  Link2,
  Loader2,
  MapPin,
  PenLine,
  Plus,
  Printer,
  ShieldAlert,
  Sparkles,
  Target,
  Wrench,
  X,
} from "lucide-react";
import { ActionButton, Panel, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { SourceBadge } from "@/components/google/parts";
import { usePeriodDays, useWhiteLabel, useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import type {
  BusinessTrafficContext,
  GoogleReport,
  GoogleReportLevel,
  GoogleReportPriority,
  LocationTrafficGap,
  TrafficQualityDiagnostics,
} from "@/lib/api-types";
import { download, themeColours } from "@/lib/competitor-report";
import {
  googleReportCsvSections,
  googleReportFilename,
  googleReportMarkdown,
  googleReportPrintableHtml,
} from "@/lib/google-improvement-report";
import { downloadCsvFile } from "@/lib/report-csv";
import { stagingEngine } from "@/lib/staging-engine";
import { cn } from "@/lib/utils";

const LEVEL_TONE: Record<GoogleReportLevel, "bad" | "warn" | "default"> = {
  high: "bad",
  medium: "warn",
  low: "default",
};

const SOURCE: Record<GoogleReportPriority["platform"], "GSC" | "GA4" | "GSC+GA4"> = {
  GSC: "GSC",
  GA4: "GA4",
  BOTH: "GSC+GA4",
};

const VERDICT: Record<"grow" | "fix" | "start" | "maintain", { label: string; tone: "good" | "bad" | "warn" | "default" }> = {
  grow: { label: "Grow", tone: "good" },
  fix: { label: "Fix", tone: "bad" },
  start: { label: "Start", tone: "warn" },
  maintain: { label: "Keep going", tone: "default" },
};

type EvidenceTab = "striking" | "ctr" | "queries" | "pages" | "sources";

function contentStudioHref(query: string, topic: string): string {
  return `/fix-engine?tab=content&query=${encodeURIComponent(query)}&topic=${encodeURIComponent(topic)}&kind=ARTICLE`;
}

function fmtPct(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(1)}%`;
}

function fmtNum(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  return Math.round(val).toLocaleString("en-US");
}

/**
 * Executive Traffic & Growth Intelligence Report:
 * Combines Website Audit business context, Search Console, Analytics 4,
 * Bot/Datacenter & Conversion Diagnostics, AI Visibility context,
 * interactive evidence tables, and 1-click Content Studio & Fix Engine execution.
 */
export function ImprovementReportView() {
  const { projectId, orgId } = useWorkspace();
  const days = usePeriodDays();
  const queryClient = useQueryClient();
  const { data: whiteLabel } = useWhiteLabel(orgId);

  const [cityInput, setCityInput] = useState("");
  const [extraCities, setExtraCities] = useState<string[]>([]);
  const [forwardedCount, setForwardedCount] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [stagedKeys, setStagedKeys] = useState<Set<string>>(() => new Set());

  const saved = useQuery({
    queryKey: ["google-improvement-report-latest", projectId],
    queryFn: () => api.getLatestGoogleReport(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const baseCities = saved.data?.facts.business?.targetCities ?? [];
      const mergedCities = Array.from(new Set([...extraCities, ...baseCities])).filter(Boolean);
      return api.generateGoogleReport(projectId!, days, mergedCities.length > 0 ? mergedCities : undefined);
    },
    onSuccess: async (res) => {
      queryClient.setQueryData(["google-improvement-report-latest", projectId], res);
      const count =
        res.forwardedToFixEngine ??
        (res.analysis?.priorities.length ?? 0) +
          (res.facts.locationGaps?.filter((g) => g.status !== "ACTIVE").length ?? 0);
      setForwardedCount(Math.max(1, count));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["findings", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["growth-opportunities", projectId] }),
      ]);
    },
  });

  const data: GoogleReport | undefined = generateMutation.data ?? saved.data ?? undefined;
  const a = data?.analysis ?? null;
  const business: BusinessTrafficContext | null = data?.facts.business ?? null;
  const locationGaps: LocationTrafficGap[] = data?.facts.locationGaps ?? [];
  const diagnostics: TrafficQualityDiagnostics | null = data?.facts.diagnostics ?? null;

  const activeTargetCities = Array.from(
    new Set([...(business?.targetCities ?? []), ...extraCities]),
  );

  const handleAddCity = () => {
    const trimmed = cityInput.trim();
    if (!trimmed) return;
    if (!activeTargetCities.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setExtraCities((prev) => [...prev, trimmed]);
    }
    setCityInput("");
  };

  const handleRemoveExtraCity = (city: string) => {
    setExtraCities((prev) => prev.filter((c) => c !== city));
  };

  const handleCopyUtm = async (url: string, key = url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(key);
      window.setTimeout(() => setCopiedUrl((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const stageAction = (
    key: string,
    payload: { title: string; category: string; impact: string; deliverable: string; evidence: string; priority?: "HIGH" | "MEDIUM" | "LOW" },
  ) => {
    if (!projectId) return;
    stagingEngine.stage(projectId, {
      title: payload.title,
      category: payload.category,
      source: "COMPETITOR_KEYWORD",
      priority: payload.priority ?? "HIGH",
      impact: payload.impact,
      effortHours: 1.5,
      deliverable: payload.deliverable,
      evidence: payload.evidence,
    });
    setStagedKeys((prev) => new Set(prev).add(key));
  };

  const printReport = (r: GoogleReport) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(googleReportPrintableHtml(r, themeColours(), whiteLabel));
    w.document.close();
    w.focus();
    w.print();
  };

  const exportCsv = (r: GoogleReport) => {
    downloadCsvFile(googleReportFilename(r, "csv"), googleReportCsvSections(r));
  };

  // Pull real KPI values safely for the Executive Scorecard
  const clicksKpi = data?.facts.kpis.find((k) => k.source === "GSC" && k.label.toLowerCase().includes("click"));
  const impKpi = data?.facts.kpis.find((k) => k.source === "GSC" && k.label.toLowerCase().includes("impression"));
  const ctrKpi = data?.facts.kpis.find((k) => k.source === "GSC" && k.label.toLowerCase().includes("ctr"));
  const posKpi = data?.facts.kpis.find((k) => k.source === "GSC" && k.label.toLowerCase().includes("position"));
  const engKpi = data?.facts.kpis.find((k) => k.source === "GA4" && k.label.toLowerCase().includes("engagement"));
  const keyEventsKpi = data?.facts.kpis.find((k) => k.source === "GA4" && k.label.toLowerCase().includes("key event"));

  const totalSessions = data?.facts.traffic?.sessions ?? null;
  const activeCitiesCount = locationGaps.filter((g) => g.status === "ACTIVE").length;
  const primaryOffering = business?.offerings?.[0] || business?.industry || "core services";

  return (
    <div className="space-y-4">
      {/* 1. CONTROL & EXPORT HEADER */}
      <Panel
        title="Traffic & Growth Intelligence Report"
        subtitle={`Combines Website Audit business context, Search Console rankings, GA4 traffic quality diagnostics (bot/datacenter noise, conversion tracking, dark Direct attribution), and AI Visibility over the last ${days} days.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/fix-engine"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-950 hover:bg-brand-100 transition"
            >
              <Wrench size={12} />
              <span>Open Fix Engine</span>
            </Link>
            <ActionButton
              variant="primary"
              icon={generateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !projectId}
            >
              {generateMutation.isPending
                ? "Running Traffic Intelligence…"
                : data
                  ? "Regenerate & sync Fix Engine"
                  : "Generate Traffic Intelligence Report"}
            </ActionButton>
          </div>
        }
        padded
      >
        {/* Target Cities / Where Business Wants Traffic input bar */}
        <div className="mb-4 rounded-xl border border-brand-200/60 bg-brand-50/60 p-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-semibold text-brand-950 flex items-center gap-1.5">
                <MapPin size={13} className="text-accent-600" />
                Where your business wants traffic (Target Cities &amp; Service Areas)
              </p>
              <p className="text-[11.5px] text-brand-500">
                Cities detected from your Website Audit are matched strictly (zero double-counting between neighboring cities). Add any target city and regenerate.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCity();
                  }
                }}
                placeholder="Add city (e.g. Thane, Pune, Nashik)…"
                aria-label="Add target business city"
                className="h-8 w-56 rounded-lg border border-brand-200 bg-surface-1 px-3 text-[12px] text-brand-950 outline-none focus:border-primary-500"
              />
              <ActionButton icon={<Plus size={12} />} onClick={handleAddCity} disabled={!cityInput.trim()}>
                Add city
              </ActionButton>
            </div>
          </div>

          {activeTargetCities.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {activeTargetCities.map((city) => {
                const isExtra = extraCities.includes(city);
                return (
                  <span
                    key={city}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11.5px] font-medium text-brand-950"
                  >
                    <MapPin size={11} className="text-accent-600" />
                    <span>{city}</span>
                    {isExtra && (
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraCity(city)}
                        className="text-brand-400 hover:text-error-600 cursor-pointer"
                        aria-label={`Remove ${city}`}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {generateMutation.isPending ? (
          <p className="py-6 text-center text-[12px] text-brand-500">
            Auditing Website Audit entities, Search Console striking-distance &amp; CTR gaps, GA4 bot/datacenter noise, conversion tracking, and city traffic…
          </p>
        ) : generateMutation.error ? (
          <p className="py-4 text-center text-[12px] text-error-600">{(generateMutation.error as Error).message}</p>
        ) : !data ? (
          <p className="py-6 text-center text-[12px] text-brand-500">
            {saved.isLoading
              ? "Loading your latest Traffic Intelligence Report…"
              : 'Click "Generate Traffic Intelligence Report" to audit your business cities, search opportunities, traffic quality, and channel strategy.'}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-brand-500">
              Generated {relativeTime(data.generatedAt)} · last {data.facts.days} days
              {data.model ? ` · Analyzed by ${data.model}` : ""}
              {whiteLabel?.whiteLabelEnabled && whiteLabel.agencyName ? ` · White-label: ${whiteLabel.agencyName}` : ""}
            </span>
            <span className="ml-auto flex flex-wrap gap-2">
              <ActionButton icon={<FileSpreadsheet size={13} />} onClick={() => exportCsv(data)}>
                Export CSV
              </ActionButton>
              <ActionButton
                icon={<FileText size={13} />}
                onClick={() =>
                  download(googleReportFilename(data, "md"), googleReportMarkdown(data, whiteLabel), "text/markdown")
                }
              >
                Report (.md)
              </ActionButton>
              <ActionButton icon={<Printer size={13} />} onClick={() => printReport(data)}>
                {whiteLabel?.whiteLabelEnabled ? "White-Label PDF" : "Print / PDF"}
              </ActionButton>
            </span>
          </div>
        )}
      </Panel>

      {/* Forwarded to Fix Engine Confirmation */}
      {(forwardedCount !== null || (data?.forwardedToFixEngine && data.forwardedToFixEngine > 0)) && (
        <StatusNote tone="good">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>
                <strong>Synced with Fix Engine:</strong>{" "}
                {forwardedCount ?? data?.forwardedToFixEngine} traffic, city gap &amp; attribution actions are tracked in your workspace plan.
              </span>
            </span>
            <Link href="/fix-engine" className="inline-flex items-center gap-1 font-semibold underline">
              <span>View in Fix Engine</span>
              <ArrowRight size={12} />
            </Link>
          </span>
        </StatusNote>
      )}

      {/* 2. EXECUTIVE HEALTH SCORECARD STRIP */}
      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Search Visibility */}
          <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                Search Visibility (GSC)
              </span>
              <SourceBadge source="GSC" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-brand-950">
                {fmtNum(clicksKpi?.value)}
              </span>
              <span className="text-[11.5px] font-medium text-brand-500">clicks</span>
              {clicksKpi?.change && (
                <Pill tone={clicksKpi.change.startsWith("+") ? "good" : "bad"}>{clicksKpi.change}</Pill>
              )}
            </div>
            <p className="mt-1.5 text-[11.5px] text-brand-500">
              {fmtNum(impKpi?.value)} impressions · CTR {fmtPct(ctrKpi?.value)} · Avg pos{" "}
              {posKpi?.value != null ? posKpi.value.toFixed(1) : "—"}
            </p>
          </div>

          {/* Card 2: Clean Human Audience vs. Bot Noise */}
          <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                {diagnostics && diagnostics.botAndNoise.suspectedBotSessions > 0
                  ? "Clean Human Sessions"
                  : "GA4 Visitor Sessions"}
              </span>
              <SourceBadge source="GA4" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-brand-950">
                {diagnostics && totalSessions != null
                  ? fmtNum(diagnostics.botAndNoise.estimatedHumanSessions)
                  : fmtNum(totalSessions)}
              </span>
              {diagnostics && diagnostics.botAndNoise.suspectedBotSessions > 0 ? (
                <Pill tone="warn">-{fmtNum(diagnostics.botAndNoise.suspectedBotSessions)} bot/DC</Pill>
              ) : (
                <span className="text-[11.5px] font-medium text-brand-500">sessions</span>
              )}
            </div>
            <p className="mt-1.5 text-[11.5px] text-brand-500">
              {totalSessions != null ? `${fmtNum(totalSessions)} raw sessions` : "GA4 not measured"} · Engagement{" "}
              {fmtPct(engKpi?.value ?? data.facts.traffic?.engagementRate)}
            </p>
          </div>

          {/* Card 3: Conversion Readiness */}
          <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                Conversion Tracking
              </span>
              <Pill
                tone={
                  diagnostics?.conversionTracking.status === "ACTIVE" || (keyEventsKpi?.value ?? 0) > 0
                    ? "good"
                    : "bad"
                }
              >
                {diagnostics?.conversionTracking.status === "ACTIVE" || (keyEventsKpi?.value ?? 0) > 0
                  ? "Active"
                  : "Setup Needed"}
              </Pill>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-brand-950">
                {keyEventsKpi?.value != null ? fmtNum(keyEventsKpi.value) : "0"}
              </span>
              <span className="text-[11.5px] font-medium text-brand-500">GA4 key events</span>
            </div>
            <p className="mt-1.5 text-[11.5px] text-brand-500">
              {diagnostics?.conversionTracking.status === "ACTIVE"
                ? `Conversion rate: ${fmtPct(diagnostics.conversionTracking.conversionRate)} of clean sessions`
                : "Mark checkout, signup, or WhatsApp clicks as GA4 Key Events"}
            </p>
          </div>

          {/* Card 4: Local Market & AI Search Coverage */}
          <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                Local &amp; AI Capture
              </span>
              <Pill tone={activeCitiesCount === locationGaps.length && locationGaps.length > 0 ? "good" : "warn"}>
                {activeCitiesCount}/{locationGaps.length} active
              </Pill>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-brand-950">
                {diagnostics?.aiVisibility ? fmtPct(diagnostics.aiVisibility.mentionRate) : `${activeCitiesCount}/${locationGaps.length}`}
              </span>
              <span className="text-[11.5px] font-medium text-brand-500">
                {diagnostics?.aiVisibility ? "AI citation rate" : "target cities winning clicks"}
              </span>
            </div>
            <p className="mt-1.5 text-[11.5px] text-brand-500">
              {diagnostics?.aiVisibility ? (
                <>
                  Cited in {diagnostics.aiVisibility.brandMentions}/{diagnostics.aiVisibility.answersMeasured} AI answers ·{" "}
                  <Link href="/ai-visibility" className="font-semibold text-accent-700 hover:underline">
                    AI Visibility →
                  </Link>
                </>
              ) : (
                <>
                  AI visibility not scanned yet ·{" "}
                  <Link href="/ai-visibility" className="font-semibold text-accent-700 hover:underline">
                    Run AI Scan →
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* 3. TRAFFIC QUALITY, BOT NOISE & ATTRIBUTION DIAGNOSTICS */}
      {diagnostics && (
        <Panel
          title="Traffic Quality, Attribution & Conversion Audit"
          subtitle="Automated anomalies detected directly from your GA4 cities, channel shares, and conversion telemetry — issues most SEO dashboards miss"
          padded
        >
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            {/* Bot / Datacenter Noise Card */}
            <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-950">
                  <ShieldAlert size={14} className={diagnostics.botAndNoise.suspectedBotSessions > 0 ? "text-warning-600" : "text-success-600"} />
                  <span>Datacenter &amp; Bot Noise</span>
                </span>
                <Pill tone={diagnostics.botAndNoise.suspectedBotSessions > 0 ? "warn" : "good"}>
                  {diagnostics.botAndNoise.suspectedBotSessions > 0
                    ? `${fmtPct(diagnostics.botAndNoise.noiseShare)} noise`
                    : "Clean"}
                </Pill>
              </div>
              <p className="text-[12px] leading-relaxed text-brand-600">
                {diagnostics.botAndNoise.diagnosis}
              </p>
              {diagnostics.botAndNoise.suspectedBotCities.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-brand-200/70">
                  {diagnostics.botAndNoise.suspectedBotCities.map((c) => (
                    <div key={`${c.city}-${c.country}`} className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-semibold text-brand-900">{c.city}</span>
                      <span className="font-mono text-warning-700">{c.sessions} sessions</span>
                    </div>
                  ))}
                  {diagnostics.botAndNoise.notSetCitySessions > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-brand-600">(not set) city</span>
                      <span className="font-mono text-brand-600">{diagnostics.botAndNoise.notSetCitySessions} sessions</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Conversion Blindspot Card */}
            <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-950">
                  <Target size={14} className={diagnostics.conversionTracking.status === "ACTIVE" ? "text-success-600" : "text-error-600"} />
                  <span>Conversion Measurement</span>
                </span>
                <Pill tone={diagnostics.conversionTracking.status === "ACTIVE" ? "good" : "bad"}>
                  {diagnostics.conversionTracking.status === "ACTIVE" ? "Tracking Live" : "0 Key Events"}
                </Pill>
              </div>
              <p className="text-[12px] leading-relaxed text-brand-600">
                {diagnostics.conversionTracking.diagnosis}
              </p>
              {diagnostics.conversionTracking.status !== "ACTIVE" && (
                <div className="pt-1 border-t border-brand-200/70">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400 mb-1.5">
                    Recommended GA4 Key Events to enable
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {diagnostics.conversionTracking.recommendedEvents.map((ev) => (
                      <span
                        key={ev}
                        className="rounded-md border border-brand-200 bg-surface-1 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-brand-900"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Attribution & Dark Direct Card */}
            <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-950">
                  <Link2 size={14} className={diagnostics.attributionHealth.status === "HEALTHY" ? "text-success-600" : "text-warning-600"} />
                  <span>Direct &amp; UTM Attribution</span>
                </span>
                <Pill tone={diagnostics.attributionHealth.status === "HEALTHY" ? "good" : "warn"}>
                  {fmtPct(diagnostics.attributionHealth.directShare)} Direct
                </Pill>
              </div>
              <p className="text-[12px] leading-relaxed text-brand-600">
                {diagnostics.attributionHealth.diagnosis}
              </p>
              {diagnostics.targetMarketFit.topUntappedCities.length > 0 && (
                <p className="pt-1 border-t border-brand-200/70 text-[11px] text-brand-600">
                  <span className="font-semibold text-brand-950">Untapped demand cities: </span>
                  {diagnostics.targetMarketFit.topUntappedCities
                    .map((c) => `${c.city} (${c.sessions})`)
                    .join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Ready-to-Copy UTM Campaign Kit */}
          {diagnostics.attributionHealth.status !== "HEALTHY" && diagnostics.attributionHealth.utmTemplates.length > 0 && (
            <div className="mt-4 rounded-xl border border-brand-200 bg-surface-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div>
                  <p className="text-[12px] font-bold text-brand-950">
                    Ready-to-Copy UTM Tracking Kit (Fix Dark Direct Traffic Today)
                  </p>
                  <p className="text-[11px] text-brand-500">
                    Paste these tagged links into your Google Business Profile, WhatsApp catalog, and Instagram bio so GA4 attributes local campaigns cleanly instead of dumping them into Direct.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                {diagnostics.attributionHealth.utmTemplates.map((utm) => {
                  const isCopied = copiedUrl === utm.url;
                  return (
                    <div
                      key={utm.label}
                      className="rounded-lg border border-brand-200/80 bg-brand-50/50 p-2.5 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-bold text-brand-950">{utm.label}</span>
                        <Pill tone="info">{utm.channel}</Pill>
                      </div>
                      <code className="block truncate rounded bg-surface-1 border border-brand-200/70 px-2 py-1 font-mono text-[10.5px] text-brand-700">
                        {utm.url}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyUtm(utm.url)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-surface-1 hover:bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-950 transition cursor-pointer"
                      >
                        {isCopied ? <Check size={12} className="text-success-600" /> : <Copy size={12} />}
                        <span>{isCopied ? "Copied UTM link" : "Copy tagged link"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      )}

      {/* 4. BUSINESS UNDERSTANDING FROM WEBSITE AUDIT */}
      {business && (
        <Panel
          title="What Website Audit understands about your business"
          subtitle="Cleaned from your commercial website pages, structured data, and business profile (utility pages like /app, /cart, and /account excluded)"
          actions={
            <Link href="/website" className="text-[12px] font-semibold text-accent-700 hover:underline">
              Open Website Audit →
            </Link>
          }
          padded
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-brand-200/60 bg-brand-50/50 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                  <Building2 size={12} />
                  <span>Business &amp; Niche</span>
                </span>
                {business.healthScore != null && (
                  <Pill tone={business.healthScore >= 80 ? "good" : business.healthScore >= 60 ? "warn" : "bad"}>
                    Audit {business.healthScore}/100
                  </Pill>
                )}
              </div>
              <p className="mt-1.5 text-[13px] font-bold text-brand-950">
                {business.businessName || data?.facts.site || "Your Business"}
              </p>
              <p className="mt-0.5 text-[12px] text-brand-600">
                {business.industry || "Website business profile"}
              </p>
              {business.summary && (
                <p className="mt-2 text-[11.5px] leading-relaxed text-brand-500">
                  {business.summary}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-brand-200/60 bg-brand-50/50 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                Core Commercial Offerings · {business.pagesAudited} Pages Audited
              </p>
              {business.offerings.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {business.offerings.map((o) => (
                    <Pill key={o} tone="info">{o}</Pill>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[12px] text-brand-500">
                  Run Website Audit to extract all product and service offerings.
                </p>
              )}
              {business.auditedPages.length > 0 && (
                <p className="mt-2.5 text-[11px] text-brand-500">
                  Key commercial pages:{" "}
                  <span className="font-mono text-brand-700">
                    {business.auditedPages.slice(0, 4).map((p) => p.path).join(", ")}
                  </span>
                </p>
              )}
            </div>

            <div className="rounded-xl border border-brand-200/60 bg-brand-50/50 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                <MapPin size={12} />
                <span>Target Business Locations</span>
              </div>
              {business.targetCities.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {business.targetCities.map((c) => (
                    <Pill key={c} tone="good">{c}</Pill>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[12px] text-brand-500">
                  {business.country || "Add your target cities above to track city-level clicks."}
                </p>
              )}
              <p className="mt-2.5 text-[11.5px] text-brand-500">
                Matched strictly against exact GA4 cities and word-boundary Search Console queries below.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* 5. TARGET CITY & MARKET TRAFFIC PLAN (WITH 1-CLICK EXECUTION) */}
      {locationGaps.length > 0 && (
        <Panel
          title={`Target City & Market Traffic Plan (${locationGaps.length})`}
          subtitle="Exact per-city GA4 sessions & Search Console clicks — launch grounded local pages in Content Studio or stage schema/meta fixes in 1 click"
          padded
        >
          <div className="space-y-3">
            {locationGaps.map((gap) => {
              const stageId = `city-${gap.location}`;
              const isStaged = stagedKeys.has(stageId);
              const targetQuery = `${gap.relevantOfferings[0] || primaryOffering} in ${gap.location}`;
              return (
                <div key={gap.location} className="rounded-xl border border-brand-200 p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <MapPin size={14} className="text-accent-600" />
                    <p className="text-[13.5px] font-bold text-brand-950">{gap.location}</p>
                    <Pill
                      tone={
                        gap.status === "NO_CLICKS"
                          ? "bad"
                          : gap.status === "LOW_TRAFFIC"
                            ? "warn"
                            : "good"
                      }
                    >
                      {gap.status === "NO_CLICKS"
                        ? "0 clicks — Action Needed"
                        : gap.status === "LOW_TRAFFIC"
                          ? "0 / low search clicks"
                          : "Active local traffic"}
                    </Pill>
                    {gap.status !== "ACTIVE" && <Pill tone="info">Synced to Fix Engine</Pill>}
                    <span className="ml-auto font-mono text-[11.5px] text-brand-500">
                      {gap.searchClicks} search clicks · {gap.searchImpressions} impressions · {gap.sessions} GA4 sessions
                    </span>
                  </div>

                  <p className="text-[12px] text-brand-600">
                    <span className="font-semibold text-brand-950">Measured finding: </span>
                    {gap.finding}
                  </p>
                  <p className="text-[12px] text-brand-600">
                    <span className="font-semibold text-brand-950">Action plan: </span>
                    {gap.plan}
                  </p>

                  {gap.recommendedSteps.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
                        Steps to win traffic in {gap.location}
                      </p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-950">
                        {gap.recommendedSteps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* 1-Click Reigel Execution Loop */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-200/70">
                    <Link
                      href={contentStudioHref(targetQuery, `Local Landing Page: ${targetQuery}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-3 py-1.5 text-[11.5px] font-semibold text-white transition"
                    >
                      <PenLine size={12} />
                      <span>Draft {gap.location} Page in Content Studio</span>
                    </Link>
                    <button
                      type="button"
                      disabled={isStaged || !projectId}
                      onClick={() =>
                        stageAction(stageId, {
                          title: `Capture local search traffic for "${targetQuery}"`,
                          category: "Local Traffic & Schema",
                          impact: gap.plan,
                          deliverable: gap.recommendedSteps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
                          evidence: `${gap.sessions} GA4 sessions, ${gap.searchClicks} GSC clicks, ${gap.searchImpressions} impressions in ${gap.location}`,
                          priority: gap.status === "ACTIVE" ? "MEDIUM" : "HIGH",
                        })
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition cursor-pointer",
                        isStaged
                          ? "border-success-500/30 bg-success-50 text-success-700 cursor-default"
                          : "border-brand-200 bg-surface-1 hover:bg-brand-50 text-brand-950",
                      )}
                    >
                      {isStaged ? <CheckCircle2 size={12} /> : <Wrench size={12} />}
                      <span>{isStaged ? "Staged in Fix Engine" : "Stage Meta & Schema Fix"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* 6. INTERACTIVE SEARCH & TRAFFIC EVIDENCE EXPLORER */}
      {data && (
        <EvidenceExplorerPanel
          report={data}
          projectId={projectId}
          stagedKeys={stagedKeys}
          onStage={stageAction}
        />
      )}

      {data && !a && (
        <Panel padded>
          <p className="text-[12px] text-warning-600">
            {data.analysisError ?? "The analysis could not be written."}{" "}
            {!data.facts.searchConsole.connected || !data.facts.analytics.connected ? (
              <Link href="/integrations" className="font-semibold underline">Open Integrations</Link>
            ) : null}
          </p>
        </Panel>
      )}

      {/* 7. EXECUTIVE SUMMARY, WHERE YOU STAND, CHANNEL PLAYBOOKS & PRIORITY QUEUE */}
      {a && (
        <>
          <Panel title="Executive Summary" padded>
            <p className="text-[13px] leading-relaxed text-brand-950">{a.executiveSummary || "No summary returned."}</p>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WhereWeAre title="Search Console" source="GSC" side={a.whereWeAre.searchConsole} href="/google/search-console" />
            <WhereWeAre title="Analytics 4" source="GA4" side={a.whereWeAre.analytics} href="/google/analytics" />
          </div>

          {a.marketingStrategy && (
            <MarketingStrategyPanels strategy={a.marketingStrategy} modelName={data?.model ?? null} />
          )}

          <Panel
            title={`Priority Execution Queue (${a.priorities.length})`}
            subtitle="Ranked highest impact and lowest effort first — stage any item directly into Fix Engine or draft content in 1 click"
            padded
          >
            {a.priorities.length === 0 && <p className="text-[12px] text-brand-500">No actions returned.</p>}
            <ol className="space-y-3">
              {a.priorities.map((p) => {
                const stageId = `prio-${p.rank}-${p.title}`;
                const isStaged = stagedKeys.has(stageId);
                const isContentAction = /local|query|keyword|content|striking|page|ctr/i.test(p.title);
                return (
                  <li key={`${p.rank}-${p.title}`} className="rounded-xl border border-brand-200 p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 font-mono text-[11px] font-semibold text-white">
                        {p.rank}
                      </span>
                      <p className="text-[13px] font-bold text-brand-950">{p.title}</p>
                      <SourceBadge source={SOURCE[p.platform]} />
                      <Pill tone={LEVEL_TONE[p.priority]}>{p.priority} priority</Pill>
                      <span className="ml-auto text-[11px] text-brand-400">
                        Impact: {p.impact} · Effort: {p.effort}
                      </span>
                    </div>
                    {p.evidence && (
                      <p className="text-[12px] text-brand-600">
                        <span className="font-semibold text-brand-950">Evidence: </span>
                        {p.evidence}
                      </p>
                    )}
                    {p.whyItMatters && (
                      <p className="text-[12px] text-brand-600">
                        <span className="font-semibold text-brand-950">Why it matters: </span>
                        {p.whyItMatters}
                      </p>
                    )}
                    {p.steps.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">Steps</p>
                        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-950">
                          {p.steps.map((s, n) => (
                            <li key={n}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {p.measureBy && (
                      <p className="text-[12px] text-brand-600">
                        <span className="font-semibold text-brand-950">Measure by: </span>
                        {p.measureBy}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-200/70">
                      <button
                        type="button"
                        onClick={() => {
                          const brief = [
                            `### [TRF-${String(p.rank).padStart(2, "0")}] ${p.title}`,
                            `**Platform:** ${SOURCE[p.platform]} · **Priority:** ${p.priority.toUpperCase()} · **Impact:** ${p.impact} · **Effort:** ${p.effort}`,
                            "",
                            p.evidence ? `**Evidence:** ${p.evidence}` : "",
                            p.whyItMatters ? `**Why it matters:** ${p.whyItMatters}` : "",
                            p.steps.length ? `\n**Implementation Steps:**\n${p.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "",
                            p.measureBy ? `\n**How to verify:** ${p.measureBy}` : "",
                          ]
                            .filter(Boolean)
                            .join("\n");
                          void handleCopyUtm(brief, `brief-${stageId}`);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-950 transition cursor-pointer"
                      >
                        {copiedUrl === `brief-${stageId}` ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                        <span>{copiedUrl === `brief-${stageId}` ? "Brief copied!" : "Copy Handoff Brief"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isStaged || !projectId}
                        onClick={() =>
                          stageAction(stageId, {
                            title: p.title,
                            category: `Traffic Report (${SOURCE[p.platform]})`,
                            impact: p.whyItMatters || p.evidence,
                            deliverable: p.steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n"),
                            evidence: p.evidence,
                            priority: p.priority === "high" ? "HIGH" : p.priority === "medium" ? "MEDIUM" : "LOW",
                          })
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
                          isStaged
                            ? "border-success-500/30 bg-success-50 text-success-700 cursor-default"
                            : "border-brand-200 bg-surface-1 hover:bg-brand-50 text-brand-950",
                        )}
                      >
                        {isStaged ? <CheckCircle2 size={12} /> : <Wrench size={12} />}
                        <span>{isStaged ? "Staged in Fix Engine" : "Stage in Fix Engine"}</span>
                      </button>
                      {isContentAction && (
                        <Link
                          href={contentStudioHref(primaryOffering, p.title)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-950 transition"
                        >
                          <PenLine size={11} />
                          <span>Draft in Content Studio</span>
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>

          {a.quickWins.length > 0 && (
            <Panel title="Quick wins" subtitle="Under an hour each — concrete immediate changes" padded>
              <ul className="list-disc space-y-1 pl-5 text-[12px] text-brand-950">
                {a.quickWins.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Panel>
          )}

          {a.plan.length > 0 && (
            <Panel title="4-week execution roadmap" padded>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {a.plan.map((w) => (
                  <div key={w.week} className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5">
                    <p className="text-[12px] font-bold text-brand-950">{w.week}</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12px] text-brand-600">
                      {w.actions.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {a.dataGaps.length > 0 && (
            <Panel title="Not measured yet (unlock these signals)" padded>
              <ul className="list-disc space-y-1 pl-5 text-[12px] text-brand-600">
                {a.dataGaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      {/* 8. STORED KPI AUDIT TRAIL */}
      {data && (
        <Panel
          title="Figures the report used"
          subtitle="Read directly from stored Search Console and Analytics 4 telemetry. Included in CSV, Markdown, and PDF downloads."
          padded
        >
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12px] text-brand-600 sm:grid-cols-2">
            {data.facts.kpis.map((k) => (
              <li key={`${k.source}-${k.label}`} className="flex items-center gap-2">
                <SourceBadge source={k.source} />
                <span>{k.label}:</span>
                <span className="font-mono font-semibold text-brand-950">
                  {k.value === null
                    ? "not measured"
                    : k.format === "percent"
                      ? `${(k.value * 100).toFixed(1)}%`
                      : k.format === "position"
                        ? k.value.toFixed(1)
                        : Math.round(k.value).toLocaleString("en-US")}
                </span>
                {k.change && <span className="text-brand-400">{k.change}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/* ─────────────────────────── Interactive Evidence Explorer Panel ─────────────────────────── */

function EvidenceExplorerPanel({
  report,
  projectId,
  stagedKeys,
  onStage,
}: {
  report: GoogleReport;
  projectId: string | null;
  stagedKeys: Set<string>;
  onStage: (
    key: string,
    payload: { title: string; category: string; impact: string; deliverable: string; evidence: string; priority?: "HIGH" | "MEDIUM" | "LOW" },
  ) => void;
}) {
  const baseId = useId();
  const { facts } = report;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const defaultTab: EvidenceTab =
    facts.strikingDistance.length > 0
      ? "striking"
      : facts.ctrOpportunities.length > 0
        ? "ctr"
        : facts.topQueries.length > 0
          ? "queries"
          : facts.traffic?.cities?.length
            ? "sources"
            : "pages";
  const [tab, setTab] = useState<EvidenceTab>(defaultTab);

  const tabs: readonly { id: EvidenceTab; label: string; count: number }[] = [
    { id: "striking", label: "Striking Distance (Pos 4–20)", count: facts.strikingDistance.length },
    { id: "ctr", label: "CTR Quick Wins", count: facts.ctrOpportunities.length },
    { id: "queries", label: "Top Queries", count: facts.topQueries.length },
    {
      id: "pages",
      label: "Top Pages & Index",
      count: facts.topPages.length || facts.traffic?.landingPages?.length || 0,
    },
    {
      id: "sources",
      label: "Cities & Sources",
      count: facts.traffic?.cities?.length ?? 0,
    },
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const ids = tabs.map((t) => t.id);
    const idx = ids.indexOf(tab);
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % ids.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = ids.length - 1;
    else return;
    e.preventDefault();
    const nextId = ids[nextIdx];
    setTab(nextId);
    tabRefs.current[nextId]?.focus();
  };

  const botCitySet = new Set(
    (facts.diagnostics?.botAndNoise.suspectedBotCities ?? []).map((c) => c.city.toLowerCase()),
  );
  const targetCitySet = new Set((facts.business?.targetCities ?? []).map((c) => c.toLowerCase()));

  return (
    <Panel
      title="Underlying Search & Traffic Evidence"
      subtitle="Every query, page, city, and source backing this report — draft content or stage fixes directly from any opportunity row"
      padded
    >
      {/* Single-row accessible ARIA tablist with border-bottom underline shape indicator */}
      <div
        role="tablist"
        aria-label="Traffic report evidence datasets"
        className="flex flex-nowrap overflow-x-auto border-b border-brand-200 gap-1 mb-4"
      >
        {tabs.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              id={`${baseId}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={handleKeyDown}
              className={cn(
                "relative shrink-0 px-3.5 py-2.5 text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                selected
                  ? "text-brand-950 after:absolute after:inset-x-0 after:bottom-0 after:border-b-[3px] after:border-primary-600"
                  : "text-brand-500 hover:text-brand-900",
              )}
            >
              <span>{t.label}</span>
              <span className="rounded-full bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-700">
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panel: Striking Distance */}
      <div role="tabpanel" aria-labelledby={`${baseId}-tab-striking`} hidden={tab !== "striking"}>
        {facts.strikingDistance.length === 0 ? (
          <p className="py-4 text-[12px] text-brand-500">
            No striking-distance queries (positions 4–20) recorded in this {facts.days}-day window yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-brand-200 text-[11px] uppercase tracking-wide text-brand-400">
                <tr>
                  <th className="py-2 pr-3">Query</th>
                  <th className="py-2 px-2 text-right">Position</th>
                  <th className="py-2 px-2 text-right">Impressions</th>
                  <th className="py-2 px-2 text-right">Clicks</th>
                  <th className="py-2 px-2 text-right">CTR</th>
                  <th className="py-2 pl-3 text-right">1-Click Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200/70">
                {facts.strikingDistance.slice(0, 10).map((q) => {
                  const stageId = `sd-${q.key}`;
                  const isStaged = stagedKeys.has(stageId);
                  return (
                    <tr key={q.key} className="hover:bg-brand-50/50">
                      <td className="py-2.5 pr-3 font-semibold text-brand-950">{q.key}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-brand-800">#{q.position.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-brand-700">{fmtNum(q.impressions)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-brand-700">{fmtNum(q.clicks)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-brand-700">{fmtPct(q.ctr)}</td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={contentStudioHref(q.key, `Rank Page 1 Guide: ${q.key}`)}
                            className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 hover:bg-brand-100 px-2 py-1 text-[11px] font-semibold text-brand-950"
                          >
                            <PenLine size={11} />
                            <span>Draft</span>
                          </Link>
                          <button
                            type="button"
                            disabled={isStaged || !projectId}
                            onClick={() =>
                              onStage(stageId, {
                                title: `Push "${q.key}" from #${q.position.toFixed(1)} into Top 3`,
                                category: "Organic Search",
                                impact: `Query already gets ${q.impressions} impressions at #${q.position.toFixed(1)}.`,
                                deliverable: `1. Optimize H1/title and buyer FAQ for "${q.key}".\n2. Add 3–5 internal links.\n3. Request re-indexing in Search Console.`,
                                evidence: `GSC: pos ${q.position.toFixed(1)}, ${q.impressions} impressions, ${q.clicks} clicks`,
                              })
                            }
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold cursor-pointer",
                              isStaged
                                ? "border-success-500/30 bg-success-50 text-success-700 cursor-default"
                                : "border-brand-200 bg-surface-1 hover:bg-brand-50 text-brand-950",
                            )}
                          >
                            {isStaged ? <Check size={11} /> : <Wrench size={11} />}
                            <span>{isStaged ? "Staged" : "Stage"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel: CTR Quick Wins */}
      <div role="tabpanel" aria-labelledby={`${baseId}-tab-ctr`} hidden={tab !== "ctr"}>
        {facts.ctrOpportunities.length === 0 ? (
          <p className="py-4 text-[12px] text-brand-500">
            No underperforming CTR opportunities flagged in this {facts.days}-day window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-brand-200 text-[11px] uppercase tracking-wide text-brand-400">
                <tr>
                  <th className="py-2 pr-3">Page / Query</th>
                  <th className="py-2 px-2 text-right">Pos</th>
                  <th className="py-2 px-2 text-right">Impressions</th>
                  <th className="py-2 px-2 text-right">CTR</th>
                  <th className="py-2 px-2">Opportunity</th>
                  <th className="py-2 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200/70">
                {facts.ctrOpportunities.slice(0, 10).map((r) => {
                  const stageId = `ctr-${r.key}`;
                  const isStaged = stagedKeys.has(stageId);
                  return (
                    <tr key={r.key} className="hover:bg-brand-50/50">
                      <td className="py-2.5 pr-3 font-mono text-[11.5px] font-semibold text-brand-950 max-w-xs truncate">
                        {r.key}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">#{r.position.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-right font-mono">{fmtNum(r.impressions)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-warning-700">{fmtPct(r.ctr)}</td>
                      <td className="py-2.5 px-2 text-[11.5px] text-brand-600">{r.extra || "Below expected CTR"}</td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isStaged || !projectId}
                          onClick={() =>
                            onStage(stageId, {
                              title: `Upgrade title & meta snippet CTR on ${r.key}`,
                              category: "Search CTR Optimization",
                              impact: r.extra || `Lift CTR from ${fmtPct(r.ctr)} across ${r.impressions} impressions.`,
                              deliverable: `1. Rewrite <title> tag with clear commercial value hook.\n2. Rewrite meta description with local proof & CTA.\n3. Deploy via Fix Engine and monitor 14-day CTR.`,
                              evidence: `${r.clicks} clicks / ${r.impressions} impressions at pos ${r.position.toFixed(1)}`,
                            })
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold cursor-pointer",
                            isStaged
                              ? "border-success-500/30 bg-success-50 text-success-700 cursor-default"
                              : "border-brand-200 bg-surface-1 hover:bg-brand-50 text-brand-950",
                          )}
                        >
                          {isStaged ? <Check size={11} /> : <Wrench size={11} />}
                          <span>{isStaged ? "Staged" : "Stage Fix"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel: Top Queries */}
      <div role="tabpanel" aria-labelledby={`${baseId}-tab-queries`} hidden={tab !== "queries"}>
        {facts.topQueries.length === 0 ? (
          <p className="py-4 text-[12px] text-brand-500">No Search Console queries recorded in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-brand-200 text-[11px] uppercase tracking-wide text-brand-400">
                <tr>
                  <th className="py-2 pr-3">Query</th>
                  <th className="py-2 px-2 text-right">Clicks</th>
                  <th className="py-2 px-2 text-right">Impressions</th>
                  <th className="py-2 px-2 text-right">CTR</th>
                  <th className="py-2 pl-2 text-right">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200/70">
                {facts.topQueries.slice(0, 12).map((q) => (
                  <tr key={q.key} className="hover:bg-brand-50/50">
                    <td className="py-2 pr-3 font-medium text-brand-950">{q.key}</td>
                    <td className="py-2 px-2 text-right font-mono font-semibold text-brand-950">{fmtNum(q.clicks)}</td>
                    <td className="py-2 px-2 text-right font-mono text-brand-700">{fmtNum(q.impressions)}</td>
                    <td className="py-2 px-2 text-right font-mono text-brand-700">{fmtPct(q.ctr)}</td>
                    <td className="py-2 pl-2 text-right font-mono text-brand-700">#{q.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel: Top Pages & Index Coverage */}
      <div role="tabpanel" aria-labelledby={`${baseId}-tab-pages`} hidden={tab !== "pages"}>
        <div className="space-y-4">
          {facts.index && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3.5 flex flex-wrap items-center gap-4 text-[12px]">
              <span className="font-bold text-brand-950 inline-flex items-center gap-1.5">
                <Globe size={13} className="text-accent-600" />
                GSC Index Coverage:
              </span>
              <span className="font-mono text-success-700 font-semibold">{facts.index.indexed} indexed</span>
              <span className="font-mono text-brand-600">{facts.index.notIndexed} not indexed</span>
              {facts.index.indexableButNotIndexed > 0 && (
                <Pill tone="warn">{facts.index.indexableButNotIndexed} indexable but waiting</Pill>
              )}
            </div>
          )}

          {facts.traffic?.landingPages && facts.traffic.landingPages.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="border-b border-brand-200 text-[11px] uppercase tracking-wide text-brand-400">
                  <tr>
                    <th className="py-2 pr-3">GA4 Landing Page</th>
                    <th className="py-2 px-2 text-right">Sessions</th>
                    <th className="py-2 px-2 text-right">Engagement</th>
                    <th className="py-2 pl-2 text-right">Key Events</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-200/70">
                  {facts.traffic.landingPages.slice(0, 10).map((lp) => (
                    <tr key={lp.page} className="hover:bg-brand-50/50">
                      <td className="py-2 pr-3 font-mono text-[11.5px] font-semibold text-brand-950">{lp.page}</td>
                      <td className="py-2 px-2 text-right font-mono font-semibold">{fmtNum(lp.sessions)}</td>
                      <td className="py-2 px-2 text-right font-mono">{fmtPct(lp.engagementRate)}</td>
                      <td className="py-2 pl-2 text-right font-mono">{lp.keyEvents != null ? fmtNum(lp.keyEvents) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-[12px] text-brand-500">No GA4 landing page breakdown stored for this period yet.</p>
          )}
        </div>
      </div>

      {/* Panel: Cities & Named Sources */}
      <div role="tabpanel" aria-labelledby={`${baseId}-tab-sources`} hidden={tab !== "sources"}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400 mb-2">
              GA4 Top Visitor Cities (Classified)
            </p>
            {facts.traffic?.cities && facts.traffic.cities.length > 0 ? (
              <div className="divide-y divide-brand-200/70 rounded-xl border border-brand-200 bg-surface-1">
                {facts.traffic.cities.map((c) => {
                  const lower = c.city.toLowerCase();
                  const isBot = botCitySet.has(lower);
                  const isTarget = targetCitySet.has(lower);
                  const isNotSet = lower === "(not set)";
                  return (
                    <div key={`${c.city}-${c.country}`} className="flex items-center justify-between gap-2 px-3.5 py-2 text-[12px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-brand-950 truncate">{c.city}</span>
                        <span className="text-[11px] text-brand-400 truncate">{c.country}</span>
                        {isBot && <Pill tone="warn">Datacenter / Bot</Pill>}
                        {isTarget && <Pill tone="good">Target Market</Pill>}
                        {isNotSet && <Pill tone="default">Unresolved IP</Pill>}
                      </div>
                      <span className="font-mono font-semibold text-brand-950 shrink-0">
                        {fmtNum(c.sessions)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-brand-500">No GA4 city sessions recorded yet.</p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400 mb-2">
              Named Traffic Sources (Source / Medium)
            </p>
            {facts.traffic?.sources && facts.traffic.sources.length > 0 ? (
              <div className="divide-y divide-brand-200/70 rounded-xl border border-brand-200 bg-surface-1">
                {facts.traffic.sources.slice(0, 8).map((s) => (
                  <div key={`${s.source}-${s.medium}-${s.channel}`} className="flex items-center justify-between gap-2 px-3.5 py-2 text-[12px]">
                    <div className="min-w-0">
                      <span className="font-mono text-[11.5px] font-semibold text-brand-950">
                        {s.source} / {s.medium}
                      </span>
                      <span className="ml-2 text-[11px] text-brand-500">({s.channel})</span>
                    </div>
                    <span className="font-mono font-semibold text-brand-950 shrink-0">
                      {fmtNum(s.sessions)} · {fmtPct(s.share)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 p-3.5 text-[12px] text-brand-600">
                Refresh Analytics 4 in Integrations or Traffic to pull detailed source/medium rows behind each channel.
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

type Strategy = NonNullable<NonNullable<GoogleReport["analysis"]>["marketingStrategy"]>;

/** Where the traffic comes from, and channel-specific marketing playbooks. */
function MarketingStrategyPanels({
  strategy: m,
  modelName,
}: {
  strategy: Strategy;
  modelName: string | null;
}) {
  if (!m.summary && m.channels.length === 0 && m.whereTrafficComesFrom.length === 0) return null;
  return (
    <>
      <Panel
        title="Where your traffic comes from"
        subtitle={`Measured by Google Analytics 4${modelName ? ` · Analyzed by ${modelName}` : ""}`}
        padded
      >
        {m.summary && <p className="text-[13px] leading-relaxed text-brand-950">{m.summary}</p>}
        {m.whereTrafficComesFrom.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
            {m.whereTrafficComesFrom.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        {m.audience.length > 0 && (
          <>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-brand-400">
              Audience &amp; Geography Signals
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
              {m.audience.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {m.channels.length > 0 && (
        <Panel
          title={`Channel-Specific Marketing Playbooks (${m.channels.length})`}
          subtitle="Tailored diagnosis and concrete playbook for each active channel — plus high-fit channels to launch"
          padded
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {m.channels.map((c) => (
              <div key={c.channel} className="rounded-xl border border-brand-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-bold text-brand-950">{c.channel}</p>
                  <Pill tone={VERDICT[c.verdict].tone}>{VERDICT[c.verdict].label}</Pill>
                  <span className="ml-auto font-mono text-[11px] text-brand-400">{c.share}</span>
                </div>
                {c.whatWeSee && (
                  <p className="mt-2 text-[12px] text-brand-600">
                    <span className="font-semibold text-brand-950">What we see: </span>
                    {c.whatWeSee}
                  </p>
                )}
                {c.strategy && (
                  <p className="mt-1 text-[12px] text-brand-600">
                    <span className="font-semibold text-brand-950">Playbook: </span>
                    {c.strategy}
                  </p>
                )}
                {c.actions.length > 0 && (
                  <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-950">
                    {c.actions.map((x, n) => (
                      <li key={n}>{x}</li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

function WhereWeAre({
  title,
  source,
  side,
  href,
}: {
  title: string;
  source: "GSC" | "GA4";
  side: { verdict: string; points: string[] };
  href: string;
}) {
  return (
    <Panel
      title={`Where you stand: ${title}`}
      actions={
        <Link href={href} className="text-[12px] font-semibold text-accent-700 hover:underline">
          Open {title} →
        </Link>
      }
      padded
    >
      <div className="mb-2">
        <SourceBadge source={source} />
      </div>
      <p className="text-[13px] font-semibold text-brand-950">{side.verdict || "Nothing to report."}</p>
      {side.points.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-brand-600">
          {side.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
