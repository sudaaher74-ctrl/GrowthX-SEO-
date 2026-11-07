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
export function TokensChip({ onNavigate, variant = "card" }: { onNavigate?: () => void; variant?: "card" | "bar" | "icon" }) {
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

  if (variant === "icon") {
    const description = `${formatTokens(data.available)} tokens · ${caption}`;
    return (
      <div className="group relative mx-auto mb-2 flex justify-center">
        <Link
          href="/tokens"
          onClick={onNavigate}
          aria-label={description}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-brand-200/80 bg-surface-2/80 text-brand-500 transition hover:border-brand-300 hover:bg-surface-2 hover:text-brand-950"
        >
          <Coins
            size={16}
            aria-hidden="true"
            className={standing === "out" ? "text-error-600" : standing === "low" ? "text-warning-600" : "text-brand-500"}
          />
          <span
            className={cn(
              "absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full",
              standing === "out" ? "bg-error-500" : standing === "low" ? "bg-warning-500" : "bg-signal-400",
            )}
          />
          <span className="sr-only">{description}</span>
        </Link>
        <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 text-[11px] font-semibold text-brand-950 shadow-lg group-hover:flex group-hover:items-center group-hover:gap-2">
          <span>Tokens: {formatTokens(data.available)}</span>
          <span className="text-[10px] font-normal text-brand-400">· {caption}</span>
        </div>
      </div>
    );
  }

  if (variant === "bar") {
    // Top bar compact pill: sits beside the theme toggle in the header navbar.
    return (
      <Link
        href="/tokens"
        onClick={onNavigate}
        title={`${formatTokensExact(data.available)} tokens available · ${caption}`}
        className="flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-xs text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-950 focus-visible:outline-2 focus-visible:outline-primary-600"
        style={{ borderColor: "var(--border-color)" }}
      >
        <Coins
          size={13}
          className={cn(
            "shrink-0",
            standing === "out"
              ? "text-error-600"
              : standing === "low"
                ? "text-warning-600"
                : "text-signal-400",
          )}
        />
        <span className="hidden sm:inline text-[11px] font-semibold text-brand-600">
          AI Compute
        </span>
        <span
          className={cn(
            "font-mono text-[11.5px] font-bold leading-none",
            standing === "out"
              ? "text-error-600"
              : standing === "low"
                ? "text-warning-700"
                : "text-brand-950",
          )}
        >
          {formatTokens(data.available)}
        </span>
        <span className="hidden xl:inline text-[10.5px] text-brand-400">
          · {caption}
        </span>
        <span className="sr-only xl:hidden">
          · {caption}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/tokens"
      onClick={onNavigate}
      title={`${formatTokensExact(data.available)} tokens available`}
      className="mx-2.5 mb-2.5 block rounded-xl border border-brand-200 bg-surface-2/80 p-3 shadow-2xs transition-all hover:border-brand-300 hover:bg-surface-2"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
          <Coins size={12} className={standing === "out" ? "text-error-600" : standing === "low" ? "text-warning-600" : "text-brand-600"} />
        </span>
        <span className="text-[11px] font-semibold text-brand-700">AI Compute</span>
        <span
          className={cn(
            "ml-auto rounded-md bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] font-bold border border-brand-200/70",
            standing === "out" ? "text-error-600" : standing === "low" ? "text-warning-700" : "text-brand-950",
          )}
        >
          {formatTokens(data.available)}
        </span>
      </div>
      {pct !== null && <TokenMeter pct={pct} standing={standing} className="mt-2.5" />}
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-brand-400">
        <span>{caption}</span>
        {pct !== null && <span className="font-mono font-medium text-brand-500">{Math.round(pct)}%</span>}
      </div>
    </Link>
  );
}
