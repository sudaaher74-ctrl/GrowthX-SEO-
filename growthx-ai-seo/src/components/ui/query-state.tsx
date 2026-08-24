"use client";
import { ApiError } from "@/lib/api-client";

export function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyTitle = "Nothing here yet",
  emptyBody,
  children,
}: {
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  children?: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        ))}
      </div>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-sm font-medium text-red-400">Could not load this data</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{message}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-color)] p-10 text-center">
        <p className="text-sm font-medium text-[var(--text-primary)]">{emptyTitle}</p>
        {emptyBody && <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--text-muted)]">{emptyBody}</p>}
      </div>
    );
  }

  return <>{children}</>;
}
