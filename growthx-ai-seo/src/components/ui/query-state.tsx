"use client";

export function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyTitle = "Nothing here yet",
  emptyBody,
  emptyAction,
  children,
}: {
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  /** Rendered under the empty copy — the one thing that resolves the emptiness. */
  emptyAction?: React.ReactNode;
  children?: React.ReactNode;
}) {
  if (isLoading) {
    // Skeletons used --surface-2 (#fafafa) on a white page, which is a 1%
    // contrast step: a loading screen was indistinguishable from a blank one.
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
