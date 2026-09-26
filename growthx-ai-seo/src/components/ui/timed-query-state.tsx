"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "@/components/ui/console";

/**
 * QueryState, plus the one thing it is missing: a loading state that does
 * not run forever.
 *
 * The Gaps and Rival Radar tabs in Competitor Intelligence show a bare
 * "Comparing your website…" / "Looking at what your competitors changed…"
 * string with no timeout, because the underlying api-client `request()` has
 * no AbortController — a hung backend leaves that spinner on screen with no
 * way out. Business's Gaps and Marketing Signals tabs are exactly this kind
 * of AI/multi-source computation, so they get the fix here rather than
 * inheriting the bug: past `slowAfterMs`, this swaps the skeleton for an
 * explicit "taking longer than usual" message with a manual retry.
 *
 * Deliberately a separate component rather than a change to QueryState
 * itself — fixing api-client.ts's `request()` for every caller is a larger,
 * riskier change than this feature needs, and is worth doing as its own
 * follow-up rather than folded into this one.
 */
export function TimedQueryState({
  isLoading,
  error,
  isEmpty,
  emptyTitle = "Nothing here yet",
  emptyBody,
  emptyAction,
  onRetry,
  slowAfterMs = 15000,
  children,
}: {
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: React.ReactNode;
  /** Called when the person clicks "Try again" after the slow message appears. */
  onRetry: () => void;
  slowAfterMs?: number;
  children?: React.ReactNode;
}) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setIsSlow(true), slowAfterMs);
    // Cleanup, not the effect body: a fresh loading spell (isLoading flipping
    // true → false → true, e.g. on retry) must start its own 15s clock, not
    // inherit "already slow" from the one before it.
    return () => {
      clearTimeout(timer);
      setIsSlow(false);
    };
  }, [isLoading, slowAfterMs]);

  if (isLoading) {
    if (isSlow) {
      return (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center">
          <p className="text-[13px] font-semibold text-brand-950">This is taking longer than usual</p>
          <p className="mx-auto mt-1.5 max-w-md text-[12px] text-brand-500">
            There&apos;s a lot to analyze, or the connection is slow. You can keep waiting or try again.
          </p>
          <div className="mt-4 flex justify-center">
            <ActionButton onClick={onRetry}>Try again</ActionButton>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-brand-100" />
        ))}
      </div>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return (
      <div className="rounded-xl border bg-error-50 p-6 text-center">
        <p className="text-[13px] font-semibold text-error-700">Could not load this data</p>
        <p className="mt-1 text-[11.5px] text-brand-600">{message}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-dashed bg-white p-10 text-center">
        <p className="text-[14px] font-semibold text-brand-950">{emptyTitle}</p>
        {emptyBody && <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-brand-500">{emptyBody}</p>}
        {emptyAction && <div className="mt-4 flex justify-center gap-2">{emptyAction}</div>}
      </div>
    );
  }

  return <>{children}</>;
}
