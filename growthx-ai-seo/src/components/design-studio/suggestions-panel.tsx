"use client";
import { useMemo, useState } from "react";
import { FileText, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignSuggestion } from "@/lib/api-client";
import { ScrollPanel } from "./scroll-panel";
import { QueryState } from "@/components/ui/query-state";
import { DesignFitRing, labelForScore } from "./design-fit-ring";
import { StatusChip } from "./status-chip";

/**
 * The left column: every suggestion for this project, filtered.
 *
 * Selecting a row is what drives the preview and the inspector, so selection
 * lives in the page and is passed down rather than held here.
 */

const FILTERS = [
  { id: "ALL", label: "All suggestions" },
  { id: "CONTENT", label: "Content" },
  { id: "FAQ", label: "FAQ" },
  { id: "GEO", label: "GEO" },
  { id: "PRODUCT", label: "Product" },
  { id: "SAFE", label: "Safe to publish" },
  { id: "REVIEW", label: "Needs review" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matches(suggestion: DesignSuggestion, filter: FilterId): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "SAFE":
      return suggestion.designFitScore !== null && suggestion.designFitScore >= 90;
    case "REVIEW":
      return suggestion.designFitScore !== null && suggestion.designFitScore < 90;
    case "CONTENT":
      return ["OVERVIEW", "OTHER", "CONTENT"].includes(suggestion.contentType);
    default:
      return suggestion.contentType === filter;
  }
}

export function SuggestionsPanel({
  suggestions,
  isLoading,
  error,
  selectedId,
  onSelect,
}: {
  suggestions: DesignSuggestion[];
  isLoading: boolean;
  error: unknown;
  selectedId: string | null;
  onSelect: (suggestion: DesignSuggestion) => void;
}) {
  const [filter, setFilter] = useState<FilterId>("ALL");

  const visible = useMemo(
    () => suggestions.filter((s) => matches(s, filter)),
    [suggestions, filter],
  );

  return (
    <ScrollPanel
      title="Suggestions"
      actions={
        <label className="relative inline-flex items-center">
          <Filter size={12} className="pointer-events-none absolute left-2 text-brand-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterId)}
            aria-label="Filter suggestions"
            className="appearance-none rounded-lg border bg-white py-1 pl-7 pr-6 text-[11.5px] font-medium text-brand-700 hover:bg-brand-50"
          >
            {FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
                {f.id === "ALL" ? ` (${suggestions.length})` : ""}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <QueryState
          isLoading={isLoading}
          error={error}
          isEmpty={visible.length === 0}
          emptyTitle={
            suggestions.length === 0 ? "No suggestions yet" : "Nothing matches this filter"
          }
          emptyBody={
            suggestions.length === 0
              ? "Analyse a page to find sections where content would help, then generate a change to review."
              : "Try a different filter to see the rest of the suggestions."
          }
        >
          <ul className="space-y-2">
            {visible.map((suggestion) => (
              <li key={suggestion.id}>
                <SuggestionCard
                  suggestion={suggestion}
                  selected={suggestion.id === selectedId}
                  onSelect={() => onSelect(suggestion)}
                />
              </li>
            ))}
          </ul>
        </QueryState>
      </div>
    </ScrollPanel>
  );
}

function SuggestionCard({
  suggestion,
  selected,
  onSelect,
}: {
  suggestion: DesignSuggestion;
  selected: boolean;
  onSelect: () => void;
}) {
  const score = suggestion.designFitScore;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={cn(
        "w-full rounded-xl border bg-white p-3 text-left transition hover:bg-brand-50",
        // The selected row is what the other two columns are showing, so it
        // gets the accent ring rather than a subtle tint.
        selected && "ring-2 ring-accent-600 ring-offset-1 hover:bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <FileText size={13} className="shrink-0 text-brand-400" />
          <span className="truncate text-[12.5px] font-semibold text-brand-950">
            {suggestion.title}
          </span>
        </span>
        <StatusChip score={score} status={suggestion.status} />
      </div>

      <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-brand-500">
        {suggestion.seoIssue} · {suggestion.recommendedLocation}
      </p>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2">
        <span className="flex items-center gap-1.5">
          <DesignFitRing score={score} size={20} strokeWidth={2.5} />
          <span className="text-[10.5px] text-brand-400">Design Fit</span>
          <span className="font-mono text-[11px] font-semibold text-brand-950">
            {score === null ? "—" : `${score}/100`}
          </span>
        </span>
        <span className="font-mono text-[10.5px] text-brand-400">
          {suggestion.currentWordCount} → {suggestion.suggestedWordCount} w
        </span>
      </div>

      {score === null && (
        <p className="mt-1.5 text-[10.5px] text-brand-400">
          {labelForScore(score)} — preview it to measure the fit.
        </p>
      )}
    </button>
  );
}
