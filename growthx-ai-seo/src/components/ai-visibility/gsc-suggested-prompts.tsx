"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Plus,
  Check,
  Search,
  ArrowUpRight,
  Loader2,
  TrendingUp,
  AlertCircle,
  Eye,
  Sliders,
} from "lucide-react";
import { api, type GscPromptSuggestionItem } from "@/lib/api-client";
import { ActionButton, Panel, Pill } from "@/components/ui/console";
import { cn } from "@/lib/utils";

interface GscSuggestedPromptsProps {
  projectId: string;
  onPromptAdded?: () => void;
}

export function GscSuggestedPromptsSection({
  projectId,
  onPromptAdded,
}: GscSuggestedPromptsProps) {
  const queryClient = useQueryClient();
  const [addingPromptText, setAddingPromptText] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["gsc-prompt-suggestions", projectId],
    queryFn: () => api.getSuggestedPromptsFromGsc(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: (prompts: Array<{
      text: string;
      category?: string;
      journeyStage?: string;
      sourceQuery?: string;
    }>) => api.addPromptsFromSuggestions(projectId, prompts),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["gsc-prompt-suggestions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["ai-visibility", projectId] });
      queryClient.invalidateQueries({ queryKey: ["visibility-journey", projectId] });
      const count = variables.length;
      setToastMessage(
        count === 1
          ? `Added prompt "${variables[0].text.slice(0, 48)}..." to active tracking`
          : `Added ${count} suggested buyer prompts to active tracking`,
      );
      if (onPromptAdded) onPromptAdded();
      setTimeout(() => setToastMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to add prompt";
      setToastMessage(`Error: ${msg}`);
      setTimeout(() => setToastMessage(null), 5000);
    },
    onSettled: () => {
      setAddingPromptText(null);
    },
  });

  const handleAddSingle = (item: GscPromptSuggestionItem) => {
    setAddingPromptText(item.suggestedPrompt);
    addMutation.mutate([
      {
        text: item.suggestedPrompt,
        category: item.category,
        journeyStage: item.journeyStage,
        sourceQuery: item.sourceQuery,
      },
    ]);
  };

  const handleAddBatch = (itemsToAdd: GscPromptSuggestionItem[]) => {
    if (itemsToAdd.length === 0) return;
    addMutation.mutate(
      itemsToAdd.map((item) => ({
        text: item.suggestedPrompt,
        category: item.category,
        journeyStage: item.journeyStage,
        sourceQuery: item.sourceQuery,
      })),
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-line bg-surface-1 p-5 shadow-card">
        <div className="flex items-center gap-2 text-xs text-brand-500">
          <Loader2 size={15} className="animate-spin text-signal-400" />
          <span>Analyzing your last 28 days of Google Search Console queries with Gemini...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  // If GSC is not connected or no data is found
  if (!data.connected) {
    return (
      <div className="rounded-xl border border-line bg-surface-1 p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-brand-600">
              <Search size={16} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-brand-950">
                Auto-discover buyer prompts from Google Search Console
              </h4>
              <p className="mt-0.5 text-xs text-brand-500 leading-relaxed">
                Connect your Google Search Console to automatically convert your highest-traffic buyer queries into conversational questions tracked across ChatGPT, Perplexity, and Gemini.
              </p>
            </div>
          </div>
          <Link
            href="/settings?tab=integrations"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-surface-3 transition"
          >
            <span>Connect Search Console</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  const { suggestions = [], quota } = data;
  const untracked = suggestions.filter((s) => !s.isAlreadyTracked);
  const remainingQuota = quota ? Math.max(0, quota.remaining) : 10;
  const canAddMore = remainingQuota > 0;

  const categories = Array.from(new Set(suggestions.map((s) => s.category))).filter(Boolean);
  const filteredSuggestions = filterCategory === "ALL"
    ? suggestions
    : suggestions.filter((s) => s.category === filterCategory);

  const batchAvailable = untracked.slice(0, remainingQuota);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-card">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2 text-xs font-medium text-brand-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-success-600" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-brand-400 hover:text-brand-700"
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col justify-between gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center bg-surface-1">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-brand-700">
            <Sparkles size={16} className="text-signal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-brand-950">
                Suggested from your Google queries
              </h3>
              <span className="rounded-full bg-signal-400/10 px-2 py-0.5 text-[10px] font-bold text-signal-700">
                {suggestions.length} prompts
              </span>
            </div>
            <p className="text-[11px] text-brand-500">
              Derived from {data.queryCount} real search queries · {data.totalImpressions.toLocaleString()} impressions in the last 28 days
            </p>
          </div>
        </div>

        {/* Quota & Batch Add */}
        <div className="flex flex-wrap items-center gap-2.5">
          {quota && (
            <div className="flex items-center gap-1.5 text-[11px] text-brand-600">
              <span className="text-brand-400">Plan Quota:</span>
              <span className="font-semibold text-brand-950 font-mono">
                {quota.current}/{quota.limit}
              </span>
              {remainingQuota > 0 ? (
                <span className="text-success-600 font-medium">({remainingQuota} left)</span>
              ) : (
                <span className="text-warning-600 font-medium">(Quota full)</span>
              )}
            </div>
          )}

          {canAddMore && batchAvailable.length > 0 && (
            <button
              type="button"
              disabled={addMutation.isPending}
              onClick={() => handleAddBatch(batchAvailable)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition cursor-pointer disabled:opacity-50"
            >
              {addMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Plus size={13} />
              )}
              <span>Add Top {batchAvailable.length}</span>
            </button>
          )}

          {!canAddMore && (
            <Link
              href="/settings?tab=subscription"
              className="inline-flex items-center gap-1 rounded-lg border border-warning-300 bg-warning-50 px-2.5 py-1 text-[11px] font-semibold text-warning-800 hover:bg-warning-100 transition"
            >
              <span>Upgrade for More</span>
              <ArrowUpRight size={12} />
            </Link>
          )}
        </div>
      </div>

      {/* Filter Row */}
      {categories.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface-2/50 px-4 py-2">
          <span className="text-[11px] text-brand-500 font-medium mr-1">Filter:</span>
          <button
            type="button"
            onClick={() => setFilterCategory("ALL")}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10.5px] font-medium transition cursor-pointer",
              filterCategory === "ALL"
                ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                : "border border-line bg-surface-1 text-brand-700 hover:bg-surface-2"
            )}
          >
            All ({suggestions.length})
          </button>
          {categories.map((cat) => {
            const count = suggestions.filter((s) => s.category === cat).length;
            const isSelected = filterCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10.5px] font-medium transition cursor-pointer",
                  isSelected
                    ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                    : "border border-line bg-surface-1 text-brand-700 hover:bg-surface-2"
                )}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Prompts list */}
      <div className="divide-y divide-line max-h-96 overflow-y-auto">
        {filteredSuggestions.map((item, idx) => {
          const isAdding = addingPromptText === item.suggestedPrompt;
          return (
            <div
              key={`${item.suggestedPrompt}-${idx}`}
              className={cn(
                "flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center transition hover:bg-surface-2/40",
                item.isAlreadyTracked ? "bg-surface-2/20 opacity-80" : "bg-surface-1"
              )}
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-brand-950 leading-snug">
                    {item.suggestedPrompt}
                  </span>
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 border border-line">
                    {item.category}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-brand-500">
                  <span className="flex items-center gap-1 font-mono text-[10.5px] text-brand-600">
                    <Search size={11} className="text-brand-400" />
                    <span>query: &quot;{item.sourceQuery}&quot;</span>
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10.5px]">
                    <Eye size={11} className="text-brand-400" />
                    <span>{item.impressions.toLocaleString()} imp</span>
                  </span>
                  {item.clicks > 0 && (
                    <span className="flex items-center gap-1 font-mono text-[10.5px] text-success-600">
                      <TrendingUp size={11} />
                      <span>{item.clicks} clicks</span>
                    </span>
                  )}
                  {item.avgPosition != null && (
                    <span className="text-[10.5px] text-brand-400 font-mono">
                      pos: {item.avgPosition}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0 flex items-center justify-end sm:justify-start">
                {item.isAlreadyTracked ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success-500/10 px-2 py-1 text-[11px] font-medium text-success-700 border border-success-500/20">
                    <Check size={12} />
                    <span>Tracked</span>
                  </span>
                ) : canAddMore ? (
                  <button
                    type="button"
                    disabled={addMutation.isPending || isAdding}
                    onClick={() => handleAddSingle(item)}
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-1 px-2.5 py-1 text-[11px] font-bold text-brand-950 hover:bg-surface-3 transition cursor-pointer disabled:opacity-50"
                  >
                    {isAdding ? (
                      <Loader2 size={12} className="animate-spin text-signal-400" />
                    ) : (
                      <Plus size={12} className="text-signal-400" />
                    )}
                    <span>Add</span>
                  </button>
                ) : (
                  <Link
                    href="/settings?tab=subscription"
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-brand-500 hover:text-brand-900 transition"
                  >
                    <span>Quota Full</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

