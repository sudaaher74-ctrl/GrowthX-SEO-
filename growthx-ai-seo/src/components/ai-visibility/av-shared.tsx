"use client";
import React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackedPromptRow } from "@/lib/api-types";

/**
 * Shared pieces for the AI Visibility views.
 *
 * Nothing in here invents a number. A view that has no measurement renders
 * `EmptyBlock` (or "—") and says what is missing; it never substitutes a
 * placeholder figure.
 */

/** Data a prompt row carries. The API's field names have drifted, so every one is optional. */
export interface AvPrompt {
  id: string;
  text: string;
  category?: string | null;
  cluster?: string | null;
  isActive?: boolean;
  citations?: number;
  sharePct?: number;
  latestChecks?: TrackedPromptRow["latestChecks"];
}

export type Priority = "HIGH" | "MEDIUM" | "LOW";

/** A prioritised, evidence-backed opportunity. Rendered only when the API supplies some. */
export interface AvOpportunity {
  id: string;
  title: string;
  evidence: string;
  model: string | null;
  page: string | null;
  priority: Priority;
  recommendation: string;
  fixable: boolean;
}

export const MODEL_DEFS = [
  { key: "gemini", label: "Gemini", match: ["GEMINI"] },
  { key: "gpt", label: "GPT", match: ["OPENAI", "CHATGPT", "GPT"] },
  { key: "claude", label: "Claude", match: ["ANTHROPIC", "CLAUDE"] },
  { key: "perplexity", label: "Perplexity", match: ["PERPLEXITY"] },
  { key: "grok", label: "Grok", match: ["GROK", "XAI", "X-AI"] },
] as const;

export type ModelKey = (typeof MODEL_DEFS)[number]["key"];

/** Which of the five monitored model families an assistant name belongs to. */
export function modelKeyOf(assistant: string): ModelKey | null {
  const upper = assistant.toUpperCase();
  return MODEL_DEFS.find((m) => m.match.some((x) => upper.includes(x)))?.key ?? null;
}

export const PROMPT_CATEGORIES = [
  { key: "general", label: "General discovery", test: /general|discover/i },
  { key: "product", label: "Product / service", test: /product|service/i },
  { key: "local", label: "Local intent", test: /local|near|location/i },
  { key: "compare", label: "Competitor comparison", test: /compar|versus|vs/i },
  { key: "trust", label: "Trust & purchase", test: /trust|purchase|buy|decision|review/i },
] as const;

export function categoryOf(p: AvPrompt): (typeof PROMPT_CATEGORIES)[number] | null {
  const label = `${p.category ?? ""} ${p.cluster ?? ""}`;
  return PROMPT_CATEGORIES.find((c) => c.test.test(label)) ?? null;
}

/** The monitoring cycle a date falls in: days 1-10, 11-20, 21-end of month. */
export function cycleInfo(now: Date = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = now.getDate();
  const last = new Date(y, m + 1, 0).getDate();
  const index = day <= 10 ? 1 : day <= 20 ? 2 : 3;
  const bounds = { 1: [1, 10], 2: [11, 20], 3: [21, last] }[index] as [number, number];
  const nextStart =
    index === 1 ? new Date(y, m, 11) : index === 2 ? new Date(y, m, 21) : new Date(y, m + 1, 1);
  const fmt = (d: Date) => d.toLocaleDateString("en", { month: "short", day: "numeric" });
  return {
    index,
    label: `Cycle ${index}`,
    range: `${fmt(new Date(y, m, bounds[0]))} – ${fmt(new Date(y, m, bounds[1]))}`,
    nextScan: fmt(nextStart),
  };
}

/** A metric with a one-line plain-language definition, for non-technical readers. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        className="rounded text-brand-300 hover:text-brand-500 focus-visible:text-brand-600 focus-visible:outline-2 focus-visible:outline-primary-600"
      >
        <Info size={12} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-56 -translate-x-1/2 rounded-lg border bg-white p-2.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-brand-600 shadow-card-hover group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}

/** "There is nothing to show here, and this is why." Quiet, in-panel, never a fake chart. */
export function EmptyBlock({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <p className="text-[13px] font-semibold text-brand-950">{title}</p>
      <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-brand-500">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Skeleton row block used while a query is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-brand-100", className)} />;
}

export function pct(n: number | null | undefined): string {
  return n == null || Number.isNaN(n) ? "—" : `${Math.round(n)}%`;
}

export type ConnState = "connected" | "attention" | "disconnected" | "unknown";

/** One integration's real connection status. */
export function ConnectionChip({ label, state, detail }: { label: string; state: ConnState; detail?: string }) {
  const dot = {
    connected: "bg-success-600",
    attention: "bg-warning-500",
    disconnected: "bg-error-600",
    unknown: "bg-brand-300",
  }[state];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1 text-[11.5px] text-brand-700">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
      <span className="font-medium">{label}</span>
      {detail && <span className="text-brand-400">· {detail}</span>}
    </span>
  );
}
