"use client";

import { Loader2, Search, ArrowUp, Telescope } from "lucide-react";

/* ── the ask surface ────────────────────────────────────────────── */

export function EmptyState({ prompts, onPick }: { prompts: string[]; onPick: (q: string) => void }) {
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-gradient-to-b from-[var(--surface-1)] to-[var(--surface-2)] p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
        <Telescope size={22} />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        What do you want to know about this market?
      </h3>
      <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-[var(--text-muted)]">
        The answer is built from this client&apos;s own crawl and a live web search, and every claim
        carries a numbered citation you can open. Anything the evidence does not support is labelled
        an inference rather than stated as fact.
      </p>

      <div className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-2.5 text-left md:grid-cols-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPick(prompt)}
            className="flex items-start gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-3 text-left text-xs text-[var(--text-primary)] transition-all hover:border-blue-500/40 hover:shadow-sm"
          >
            <Search size={13} className="mt-0.5 shrink-0 text-blue-500" />
            <span className="leading-relaxed">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Composer({
  value,
  onChange,
  onSubmit,
  isPending,
  isFollowUp,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  isFollowUp: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="sticky bottom-4 z-10"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-2 shadow-lg shadow-black/5 focus-within:border-blue-500/40 focus-within:ring-2 focus-within:ring-blue-500/10">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — the convention in
            // every chat surface these operators already use.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          rows={1}
          disabled={isPending}
          placeholder={isFollowUp ? "Ask a follow-up…" : "Ask about this client's market…"}
          className="max-h-40 min-h-[38px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isPending || !value.trim()}
          title="Research (Enter)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm transition hover:opacity-95 disabled:opacity-40"
        >
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={15} strokeWidth={2.5} />}
        </button>
      </div>
    </form>
  );
}

