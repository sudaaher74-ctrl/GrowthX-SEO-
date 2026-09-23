"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Radar,
  Radio,
  Flame,
  ShieldAlert,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Code2,
  FileCode,
  Copy,
  Check,
  TrendingUp,
  Filter,
  Loader2,
  X,
  Sparkles,
  Bot,
  Link2Off,
  Braces,
  Heading,
} from "lucide-react";
import {
  useCompetitorStealthRadar,
  useDispatchFindingToQueue,
} from "@/hooks/use-growthx";
import type {
  StealthRadarEvent,
  TrackedCompetitor,
} from "@/lib/api-client";

interface CompetitorStealthRadarTabProps {
  projectId: string;
  customerDomain: string;
  competitors: TrackedCompetitor[];
  onAddToFixPlan?: (count: number, label?: string) => void;
}

export function CompetitorStealthRadarTab({
  projectId,
  customerDomain,
  competitors = [],
  onAddToFixPlan,
}: CompetitorStealthRadarTabProps) {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useCompetitorStealthRadar(projectId);
  const dispatchMutation = useDispatchFindingToQueue(projectId);

  const events = data?.events || [];

  const filteredEvents = useMemo(() => {
    if (filterType === "ALL") return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  const handleCopySnippet = (id: string, snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const handleDispatchEvent = async (event: StealthRadarEvent) => {
    try {
      await dispatchMutation.mutateAsync({
        title: `Stealth Radar: ${event.headline}`,
        summary: `${event.description} Detected on competitor ${event.competitorDomain} (${event.competitorUrl}).`,
        recommendedAction: `${event.counterAction.actionableSummary} Deliverable: ${event.counterAction.label}`,
        potential: event.severity === "MEDIUM" ? "MEDIUM" : "HIGH",
        effort: "LOW",
        category: "COMPETITOR",
        source: "COMPETITOR",
        evidence: [
          { label: "Alert Type", value: event.type, source: "STEALTH_RADAR" },
          { label: "Competitor", value: event.competitorDomain, source: "CRAWLER" },
          { label: "Target URL", value: event.competitorUrl, source: "CRAWLER" },
        ],
        affectedPages: [event.competitorUrl],
      });

      setDispatchedIds((prev) => new Set([...prev, event.id]));
      if (onAddToFixPlan) {
        onAddToFixPlan(1, `Stealth Alert: ${event.headline}`);
      }
    } catch (err) {
      console.error("Failed to dispatch radar event to Action Queue", err);
    }
  };

  const getEventBadge = (type: StealthRadarEvent["type"]) => {
    switch (type) {
      case "BACKLINK_VAMPIRE":
        return {
          label: "404 Backlink Vampire",
          icon: Link2Off,
          badgeClass: "bg-error-50 text-error-600 border-error-200",
        };
      case "SCHEMA_GAP":
        return {
          label: "Schema Vulnerability",
          icon: Braces,
          badgeClass: "bg-warning-50 text-warning-600 border-warning-200",
        };
      case "AI_CITATION_POACH":
        return {
          label: "AI Citation Poach",
          icon: Bot,
          badgeClass: "bg-brand-100 text-brand-800 border-brand-200",
        };
      case "TITLE_PIVOT":
        return {
          label: "Title Tag Pivot Defect",
          icon: Heading,
          badgeClass: "bg-brand-100 text-brand-800 border-brand-200",
        };
      default:
        return {
          label: type,
          icon: Radio,
          badgeClass: "bg-brand-100 text-brand-700 border-brand-200",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER BANNER ── */}
      <div className="relative overflow-hidden rounded-2xl border bg-brand-950 p-6 text-white shadow-md">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wide text-brand-300 backdrop-blur-md">
              <Radar size={12} className="text-brand-400 animate-pulse" />
              <span>LIVE STEALTH RADAR & AI POACHER</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Exploit Competitor Code & Schema Mistakes
            </h2>
            <p className="text-[13px] leading-relaxed text-brand-300/90">
              Monitors competitor DOM changes, missing structured schema, deleted pages with valuable backlinks (404 Vampire), and AI citation deficits. Provides copyable ready-to-deploy assets to claim immediate rankings.
            </p>
          </div>
        </div>

        {/* ── SCOREBOARD METRICS ── */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-5">
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Total Live Alerts</div>
            <div className="text-2xl font-black text-white">
              {data?.scoreboard.activeEventsCount ?? 0}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">High Priority Leaks</div>
            <div className="text-2xl font-black text-error-400">
              {data?.scoreboard.criticalVulnerabilities ?? 0}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">404 Broken Backlinks</div>
            <div className="text-2xl font-black text-warning-400">
              {data?.scoreboard.backlinkOpportunities ?? 0}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">Schema Vulnerabilities</div>
            <div className="text-2xl font-black text-warning-400">
              {events.filter((e) => e.type === "SCHEMA_GAP").length}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-brand-400">AI Citation Gaps</div>
            <div className="text-2xl font-black text-brand-200">
              {data?.scoreboard.aiCitationDeficits ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER BUTTONS ── */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        {[
          { id: "ALL", label: "All Radar Feeds" },
          { id: "BACKLINK_VAMPIRE", label: "404 Backlink Vampires" },
          { id: "SCHEMA_GAP", label: "Schema Gaps" },
          { id: "AI_CITATION_POACH", label: "AI Citation Poaching" },
          { id: "TITLE_PIVOT", label: "Title Tag Pivots" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              filterType === tab.id
                ? "bg-brand-950 text-white shadow-sm"
                : "bg-brand-100 text-brand-700 hover:bg-brand-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── EVENTS LIST ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-white p-12 text-center shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-brand-950" />
          <p className="mt-3 text-sm font-semibold text-brand-700">Scanning competitor telemetry and DOM diffs...</p>
          <p className="text-xs text-brand-500">Checking for deleted pages, missing schemas, and AI search citation deficits</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center shadow-sm">
          <Radar className="mx-auto h-12 w-12 text-brand-300" />
          <h3 className="mt-4 text-base font-bold text-brand-950">Radar Scanning Quiet</h3>
          <p className="mt-1 text-xs text-brand-500 max-w-md mx-auto">
            No active technical vulnerabilities detected in this category. Competitor crawls run continuously to catch DOM changes and 404s.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const badge = getEventBadge(event.type);
            const Icon = badge.icon;
            const isDispatched = dispatchedIds.has(event.id);
            const isCopied = copiedSnippetId === event.id;

            return (
              <div
                key={event.id}
                className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-extrabold ${badge.badgeClass}`}
                    >
                      <Icon size={12} />
                      {badge.label}
                    </span>
                    <span className="text-xs font-semibold text-brand-500">
                      Target: {event.competitorDomain}
                    </span>
                    <span className="rounded bg-brand-100 px-2 py-0.5 font-mono text-[10px] text-brand-600 truncate max-w-xs">
                      {event.competitorUrl}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        event.severity === "MEDIUM"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-error-50 text-error-700"
                      }`}
                    >
                      {event.severity}
                    </span>
                  </div>
                </div>

                {/* Event Description */}
                <div>
                  <h4 className="text-base font-bold text-brand-950">{event.headline}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-brand-600">{event.description}</p>
                </div>

                {/* Counter Tactic Box */}
                <div className="rounded-xl border bg-brand-50 p-4 space-y-1">
                  <div className="flex items-center gap-1 text-xs font-bold text-brand-900">
                    <Zap size={13} className="text-brand-950" />
                    <span>GrowthX Counter-Tactic</span>
                  </div>
                  <p className="text-xs text-brand-700 leading-relaxed">{event.counterAction.actionableSummary}</p>
                </div>

                {/* Copyable Deliverable */}
                <div className="rounded-xl border bg-brand-900 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-300">
                      Deliverable: {event.counterAction.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySnippet(event.id, event.counterAction.codeSnippet)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-success-400 hover:underline"
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{isCopied ? "Copied to Clipboard" : "Copy Deliverable"}</span>
                    </button>
                  </div>
                  <pre className="max-h-36 overflow-y-auto font-mono text-[11px] leading-relaxed text-brand-200 whitespace-pre-wrap">
                    {event.counterAction.codeSnippet}
                  </pre>
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-[11px] text-brand-400">
                    Live Telemetry Sync &bull; Automated SERP radar
                  </span>

                  <div className="flex items-center gap-2">
                    {isDispatched ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1.5 rounded-xl bg-success-500 px-4 py-2 text-xs font-bold text-white shadow-sm"
                      >
                        <Check size={13} />
                        <span>Added to SEO Roadmap</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDispatchEvent(event)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-950 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-brand-900 transition active:scale-95"
                      >
                        <Sparkles size={13} />
                        <span>Add to SEO Roadmap</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
