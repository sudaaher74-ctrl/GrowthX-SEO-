"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTokens, useWorkspace } from "@/hooks/use-growthx";
import { formatTokensExact, isActive, refillDate, standingOf } from "@/lib/tokens";

/**
 * Says so, on every screen, when the workspace is out of tokens or nearly.
 *
 * Several features catch a refusal from the AI and quietly fall back to a
 * simpler answer, so without this an empty balance would look like features
 * that mysteriously got worse. It stays off the Tokens page, which already says
 * it, and off entirely when nothing is being limited.
 */
export function TokenBanner() {
  const pathname = usePathname();
  const { orgId } = useWorkspace();
  const tokens = useTokens(orgId);
  const data = tokens.data;

  if (pathname.startsWith("/tokens") || !isActive(data)) return null;
  const standing = standingOf(data);
  if (standing !== "out" && standing !== "low") return null;

  const out = standing === "out";
  const refills = refillDate(data.allowance.periodEnd);

  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-[12.5px]",
        out ? "bg-error-50" : "bg-warning-50",
      )}
    >
      <TriangleAlert size={16} className={cn("mt-0.5 shrink-0", out ? "text-error-600" : "text-warning-600")} />
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold", out ? "text-error-700" : "text-warning-700")}>
          {out ? "You have used all of this month’s tokens" : "You are running low on tokens"}
        </p>
        <p className="mt-0.5 text-brand-600">
          {out
            ? `AI-powered features and local ranking scans will not run until your tokens refill on ${refills}, or an administrator adds more.`
            : `${formatTokensExact(data.available)} left. They refill on ${refills}.`}
        </p>
      </div>
      <Link href="/tokens" className="shrink-0 font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-950">
        See usage
      </Link>
    </div>
  );
}
