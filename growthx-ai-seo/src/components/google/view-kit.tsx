"use client";
import type { UseQueryResult } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Table, Td, Th, Tr } from "@/components/ui/console";
import { FailedState, LoadingState } from "@/components/ui/truthful-state";
import type { GscRow } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { count, percent, position } from "@/lib/google-format";
import { cn } from "@/lib/utils";

/** Search Intent categories */
export type SearchIntent = "transactional" | "commercial" | "informational" | "navigational";

/**
 * Heuristic semantic intent classifier for search queries.
 */
export function detectSearchIntent(query: string): SearchIntent {
  const q = query.toLowerCase().trim();
  if (
    /\b(buy|order|price|pricing|cost|purchase|cheap|affordable|discount|coupon|deal|shop|store|hire|near me|delivery|online order)\b/i.test(q)
  ) {
    return "transactional";
  }
  if (
    /\b(best|top|vs|compare|comparison|review|reviews|alternative|alternatives|services|service|agency|company|software|tool|platform|provider)\b/i.test(q)
  ) {
    return "commercial";
  }
  if (
    /\b(how|what|why|when|where|who|guide|tips|ideas|tutorial|meaning|definition|examples|benefits|recipe|steps|process|explained|diy)\b/i.test(q) ||
    q.endsWith("?")
  ) {
    return "informational";
  }
  return "navigational";
}

/**
 * Visual badge for search intent
 */
export function IntentBadge({ intent }: { intent: SearchIntent }) {
  if (intent === "transactional") {
    return (
      <span className="inline-flex items-center rounded-md border border-success-500/25 bg-success-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-success-700">
        Transactional
      </span>
    );
  }
  if (intent === "commercial") {
    return (
      <span className="inline-flex items-center rounded-md border border-primary-500/25 bg-primary-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">
        Commercial
      </span>
    );
  }
  if (intent === "informational") {
    return (
      <span className="inline-flex items-center rounded-md border border-brand-500/25 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
        Informational
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-brand-500">
      Navigational
    </span>
  );
}

/**
 * Visual rank badge indicating SERP hierarchy
 */
export function PositionBadge({ pos }: { pos: number }) {
  if (pos <= 3) {
    return (
      <span className="inline-flex items-center rounded-md bg-signal-400 px-1.5 py-0.5 font-mono text-[11px] font-bold text-signal-ink shadow-2xs">
        #{position(pos)}
      </span>
    );
  }
  if (pos <= 10) {
    return (
      <span className="inline-flex items-center rounded-md border border-success-500/30 bg-success-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-success-800">
        #{position(pos)}
      </span>
    );
  }
  if (pos <= 20) {
    return (
      <span className="inline-flex items-center rounded-md border border-warning-500/30 bg-warning-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-warning-800">
        #{position(pos)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-brand-500">
      #{position(pos)}
    </span>
  );
}

/** Loading and failure for one stored read; renders `children` only when there is data. */
export function Gate<T>({
  query,
  what,
  children,
}: {
  query: UseQueryResult<T>;
  what: string;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) return <LoadingState compact title={`Loading ${what}…`} message="Reading the stored data for this workspace." />;
  if (query.error || query.data === undefined) {
    return <FailedState title={`Could not load ${what}`} error={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}

export function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold transition shadow-xs cursor-pointer",
        active
          ? "border-signal-400/80 bg-signal-400 text-signal-ink font-bold shadow-xs"
          : "border-brand-200 bg-surface-2 text-brand-700 hover:text-brand-950 hover:bg-surface-3",
      )}
    >
      {children}
    </button>
  );
}

/** Search Console rows (a query or a page) with the four search figures. */
export function SearchRowsTable({
  rows,
  label,
  extra,
  format = (k) => k,
}: {
  rows: GscRow[];
  label: string;
  extra?: { header: string; cell: (row: GscRow) => React.ReactNode }[];
  format?: (key: string) => string;
}) {
  const isQuery = label.toLowerCase().includes("query");

  return (
    <Table minWidth={680 + (extra?.length ?? 0) * 120}>
      <thead>
        <tr>
          <Th>{label}</Th>
          {isQuery && <Th>Intent</Th>}
          <Th align="right">Clicks</Th>
          <Th align="right">Impressions</Th>
          <Th align="right">CTR</Th>
          <Th align="right">Position</Th>
          {extra?.map((e) => (
            <Th key={e.header} align="right">{e.header}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const intent = isQuery ? detectSearchIntent(r.key) : null;
          const ctrVal = r.ctr ?? 0;
          const ctrPercent = (ctrVal * 100).toFixed(1);

          return (
            <Tr key={r.key}>
              <Td>
                <div className="flex items-center gap-1.5">
                  <span className="block max-w-[340px] truncate text-[12px] font-medium text-brand-950" title={r.key}>
                    {format(r.key)}
                  </span>
                  {isQuery && (
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(r.key)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Inspect live Google SERP"
                      className="text-brand-400 hover:text-brand-950 transition-colors"
                    >
                      <ArrowUpRight size={12} />
                    </a>
                  )}
                </div>
              </Td>
              {isQuery && intent && (
                <Td>
                  <IntentBadge intent={intent} />
                </Td>
              )}
              <Td align="right">{count(r.clicks)}</Td>
              <Td align="right">{count(r.impressions)}</Td>
              <Td align="right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="font-mono text-xs text-brand-950">{percent(r.ctr)}</span>
                  <div className="h-1.5 w-8 overflow-hidden rounded-full bg-brand-100">
                    <div
                      className="h-full bg-primary-600 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, ctrVal * 150))}%` }}
                      title={`CTR: ${ctrPercent}%`}
                    />
                  </div>
                </div>
              </Td>
              <Td align="right">
                <PositionBadge pos={r.position} />
              </Td>
              {extra?.map((e) => (
                <Td key={e.header} align="right">{e.cell(r)}</Td>
              ))}
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-[12px] text-brand-500">{children}</p>;
}

/** Shown under a table to say what the view cannot tell you, rather than implying it. */
export function Caveat({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-brand-200/80 px-4 py-2.5 text-[11px] text-brand-500">{children}</p>;
}
