"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  Info,
  Zap,
  Timer,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Layers,
  ExternalLink,
  Search,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { CrawlJob, CrawlPage, CrawlHistoryPoint } from "@/lib/api-client";
import { ActionButton, Panel, Table, Th, Tr, Td } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { stagingEngine } from "@/lib/staging-engine";
import { cn } from "@/lib/utils";

type Metric = "lcpMs" | "inpMs" | "clsScore";

const metrics: Record<Metric, { label: string; unit: string; scale: number }> = {
  lcpMs: { label: "LCP", unit: "s", scale: 1000 },
  inpMs: { label: "INP", unit: "ms", scale: 1 },
  clsScore: { label: "CLS", unit: "", scale: 1 },
};

const measured = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const average = (values: unknown[]) => {
  const valid = values.filter(measured);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

const display = (value: number | null | undefined, scale = 1, digits = 1) =>
  measured(value) ? (value / scale).toFixed(digits) : "—";

type LatencyFilter = "all" | "fast" | "normal" | "slow";

/**
 * Visual Core Web Vital Threshold Meter
 * Accurately plots measured values against official Google CWV rating bands.
 */
function VitalMeter({
  label,
  acronym,
  value,
  displayValue,
  unit,
  goodThreshold,
  poorThreshold,
  maxScale,
  description,
  count,
}: {
  label: string;
  acronym: string;
  value: number | null;
  displayValue: string;
  unit: string;
  goodThreshold: number;
  poorThreshold: number;
  maxScale: number;
  description: string;
  count: number;
}) {
  const hasValue = measured(value);

  // Determine Google rating status
  let status: "good" | "warn" | "bad" | "none" = "none";
  if (hasValue) {
    if (value <= goodThreshold) {
      status = "good";
    } else if (value <= poorThreshold) {
      status = "warn";
    } else {
      status = "bad";
    }
  }

  // Calculate needle position percentage (0% to 100%)
  const percentage = hasValue
    ? Math.min(100, Math.max(0, (value / maxScale) * 100))
    : 0;

  const goodBandPct = (goodThreshold / maxScale) * 100;
  const poorBandPct = ((poorThreshold - goodThreshold) / maxScale) * 100;
  const badBandPct = 100 - goodBandPct - poorBandPct;

  return (
    <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs hover:border-brand-300 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold tracking-tight text-brand-950">{acronym}</span>
            <span className="text-xs text-brand-500 font-normal">· {label}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-brand-400">
            {count > 0 ? `${count} URL${count === 1 ? "" : "s"} measured` : "No lab data"}
          </p>
        </div>

        {/* Status Badge */}
        {status === "good" && (
          <span className="inline-flex items-center gap-1 rounded-md border border-success-200 bg-success-50 px-2 py-0.5 text-[11px] font-bold font-mono text-success-700">
            <CheckCircle2 size={11} aria-hidden="true" /> Good
          </span>
        )}
        {status === "warn" && (
          <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-bold font-mono text-warning-700">
            <AlertTriangle size={11} aria-hidden="true" /> Needs Work
          </span>
        )}
        {status === "bad" && (
          <span className="inline-flex items-center gap-1 rounded-md border border-error-200 bg-error-50 px-2 py-0.5 text-[11px] font-bold font-mono text-error-700">
            <AlertTriangle size={11} aria-hidden="true" /> Poor
          </span>
        )}
        {status === "none" && (
          <span className="inline-flex items-center rounded-md border border-brand-200 bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-brand-500">
            Not recorded
          </span>
        )}
      </div>

      {/* Primary Value */}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-bold tracking-tight text-brand-950">
          {displayValue}
        </span>
        {unit && hasValue && (
          <span className="text-xs font-medium text-brand-500 font-mono">{unit}</span>
        )}
      </div>

      {/* Visual Threshold Bar */}
      <div className="mt-3">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-brand-100 flex">
          <div
            style={{ width: `${goodBandPct}%` }}
            className="h-full bg-success-500/80"
            title={`Good: ≤ ${goodThreshold}${unit}`}
          />
          <div
            style={{ width: `${poorBandPct}%` }}
            className="h-full bg-warning-500/80"
            title={`Needs Work: ${goodThreshold} - ${poorThreshold}${unit}`}
          />
          <div
            style={{ width: `${badBandPct}%` }}
            className="h-full bg-error-500/80"
            title={`Poor: > ${poorThreshold}${unit}`}
          />
        </div>

        {/* Needle Marker */}
        {hasValue && (
          <div className="relative -mt-1 h-2 w-full">
            <div
              className="absolute top-0 -ml-1 h-3 w-2 rounded-xs border border-brand-950 bg-brand-950 shadow-xs"
              style={{ left: `${percentage}%` }}
              title={`Measured: ${displayValue}${unit}`}
            />
          </div>
        )}

        {/* Threshold Labels */}
        <div className="mt-1.5 flex justify-between text-[10px] text-brand-400 font-mono">
          <span>0</span>
          <span className="text-success-600 font-medium">≤{goodThreshold}{unit}</span>
          <span className="text-error-600 font-medium">&gt;{poorThreshold}{unit}</span>
        </div>
      </div>

      {/* Metric Explainer */}
      <p className="mt-3 text-xs leading-5 text-brand-600 border-t border-brand-200/60 pt-2.5">
        {description}
      </p>
    </div>
  );
}

export function PerformanceTab({
  pages,
  historyRuns = [],
}: {
  crawl: CrawlJob | null;
  pages: CrawlPage[];
  historyRuns?: CrawlHistoryPoint[];
}) {
  const { projectId } = useWorkspace();
  const [metric, setMetric] = useState<Metric>("lcpMs");
  const [search, setSearch] = useState("");
  const [latencyFilter, setLatencyFilter] = useState<LatencyFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [stagedTasks, setStagedTasks] = useState<Set<string>>(new Set());
  const [stagedUrls, setStagedUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!projectId) return;
    const existing = stagingEngine.getStaged(projectId);
    setStagedTasks(new Set(existing.map((item) => item.title)));
    setStagedUrls(
      new Set(
        existing
          .map((item) => item.affectedUrl)
          .filter((url): url is string => Boolean(url))
      )
    );
  }, [projectId]);

  const handleStagePlaybook = (type: "lcp" | "cls" | "inp" | "ttfb") => {
    if (!projectId) return;

    let title = "";
    let impact = "";
    let deliverable = "";
    let effort = 2;

    if (type === "lcp") {
      title = "Optimize Largest Contentful Paint (LCP) & Hero Image Preloading";
      impact = "Reduces above-the-fold hero rendering delay by up to 1.5s to improve Google CWV scores.";
      deliverable = [
        "1. Preload hero image using <link rel=\"preload\" as=\"image\" fetchpriority=\"high\">.",
        "2. Compress hero images into next-gen AVIF/WebP formats.",
        "3. Apply responsive srcset to eliminate oversized desktop assets on mobile viewport.",
        "4. Inline critical above-the-fold CSS and eliminate render-blocking stylesheets.",
      ].join("\n");
      effort = 2;
    } else if (type === "cls") {
      title = "Stabilize Cumulative Layout Shift (CLS) & Explicit Dimensions";
      impact = "Eliminates unexpected layout reflows and content shifting during page load.";
      deliverable = [
        "1. Declare explicit width and height attributes or CSS aspect-ratio on all <img> and <iframe> elements.",
        "2. Reserve layout space for dynamic ads and embeds using min-height containers.",
        "3. Apply font-display: optional or swap with matching font fallback metrics.",
        "4. Avoid inserting dynamic top banners or cookies without smooth transitions.",
      ].join("\n");
      effort = 1.5;
    } else if (type === "inp") {
      title = "Optimize Interaction to Next Paint (INP) & Main-Thread Scripting";
      impact = "Unblocks the main JavaScript thread so user taps, clicks, and keystrokes respond in under 200ms.";
      deliverable = [
        "1. Defer third-party tracking scripts and tag managers using requestIdleCallback.",
        "2. Break up long JavaScript tasks (>50ms) using scheduler.yield() or microtask chunking.",
        "3. Debounce rapid input events and avoid heavy synchronous state recalculations in event handlers.",
        "4. Remove unused JavaScript bundles with tree-shaking and dynamic code-splitting.",
      ].join("\n");
      effort = 2.5;
    } else {
      title = "Reduce Server Response Time (TTFB) & Edge Caching";
      impact = "Accelerates HTML delivery and crawl frequency across all pages to under 350ms.";
      deliverable = [
        "1. Configure CDN edge caching with stale-while-revalidate headers.",
        "2. Enable Brotli and Gzip compression on all text/HTML responses.",
        "3. Optimize database queries and connection pooling for dynamic routes.",
        "4. Upgrade server network stack to HTTP/2 or HTTP/3 multiplexing.",
      ].join("\n");
      effort = 2;
    }

    stagingEngine.stage(projectId, {
      title,
      category: "Core Web Vitals",
      source: "TECHNICAL_AUDIT",
      priority: "HIGH",
      impact,
      effortHours: effort,
      deliverable,
      evidence: `Performance Audit · ${type.toUpperCase()} optimization`,
    });

    setStagedTasks((prev) => new Set(prev).add(title));
  };

  const handleStageAllPlaybook = () => {
    if (!projectId) return;
    const types: ("lcp" | "cls" | "inp" | "ttfb")[] = ["lcp", "cls", "inp", "ttfb"];
    types.forEach(handleStagePlaybook);
  };

  const handleStageUrlLatency = (page: CrawlPage) => {
    if (!projectId || !page.responseTimeMs) return;
    const urlPath = (() => {
      try {
        return new URL(page.url).pathname;
      } catch {
        return page.url;
      }
    })();

    const title = `Optimize server response time & TTFB on ${urlPath}`;
    const priority = page.responseTimeMs > 1200 ? "HIGH" : "MEDIUM";
    const impact = `Reduces response time from ${(page.responseTimeMs / 1000).toFixed(2)}s to <350ms to protect crawl budget and ranking stability.`;

    const deliverable = [
      `Target URL: ${page.url}`,
      `Recorded Response Time: ${(page.responseTimeMs / 1000).toFixed(2)}s (${page.responseTimeMs}ms)`,
      "",
      "Optimization Steps:",
      "1. Enable edge CDN response caching for this endpoint.",
      "2. Audit database queries and external API calls performed during page generation.",
      "3. Minify and compress server payload with Brotli/Gzip.",
      "4. Verify HTTP/2 or HTTP/3 connection re-use.",
    ].join("\n");

    stagingEngine.stage(projectId, {
      title,
      category: "Server & Network Latency",
      source: "TECHNICAL_AUDIT",
      priority,
      impact,
      effortHours: 1.5,
      deliverable,
      evidence: `Crawl Latency · ${page.responseTimeMs}ms response time`,
      affectedUrl: page.url,
    });

    setStagedUrls((prev) => new Set(prev).add(page.url));
  };

  // 1. Homepage Vitals Calculation
  const homepagePages = useMemo(
    () =>
      pages.filter((page) => {
        try {
          return new URL(page.url).pathname === "/";
        } catch {
          return false;
        }
      }),
    [pages],
  );

  const values = useMemo(() => {
    const scoreValues = homepagePages.map((page) => page.performance?.performanceScore);
    const lcpValues = homepagePages.map((page) => page.performance?.lcpMs);
    const inpValues = homepagePages.map((page) => page.performance?.inpMs);
    const clsValues = homepagePages.map((page) => page.performance?.clsScore);

    return {
      score: average(scoreValues),
      lcp: average(lcpValues),
      inp: average(inpValues),
      cls: average(clsValues),
      scoreCount: scoreValues.filter(measured).length,
      lcpCount: lcpValues.filter(measured).length,
      inpCount: inpValues.filter(measured).length,
      clsCount: clsValues.filter(measured).length,
      pageCount: homepagePages.filter((page) =>
        [
          page.performance?.performanceScore,
          page.performance?.lcpMs,
          page.performance?.inpMs,
          page.performance?.clsScore,
        ].some(measured),
      ).length,
    };
  }, [homepagePages]);

  // 2. Historical Audits Trend
  const definition = metrics[metric];
  const points = useMemo(
    () =>
      historyRuns
        .filter((run) => run.finishedAt && measured(run.performance?.[metric]))
        .map((run) => ({
          id: run.id,
          date: new Date(run.finishedAt!).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          value: run.performance![metric]! / metrics[metric].scale,
        })),
    [historyRuns, metric],
  );

  // 3. Response Time Distribution Across All Crawled Pages
  const { latencyStats, distributionData } = useMemo(() => {
    const validTimings = pages
      .map((p) => p.responseTimeMs)
      .filter(measured);

    if (!validTimings.length) {
      return {
        latencyStats: null,
        distributionData: [],
      };
    }

    const sorted = [...validTimings].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? avg;

    const fastCount = sorted.filter((v) => v < 350).length;
    const normalCount = sorted.filter((v) => v >= 350 && v <= 700).length;
    const elevatedCount = sorted.filter((v) => v > 700 && v <= 1200).length;
    const slowCount = sorted.filter((v) => v > 1200).length;

    const distribution = [
      {
        bucket: "< 350ms",
        label: "Fast (<350ms)",
        count: fastCount,
        fill: "var(--color-success-500)",
        tone: "good",
      },
      {
        bucket: "350-700ms",
        label: "Normal (350-700ms)",
        count: normalCount,
        fill: "var(--color-primary-600)",
        tone: "accent",
      },
      {
        bucket: "700-1200ms",
        label: "Elevated (700-1200ms)",
        count: elevatedCount,
        fill: "var(--color-warning-500)",
        tone: "warn",
      },
      {
        bucket: "> 1.2s",
        label: "Slow (>1.2s)",
        count: slowCount,
        fill: "var(--color-error-500)",
        tone: "bad",
      },
    ];

    return {
      latencyStats: {
        total: validTimings.length,
        avgMs: Math.round(avg),
        p75Ms: Math.round(p75),
        minMs: Math.round(min),
        maxMs: Math.round(max),
        fastPercent: Math.round((fastCount / validTimings.length) * 100),
        fastCount,
        normalCount,
        elevatedCount,
        slowCount,
      },
      distributionData: distribution,
    };
  }, [pages]);

  // 4. Filtering and Sorting URL Timings Table
  const filtered = useMemo(() => {
    return pages
      .filter((page) => {
        // Search filter
        const matchSearch = `${page.url} ${page.title ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
        if (!matchSearch) return false;

        // Latency filter
        const rt = page.responseTimeMs;
        if (latencyFilter === "fast") return measured(rt) && rt < 350;
        if (latencyFilter === "normal") return measured(rt) && rt >= 350 && rt <= 700;
        if (latencyFilter === "slow") return measured(rt) && rt > 700;
        return true;
      })
      .sort((a, b) => (b.responseTimeMs ?? 0) - (a.responseTimeMs ?? 0));
  }, [pages, search, latencyFilter]);

  const cwvPass =
    values.lcp != null &&
    values.lcp <= 2500 &&
    (values.inp == null || values.inp <= 200) &&
    (values.cls == null || values.cls <= 0.1);

  return (
    <div className="space-y-6">
      {/* Executive Speed & Core Web Vitals Health Ribbon */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-100 text-signal-ink border border-signal-200 shadow-2xs">
              <Zap className="h-5 w-5 fill-signal-400 text-signal-ink" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-brand-950 font-mono">
                  Core Web Vitals &amp; Latency Radar
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold font-mono",
                    cwvPass
                      ? "border-success-200 bg-success-50 text-success-700"
                      : "border-warning-200 bg-warning-50 text-warning-700"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full animate-pulse",
                      cwvPass ? "bg-success-500" : "bg-warning-500"
                    )}
                  />
                  {cwvPass ? "Passing All Thresholds" : "Optimization Recommended"}
                </span>
              </div>
              <p className="text-xs text-brand-500">
                Official Google Lighthouse lab evaluation, response distribution, and 1-click Fix Engine staging.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStageAllPlaybook}
              className="inline-flex items-center gap-1.5 rounded-xl border border-signal-400 bg-signal-400 hover:brightness-105 px-3 py-1.5 text-xs font-bold text-signal-ink shadow-xs transition active:scale-[0.98] cursor-pointer"
              title="Stage LCP, INP, CLS, and TTFB optimization tasks into Fix Engine"
            >
              <Zap size={13} className="fill-signal-ink" />
              <span>Stage Speed Engine Tasks</span>
            </button>
          </div>
        </div>

        {/* 4 Telemetry Metric Capsules */}
        <div className="mt-3.5 pt-3 border-t border-brand-200/60 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-2.5 border border-brand-200/60">
            <div>
              <span className="text-[10px] uppercase font-bold text-brand-400 font-mono block">LCP Speed</span>
              <span className="font-bold text-brand-950 font-mono text-sm">
                {values.lcp != null ? `${(values.lcp / 1000).toFixed(1)}s` : "—"}
              </span>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border",
                values.lcp == null
                  ? "bg-brand-100 text-brand-600 border-brand-200"
                  : values.lcp <= 2500
                  ? "bg-success-50 text-success-700 border-success-200"
                  : values.lcp <= 4000
                  ? "bg-warning-50 text-warning-700 border-warning-200"
                  : "bg-error-50 text-error-700 border-error-200"
              )}
            >
              {values.lcp == null ? "No Data" : values.lcp <= 2500 ? "Good" : values.lcp <= 4000 ? "Needs Work" : "Poor"}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-2.5 border border-brand-200/60">
            <div>
              <span className="text-[10px] uppercase font-bold text-brand-400 font-mono block">INP Latency</span>
              <span className="font-bold text-brand-950 font-mono text-sm">
                {values.inp != null ? `${Math.round(values.inp)}ms` : "—"}
              </span>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border",
                values.inp == null
                  ? "bg-brand-100 text-brand-600 border-brand-200"
                  : values.inp <= 200
                  ? "bg-success-50 text-success-700 border-success-200"
                  : values.inp <= 500
                  ? "bg-warning-50 text-warning-700 border-warning-200"
                  : "bg-error-50 text-error-700 border-error-200"
              )}
            >
              {values.inp == null ? "No Data" : values.inp <= 200 ? "Good" : values.inp <= 500 ? "Needs Work" : "Poor"}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-2.5 border border-brand-200/60">
            <div>
              <span className="text-[10px] uppercase font-bold text-brand-400 font-mono block">CLS Stability</span>
              <span className="font-bold text-brand-950 font-mono text-sm">
                {values.cls != null ? values.cls.toFixed(3) : "—"}
              </span>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border",
                values.cls == null
                  ? "bg-brand-100 text-brand-600 border-brand-200"
                  : values.cls <= 0.1
                  ? "bg-success-50 text-success-700 border-success-200"
                  : values.cls <= 0.25
                  ? "bg-warning-50 text-warning-700 border-warning-200"
                  : "bg-error-50 text-error-700 border-error-200"
              )}
            >
              {values.cls == null ? "No Data" : values.cls <= 0.1 ? "Good" : values.cls <= 0.25 ? "Needs Work" : "Poor"}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-2.5 border border-brand-200/60">
            <div>
              <span className="text-[10px] uppercase font-bold text-brand-400 font-mono block">Avg Latency</span>
              <span className="font-bold text-brand-950 font-mono text-sm">
                {latencyStats ? `${latencyStats.avgMs}ms` : "—"}
              </span>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border",
                !latencyStats
                  ? "bg-brand-100 text-brand-600 border-brand-200"
                  : latencyStats.avgMs < 350
                  ? "bg-success-50 text-success-700 border-success-200"
                  : latencyStats.avgMs <= 700
                  ? "bg-brand-100 text-brand-800 border-brand-200"
                  : "bg-warning-50 text-warning-700 border-warning-200"
              )}
            >
              {!latencyStats ? "No Data" : latencyStats.avgMs < 350 ? "Fast" : latencyStats.avgMs <= 700 ? "Normal" : "Slow"}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: CORE WEB VITALS THRESHOLD METERS */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-brand-950 flex items-center gap-2">
              <Gauge size={18} className="text-primary-700" aria-hidden="true" />
              Core Web Vitals Thresholds
            </h2>
            <p className="text-xs text-brand-600">
              Official Google Web Vitals evaluated against Good, Needs Improvement, and Poor thresholds.
            </p>
          </div>
          {values.score != null && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-200/80 bg-surface-1 px-3 py-1.5 shadow-xs">
              <span className="text-xs text-brand-500">Lighthouse Lab Score</span>
              <span className="font-mono text-sm font-bold text-brand-950">
                {Math.round(values.score)}/100
              </span>
            </div>
          )}
        </div>

        {values.pageCount === 0 ? (
          <Panel padded className="border-dashed">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning-500/10 text-warning-600">
                <Activity size={21} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-brand-950">No PageSpeed results recorded</h3>
                <p className="mt-1 text-sm leading-6 text-brand-600">
                  PageSpeed Insights did not return lab metrics for the homepage during this audit.
                  Core Web Vitals remain blank instead of estimating them from crawler response times.
                </p>
              </div>
            </div>
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {/* LCP METER */}
            <VitalMeter
              acronym="LCP"
              label="Largest Contentful Paint"
              value={values.lcp != null ? values.lcp / 1000 : null}
              displayValue={values.lcp != null ? `${display(values.lcp, 1000)}s` : "—"}
              unit=""
              goodThreshold={2.5}
              poorThreshold={4.0}
              maxScale={6.0}
              count={values.lcpCount}
              description="Measures perceived loading speed. Marks when the page's main hero image or primary headline block has rendered."
            />

            {/* INP METER */}
            <VitalMeter
              acronym="INP"
              label="Interaction to Next Paint"
              value={values.inp}
              displayValue={values.inp != null ? `${display(values.inp, 1, 0)}` : "—"}
              unit="ms"
              goodThreshold={200}
              poorThreshold={500}
              maxScale={800}
              count={values.inpCount}
              description="Measures page responsiveness. Tracks latency for all click, tap, and keyboard interactions throughout the entire visit."
            />

            {/* CLS METER */}
            <VitalMeter
              acronym="CLS"
              label="Cumulative Layout Shift"
              value={values.cls}
              displayValue={values.cls != null ? display(values.cls, 1, 3) : "—"}
              unit=""
              goodThreshold={0.1}
              poorThreshold={0.25}
              maxScale={0.4}
              count={values.clsCount}
              description="Measures visual stability. Tracks sudden unexpected layout jumps caused by unsized banners, embeds, or dynamic fonts."
            />
          </div>
        )}
      </div>

      {/* SECTION 2: CRAWL RESPONSE TIME DISTRIBUTION */}
      {latencyStats && (
        <Panel
          title="Crawl Response Time Distribution"
          subtitle={`Latency distribution across all ${latencyStats.total} crawled URLs. Crawl fetch duration includes server processing and network latency.`}
          padded
        >
          {/* Quick Latency Stats Header */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-line bg-surface-2/40 p-3">
              <span className="text-[11px] font-medium text-brand-500">Fast Pages (&lt; 350ms)</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold text-success-700">
                  {latencyStats.fastPercent}%
                </span>
                <span className="text-xs text-brand-500">({latencyStats.fastCount} URLs)</span>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2/40 p-3">
              <span className="text-[11px] font-medium text-brand-500">Average Response Time</span>
              <div className="mt-1 font-mono text-xl font-bold text-brand-950">
                {latencyStats.avgMs}ms
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2/40 p-3">
              <span className="text-[11px] font-medium text-brand-500">75th Percentile (p75)</span>
              <div className="mt-1 font-mono text-xl font-bold text-brand-950">
                {latencyStats.p75Ms}ms
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2/40 p-3">
              <span className="text-[11px] font-medium text-brand-500">Slowest Measured URL</span>
              <div className="mt-1 font-mono text-xl font-bold text-brand-950">
                {latencyStats.maxMs}ms
              </div>
            </div>
          </div>

          {/* Recharts Bar Distribution */}
          <div
            className="h-56 min-w-0"
            role="img"
            aria-label="Crawl latency distribution bar chart across tested URLs"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="var(--color-brand-100)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-brand-50)" }}
                  formatter={(val: unknown) => [`${val} URLs`, "Page Count"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* SECTION 3: SPEED & CWV ACTIONABLE PLAYBOOK */}
      <Panel
        title="Web Performance Optimization Playbook"
        subtitle="Actionable Next.js and frontend engineering patterns to optimize Core Web Vitals and lower crawl latency."
        padded
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* LCP */}
          <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs hover:border-brand-300 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-signal-500">
                <Zap size={16} aria-hidden="true" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-950 font-mono">
                  LCP · Image Preload
                </h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-brand-600">
                Use Next.js <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] border border-brand-200">&lt;Image priority&gt;</code> for the above-the-fold hero image. Enable modern AVIF/WebP formats to cut hero byte size by up to 60%.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-brand-200/60">
              {stagedTasks.has("Optimize Largest Contentful Paint (LCP) & Hero Image Preloading") ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success-700 font-mono">
                  <CheckCircle2 size={12} className="text-success-600" />
                  <span>Staged to Fix Engine</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStagePlaybook("lcp")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 hover:bg-surface-3 py-1.5 text-xs font-bold text-brand-950 shadow-2xs transition active:scale-[0.98] cursor-pointer"
                >
                  <Zap size={12} className="text-signal-400 fill-signal-400" />
                  <span>Stage LCP Fix</span>
                </button>
              )}
            </div>
          </div>

          {/* CLS */}
          <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs hover:border-brand-300 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-warning-600">
                <Layers size={16} aria-hidden="true" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-950 font-mono">
                  CLS · Aspect Ratios
                </h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-brand-600">
                Declare explicit <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] border border-brand-200">width</code> and <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] border border-brand-200">height</code> or CSS <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] border border-brand-200">aspect-ratio</code> on images and embedded cards so the browser reserves geometry before assets load.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-brand-200/60">
              {stagedTasks.has("Stabilize Cumulative Layout Shift (CLS) & Explicit Dimensions") ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success-700 font-mono">
                  <CheckCircle2 size={12} className="text-success-600" />
                  <span>Staged to Fix Engine</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStagePlaybook("cls")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 hover:bg-surface-3 py-1.5 text-xs font-bold text-brand-950 shadow-2xs transition active:scale-[0.98] cursor-pointer"
                >
                  <Zap size={12} className="text-signal-400 fill-signal-400" />
                  <span>Stage CLS Fix</span>
                </button>
              )}
            </div>
          </div>

          {/* INP */}
          <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs hover:border-brand-300 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-success-600">
                <Timer size={16} aria-hidden="true" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-950 font-mono">
                  INP · Script Deferral
                </h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-brand-600">
                Load analytics, chatbots, and tag managers with <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] border border-brand-200">strategy=&quot;afterInteractive&quot;</code> or <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] border border-brand-200">lazyOnload</code> to keep the main thread unblocked for immediate user inputs.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-brand-200/60">
              {stagedTasks.has("Optimize Interaction to Next Paint (INP) & Main-Thread Scripting") ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success-700 font-mono">
                  <CheckCircle2 size={12} className="text-success-600" />
                  <span>Staged to Fix Engine</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStagePlaybook("inp")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 hover:bg-surface-3 py-1.5 text-xs font-bold text-brand-950 shadow-2xs transition active:scale-[0.98] cursor-pointer"
                >
                  <Zap size={12} className="text-signal-400 fill-signal-400" />
                  <span>Stage INP Fix</span>
                </button>
              )}
            </div>
          </div>

          {/* TTFB */}
          <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs hover:border-brand-300 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-brand-700">
                <Gauge size={16} aria-hidden="true" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-950 font-mono">
                  TTFB · Edge Caching
                </h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-brand-600">
                Serve static HTML and edge responses via CDN caching. Ensure HTTP/2 or HTTP/3 multiplexing and Brotli compression are active to reduce crawl response times.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-brand-200/60">
              {stagedTasks.has("Reduce Server Response Time (TTFB) & Edge Caching") ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success-700 font-mono">
                  <CheckCircle2 size={12} className="text-success-600" />
                  <span>Staged to Fix Engine</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStagePlaybook("ttfb")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 hover:bg-surface-3 py-1.5 text-xs font-bold text-brand-950 shadow-2xs transition active:scale-[0.98] cursor-pointer"
                >
                  <Zap size={12} className="text-signal-400 fill-signal-400" />
                  <span>Stage TTFB Fix</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* SECTION 4: HISTORICAL AUDITS TREND */}
      <Panel
        title="Homepage Core Web Vitals Trend"
        subtitle="Historical measurements recorded across completed audits. Missing values are omitted."
        padded
      >
        <label className="mb-4 flex flex-wrap items-center gap-3 text-xs text-brand-600">
          Metric
          <select
            aria-label="Trend metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-brand-950"
          >
            {Object.entries(metrics).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}{item.unit ? ` (${item.unit})` : ""}
              </option>
            ))}
          </select>
          <span>{points.length} measured audit{points.length === 1 ? "" : "s"}</span>
        </label>

        {!points.length ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
            <p className="text-sm font-medium text-brand-700">No {definition.label} history yet</p>
            <p className="mt-1 text-xs text-brand-500">
              A trend appears after PageSpeed measurements are recorded for completed audits.
            </p>
          </div>
        ) : (
          <>
            {points.length === 1 && (
              <p className="mb-3 text-xs text-brand-500">
                One measured audit is available. At least two are needed to show a trend line.
              </p>
            )}
            <div
              className="h-60 min-w-0"
              role="img"
              aria-label={`${definition.label} values for the homepage from completed audits`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="var(--color-brand-100)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis unit={definition.unit} tick={{ fontSize: 10 }} domain={[0, "auto"]} />
                  <Tooltip />
                  <Line
                    dataKey="value"
                    name={`Homepage ${definition.label}${definition.unit ? ` (${definition.unit})` : ""}`}
                    stroke="var(--color-primary-600)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3 text-xs text-brand-600">
              <summary className="cursor-pointer font-medium hover:text-brand-950">View recorded values</summary>
              <ul className="mt-2 space-y-1">
                {points.map((point) => (
                  <li key={point.id}>
                    {point.date}: {point.value.toFixed(metric === "clsScore" ? 3 : 1)}{definition.unit}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </Panel>

      {/* SECTION 5: AUDITED URL TIMINGS TABLE */}
      <Panel
        title="Audited URL Timings & Latency"
        subtitle="Crawler response times across all discovered URLs. Use the filter ribbon and search to isolate high latency pages."
        padded
      >
        {/* Controls Ribbon */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Latency Segmented Filter */}
          <div className="flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setLatencyFilter("all");
                setShowAll(false);
              }}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                latencyFilter === "all"
                  ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200/80 font-bold"
                  : "text-brand-600 hover:text-brand-950"
              }`}
            >
              All URLs ({pages.length})
            </button>
            {latencyStats && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setLatencyFilter("fast");
                    setShowAll(false);
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    latencyFilter === "fast"
                      ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200/80 font-bold"
                      : "text-brand-600 hover:text-brand-950"
                  }`}
                >
                  Fast &lt;350ms ({latencyStats.fastCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLatencyFilter("normal");
                    setShowAll(false);
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    latencyFilter === "normal"
                      ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200/80 font-bold"
                      : "text-brand-600 hover:text-brand-950"
                  }`}
                >
                  Normal ({latencyStats.normalCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLatencyFilter("slow");
                    setShowAll(false);
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    latencyFilter === "slow"
                      ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200/80 font-bold"
                      : "text-brand-600 hover:text-brand-950"
                  }`}
                >
                  Slow &gt;700ms ({latencyStats.elevatedCount + latencyStats.slowCount})
                </button>
              </>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              type="search"
              aria-label="Search speed URLs"
              placeholder="Filter by path or title..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setShowAll(false);
              }}
              className="w-full rounded-lg border border-brand-200 bg-surface-1 pl-8 pr-3 py-1.5 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-none focus:border-brand-400"
            />
          </div>
        </div>

        {/* Table */}
        <Table minWidth={650}>
          <thead>
            <tr>
              <Th>Audited URL</Th>
              <Th>LCP</Th>
              <Th>INP</Th>
              <Th>CLS</Th>
              <Th>Crawl Latency</Th>
              <Th align="right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {(showAll ? filtered : filtered.slice(0, 10)).map((page) => {
              const rt = page.responseTimeMs;
              const hasRt = measured(rt);

              return (
                <Tr key={page.id}>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-xs font-mono text-primary-700 hover:underline"
                      >
                        {page.url}
                      </a>
                      <ExternalLink size={11} className="shrink-0 text-brand-400" />
                    </div>
                    {page.title && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-brand-500 font-sans">
                        {page.title}
                      </p>
                    )}
                  </Td>
                  <Td>
                    {measured(page.performance?.lcpMs) ? (
                      <span className="font-mono text-xs font-semibold text-brand-950">
                        {display(page.performance?.lcpMs, 1000)}s
                      </span>
                    ) : (
                      <span className="text-brand-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {measured(page.performance?.inpMs) ? (
                      <span className="font-mono text-xs font-semibold text-brand-950">
                        {display(page.performance?.inpMs, 1, 0)}ms
                      </span>
                    ) : (
                      <span className="text-brand-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {measured(page.performance?.clsScore) ? (
                      <span className="font-mono text-xs font-semibold text-brand-950">
                        {display(page.performance?.clsScore, 1, 3)}
                      </span>
                    ) : (
                      <span className="text-brand-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {hasRt ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-brand-950">
                          {display(rt, 1000, 2)}s
                        </span>
                        {rt < 350 ? (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold font-mono bg-success-50 text-success-700 border border-success-200">
                            Fast
                          </span>
                        ) : rt <= 700 ? (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium font-mono bg-surface-2 text-brand-800 border border-brand-200">
                            Normal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold font-mono bg-warning-50 text-warning-700 border border-warning-200">
                            Slow
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-brand-400">—</span>
                    )}
                  </Td>
                  <Td align="right">
                    {stagedUrls.has(page.url) ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-success-200 bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-700 font-mono">
                        <CheckCircle2 size={10} className="text-success-600" />
                        <span>Staged</span>
                      </span>
                    ) : (hasRt && rt > 700) ? (
                      <button
                        type="button"
                        onClick={() => handleStageUrlLatency(page)}
                        className="inline-flex items-center gap-1 rounded-md border border-signal-300 bg-signal-100 hover:bg-signal-200 px-2 py-0.5 text-[10px] font-bold text-signal-ink transition cursor-pointer shadow-2xs active:scale-[0.98]"
                        title="Stage server latency optimization into Fix Engine"
                      >
                        <Zap size={10} className="fill-signal-400 text-signal-ink" />
                        <span>Stage Fix</span>
                      </button>
                    ) : (
                      <span className="text-brand-300">—</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>

        {!filtered.length && (
          <p className="py-8 text-center text-sm text-brand-500">
            {search
              ? "No audited URLs match your search."
              : "No URL records match the selected latency tier."}
          </p>
        )}

        {filtered.length > 10 && (
          <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
            <span className="text-xs text-brand-500">
              Showing {showAll ? filtered.length : 10} of {filtered.length} URLs
            </span>
            <ActionButton onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer URLs" : `Show all ${filtered.length} URLs`}
            </ActionButton>
          </div>
        )}
      </Panel>
    </div>
  );
}
