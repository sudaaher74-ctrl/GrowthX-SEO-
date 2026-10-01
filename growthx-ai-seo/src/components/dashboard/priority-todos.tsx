import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Code2,
  FileText,
  Globe,
  Heading,
  Layers,
  Link2,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { type FixClass, type IssueGroup, type IssueSeverity } from "@/lib/api-client";
import { SEVERITY_PLAIN, asSentence } from "@/lib/plain-language";
import { cn } from "@/lib/utils";

const SEVERITY = SEVERITY_PLAIN;

export const FIX_CLASS_COPY: Record<FixClass, { label: string; hint: string; cta: string; href: string; note: string }> = {
  AUTO: {
    label: "1-Click AI Fix",
    hint: "Safe automated fix (e.g. metadata, canonicals) ready to deploy via AI.",
    cta: "Prepare AI Fix",
    href: "/fix-engine",
    note: "Opens an automated pull request. Nothing is deployed until you review and merge it.",
  },
  APPROVAL: {
    label: "AI Assisted · Needs Review",
    hint: "AI generated change requiring your review before applying.",
    cta: "Review Proposed Change",
    href: "/fix-engine",
    note: "Shown as before-and-after preview. Changes take effect only upon approval.",
  },
  MANUAL: {
    label: "Manual Optimization",
    hint: "Requires architectural or content edits by you or your developer.",
    cta: "Inspect Affected Pages",
    href: "/website?tab=issues",
    note: "We provide full technical diagnostics and reproduction steps for your team.",
  },
};

export function getIssueMeta(group: IssueGroup) {
  const type = (group.issueType || "").toLowerCase();
  const cat = (group.category || "").toLowerCase();

  if (type.includes("render") || type.includes("js") || cat.includes("render") || cat.includes("code")) {
    return {
      icon: Code2,
      label: "JS & Rendering",
      badgeClass: "bg-warning-50 text-warning-700",
    };
  }
  if (type.includes("head") || type.includes("h1") || type.includes("h2") || cat.includes("heading") || cat.includes("structure")) {
    return {
      icon: Heading,
      label: "Heading Hierarchy",
      badgeClass: "bg-brand-200 text-brand-700",
    };
  }
  if (type.includes("canonical") || type.includes("index") || type.includes("crawl") || type.includes("robot") || type.includes("sitemap") || cat.includes("index")) {
    return {
      icon: Layers,
      label: "Indexing & Canonicals",
      badgeClass: "bg-accent-50 text-accent-700",
    };
  }
  if (type.includes("link") || type.includes("orphan") || type.includes("anchor") || cat.includes("link")) {
    return {
      icon: Link2,
      label: "Internal Links",
      badgeClass: "bg-brand-200 text-brand-700",
    };
  }
  if (type.includes("title") || type.includes("meta") || type.includes("desc") || cat.includes("meta") || cat.includes("content")) {
    return {
      icon: FileText,
      label: "Metadata & Titles",
      badgeClass: "bg-accent-50 text-accent-700",
    };
  }
  if (type.includes("speed") || type.includes("perf") || type.includes("lcp") || type.includes("cls") || cat.includes("perf")) {
    return {
      icon: Zap,
      label: "Core Web Vitals",
      badgeClass: "bg-error-50 text-error-700",
    };
  }
  return {
    icon: AlertTriangle,
    label: group.category || "Technical SEO",
    badgeClass: "bg-brand-200 text-brand-700",
  };
}

export function severityChip(sev: IssueSeverity): string {
  return {
    CRITICAL: "bg-error-50 text-error-700",
    HIGH: "bg-warning-50 text-warning-700",
    MEDIUM: "bg-accent-50 text-accent-700",
    LOW: "bg-brand-200 text-brand-600",
  }[sev];
}

export function TodoRow({
  group,
  rank,
  selected,
  onPick,
}: {
  group: IssueGroup;
  rank: number;
  selected: boolean;
  onPick: () => void;
}) {
  const sev = SEVERITY[group.severity] ?? SEVERITY.LOW;
  const meta = getIssueMeta(group);
  const Icon = meta.icon;
  const isAiReady = group.aiFixAvailable || group.fixClass === "AUTO";

  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={selected}
        className={cn(
          "group flex w-full flex-col gap-2 rounded-xl p-3 text-left transition relative border",
          selected
            ? "bg-brand-50 border-brand-300 shadow-sm ring-1 ring-signal-400/40"
            : "bg-brand-50/50 hover:bg-brand-50 border-brand-200/60 hover:border-brand-300",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold",
                selected ? "bg-signal-400 text-signal-ink" : "bg-brand-200 text-brand-600",
              )}
              aria-hidden
            >
              #{rank}
            </span>
            <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold truncate", meta.badgeClass)}>
              <Icon size={11} className="shrink-0" />
              <span className="truncate">{meta.label}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isAiReady && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-signal-400/15 text-signal-ink px-1.5 py-0.2 text-[9.5px] font-bold border border-signal-400/30">
                <Sparkles size={10} className="text-signal-400" />
                AI
              </span>
            )}
            <span className={cn("rounded-md px-1.5 py-0.2 text-[10px] font-bold", severityChip(group.severity))}>
              {sev.label}
            </span>
          </div>
        </div>

        <p className="text-[12.5px] font-semibold text-brand-950 leading-snug line-clamp-2">
          {group.title}
        </p>

        <div className="flex items-center justify-between pt-1 border-t border-brand-200/50 text-[11px]">
          <span className="inline-flex items-center gap-1 font-medium text-brand-500">
            <Layers size={11} className="text-brand-400 shrink-0" />
            {group.affectedCount} {group.affectedCount === 1 ? "affected page" : "affected pages"}
          </span>

          <span className={cn("inline-flex items-center gap-0.5 text-[10.5px] font-semibold transition", selected ? "text-brand-950" : "text-brand-400 group-hover:text-brand-700")}>
            {selected ? "Active" : "Inspect"}
            <ChevronRight size={11} className={selected ? "text-signal-400" : ""} />
          </span>
        </div>
      </button>
    </li>
  );
}

