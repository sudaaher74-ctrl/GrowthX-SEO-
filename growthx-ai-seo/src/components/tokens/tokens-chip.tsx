"use client";
import Link from "next/link";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTokens, useWorkspace } from "@/hooks/use-growthx";
import { allowanceLeftPct, formatTokens, formatTokensExact, isActive, refillDate, standingOf } from "@/lib/tokens";
import { TokenMeter } from "@/components/tokens/token-meter";

/**
 * The workspace's tokens at a glance, above the user menu in the sidebar.
 *
 * Draws nothing until there is a real answer — while loading, if the request
 * failed, or when the deployment has tokens switched off — rather than a
 * placeholder balance that would be wrong for someone.
 */
export function TokensChip({ onNavigate }: { onNavigate?: () => void }) {
  const { orgId } = useWorkspace();
  const tokens = useTokens(orgId);
  const data = tokens.data;
  if (!isActive(data)) return null;

  const standing = standingOf(data);
  const pct = allowanceLeftPct(data);
  const refills = refillDate(data.allowance.periodEnd);
  const caption =
    standing === "out"
      ? `Used up · refills ${refills}`
      : standing === "low"
        ? `Running low · refills ${refills}`
        : standing === "tracking"
          ? "Usage is counted, not limited"
          : `Refills ${refills}`;

  return (
    <Link
      href="/tokens"
      onClick={onNavigate}
      title={`${formatTokensExact(data.available)} tokens available`}
      className="mx-2 mb-2 block rounded-lg border px-3 py-2.5 transition-colors hover:bg-brand-50"
    >
      <div className="flex items-center gap-1.5">
        <Coins size={13} className={standing === "out" ? "text-error-600" : standing === "low" ? "text-warning-600" : "text-brand-400"} />
        <span className="text-[11px] font-semibold text-brand-700">Tokens</span>
        <span
          className={cn(
            "ml-auto font-mono text-[12px] font-semibold",
            standing === "out" ? "text-error-600" : standing === "low" ? "text-warning-700" : "text-brand-950",
          )}
        >
          {formatTokens(data.available)}
        </span>
      </div>
      {pct !== null && <TokenMeter pct={pct} standing={standing} className="mt-2" />}
      <p className="mt-1.5 text-[10px] text-brand-400">{caption}</p>
    </Link>
  );
}
