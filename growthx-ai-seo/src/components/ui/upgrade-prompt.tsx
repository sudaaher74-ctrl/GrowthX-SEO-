"use client";
import { Lock, TrendingUp } from "lucide-react";
import { ApiError, UpgradePayload } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Renders the backend's 403 upgrade payload.
 *
 * The API already says which plan unlocks the thing and what it costs, so the
 * UI shows exactly that rather than a generic "upgrade" wall that leaves the
 * customer guessing.
 */
export function UpgradePrompt({ upgrade }: { upgrade: UpgradePayload }) {
  const isQuota = upgrade.error === "QUOTA_EXCEEDED";

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
        {isQuota ? <TrendingUp size={22} /> : <Lock size={22} />}
      </div>

      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
        {isQuota ? "You've used this month's allowance" : "Not included in your plan"}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">{upgrade.message}</p>

      {isQuota && typeof upgrade.used === "number" && upgrade.limit != null && (
        <p className="mt-3 font-mono text-xs text-[var(--text-muted)]">
          {upgrade.used.toLocaleString()} / {upgrade.limit.toLocaleString()} used
        </p>
      )}

      {upgrade.upgradeTo && (
        <div className="mt-6">
          <Link href="/billing">
            <Button variant="primary" size="sm">
              Upgrade to {upgrade.upgradeTo.name} — {upgrade.upgradeTo.price}/mo
            </Button>
          </Link>
          {upgrade.upgradeTo.limit != null && isQuota && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {upgrade.upgradeTo.name} includes {upgrade.upgradeTo.limit.toLocaleString()} per month.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Standard states for a data page: loading, plan-gated, failed, or empty.
 * Returns null when there is nothing to say and the caller should render data.
 */
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

  if (error instanceof ApiError && error.upgrade) {
    return <UpgradePrompt upgrade={error.upgrade} />;
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