export function ProblemDetail({ group }: { group: IssueGroup }) {
  const fix = FIX_CLASS_COPY[group.fixClass] ?? FIX_CLASS_COPY.MANUAL;
  const sev = SEVERITY[group.severity] ?? SEVERITY.LOW;
  const meta = getIssueMeta(group);
  const Icon = meta.icon;
  const isAiReady = group.aiFixAvailable || group.fixClass === "AUTO";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-brand-200/70 bg-brand-50 p-4 sm:p-5 text-brand-950 shadow-sm">
      {/* Header with category, severity, and AI badges */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold", meta.badgeClass)}>
              <Icon size={13} className="shrink-0" />
              {meta.label}
            </span>
            <span className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", severityChip(group.severity))}>
              {sev.label}
            </span>
          </div>

          {isAiReady ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-400/15 border border-signal-400/30 px-2.5 py-1 text-[11px] font-bold text-signal-ink">
              <Sparkles size={12} className="text-signal-400 shrink-0" />
              1-Click AI Fix Ready
            </span>
          ) : group.fixClass === "APPROVAL" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 border border-accent-200 px-2.5 py-1 text-[11px] font-bold text-accent-700">
              Assisted Approval
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-200 border border-brand-300 px-2.5 py-1 text-[11px] font-bold text-brand-600">
              Manual Resolution
            </span>
          )}
        </div>

        <h3 className="mt-2 text-[17px] sm:text-[19px] font-bold leading-snug tracking-tight text-brand-950">
          {group.title}
        </h3>
        {group.summary && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-brand-500 max-w-2xl">
            {asSentence(group.summary)}
          </p>
        )}
      </div>

      {/* 3 Metric / Scope Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-brand-100 border border-brand-200/60 p-3">
          <div className="flex items-center justify-between text-brand-400">
            <p className="text-[10px] font-bold uppercase tracking-wider">Affected Footprint</p>
            <Layers size={13} className="text-brand-500" />
          </div>
          <p className="mt-1 text-[20px] font-extrabold tracking-tight text-brand-950 leading-tight">
            {group.affectedCount}
          </p>
          <p className="mt-0.5 text-[10.5px] text-brand-500">
            {group.affectedCount === 1 ? "Isolated single page" : "Sitewide defect pattern"}
          </p>
        </div>

        <div className="rounded-xl bg-brand-100 border border-brand-200/60 p-3">
          <div className="flex items-center justify-between text-brand-400">
            <p className="text-[10px] font-bold uppercase tracking-wider">Resolution Path</p>
            <ArrowUpRight size={13} className="text-brand-500" />
          </div>
          <p className="mt-1 text-[13px] font-bold text-brand-950 truncate leading-tight">
            {fix.label}
          </p>
          <p className="mt-0.5 text-[10.5px] text-brand-500 truncate">
            {fix.hint}
          </p>
        </div>

        <div className="rounded-xl bg-brand-100 border border-brand-200/60 p-3">
          <div className="flex items-center justify-between text-brand-400">
            <p className="text-[10px] font-bold uppercase tracking-wider">Audit Confidence</p>
            <CheckCircle2 size={13} className="text-success-600" />
          </div>
          <p className="mt-1 text-[13px] font-bold text-brand-950 leading-tight">
            {group.confidence === "CONFIRMED" ? "Confirmed Defect" : group.confidence === "LIKELY" ? "Probable Issue" : "Advisory"}
          </p>
          <p className="mt-0.5 text-[10.5px] text-brand-500">
            Verified by Crawler Engine
          </p>
        </div>
      </div>

      {/* Affected Sample URLs Preview */}
      {group.sampleUrls && group.sampleUrls.length > 0 && (
        <div className="rounded-xl bg-brand-100 border border-brand-200/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-brand-700">
              <Globe size={13} className="text-brand-500" />
              <p className="text-[11px] font-bold uppercase tracking-wider">
                Sample Affected Pages ({group.sampleUrls.length})
              </p>
            </div>
            <Link
              href="/website?tab=issues"
              className="text-[10.5px] font-semibold text-brand-500 hover:text-brand-950 hover:underline"
            >
              View in Audit →
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto">
            {group.sampleUrls.map((url, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 border border-brand-200/80 px-2.5 py-1 font-mono text-[11px] text-brand-700 shadow-2xs"
                title={url}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-signal-400 shrink-0" />
                <span className="max-w-[260px] sm:max-w-[340px] truncate">{url}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Resolution Blueprint */}
      {group.action && (
        <div className="rounded-xl bg-brand-100 border border-brand-200/60 p-3.5">
          <div className="flex items-center gap-1.5 text-brand-950 mb-1">
            <Wrench size={13} className="text-brand-500" />
            <p className="text-[11px] font-bold uppercase tracking-wider">How To Fix This</p>
          </div>
          <p className="text-[11.5px] leading-relaxed text-brand-600">
            {asSentence(group.action)}
          </p>
        </div>
      )}

      {/* Bottom CTA Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-brand-200/60">
        <p className="text-[11px] text-brand-500 leading-snug max-w-sm">
          {fix.note}
        </p>
        <Link
          href={fix.href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-signal-400 px-4 py-2 text-[12px] font-bold text-signal-ink transition hover:bg-signal-500 shadow-sm"
        >
          {isAiReady && <Sparkles size={13} className="text-signal-ink" />}
          {fix.cta}
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
