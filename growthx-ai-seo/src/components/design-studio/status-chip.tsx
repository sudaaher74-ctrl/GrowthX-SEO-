"use client";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignStudioStatus } from "@/lib/api-client";

/**
 * The honest status vocabulary, rendered.
 *
 * Two things this must never do: call a change "Published" when it only
 * reached a draft, and call an unscored suggestion "Safe to Publish". So a
 * chip derives from the stored status first, and only falls back to the
 * design-fit band when the change has not moved beyond being a suggestion.
 */

const STATUS_STYLES: Record<DesignStudioStatus, { label: string; className: string; Icon: React.ElementType }> = {
  SUGGESTED: {
    label: "Suggested",
    className: "bg-brand-100 text-brand-600",
    Icon: CircleDashed,
  },
  PREVIEWED: {
    label: "Previewed",
    className: "bg-accent-50 text-accent-700",
    Icon: Clock,
  },
  AWAITING_APPROVAL: {
    label: "Awaiting approval",
    className: "bg-warning-50 text-warning-700",
    Icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    className: "bg-accent-50 text-accent-700",
    Icon: CheckCircle2,
  },
  PUBLISHED: {
    label: "Published",
    className: "bg-success-50 text-success-700",
    Icon: CheckCircle2,
  },
  VERIFIED: {
    label: "Verified",
    className: "bg-success-50 text-success-700",
    Icon: CheckCircle2,
  },
  FAILED: {
    label: "Failed",
    className: "bg-error-50 text-error-700",
    Icon: XCircle,
  },
  ROLLED_BACK: {
    label: "Rolled back",
    className: "bg-brand-100 text-brand-600",
    Icon: RotateCcw,
  },
};

function bandChip(score: number | null) {
  if (score === null) {
    return { label: "Not scored", className: "bg-brand-100 text-brand-500", Icon: CircleDashed };
  }
  if (score >= 90) {
    return { label: "Safe to Publish", className: "bg-success-50 text-success-700", Icon: CheckCircle2 };
  }
  if (score >= 75) {
    return { label: "Need Review", className: "bg-warning-50 text-warning-700", Icon: AlertTriangle };
  }
  return { label: "High Design Risk", className: "bg-error-50 text-error-700", Icon: AlertTriangle };
}

export function StatusChip({
  status,
  score,
  className,
}: {
  status: DesignStudioStatus;
  /** Only consulted while the change is still just a suggestion. */
  score?: number | null;
  className?: string;
}) {
  const stillASuggestion = status === "SUGGESTED" || status === "PREVIEWED";
  const chip =
    stillASuggestion && score !== undefined ? bandChip(score) : STATUS_STYLES[status];
  const Icon = chip.Icon;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        chip.className,
        className,
      )}
    >
      <Icon size={10} />
      {chip.label}
    </span>
  );
}
