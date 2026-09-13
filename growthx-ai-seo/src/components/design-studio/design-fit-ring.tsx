"use client";
import { cn } from "@/lib/utils";

/**
 * The Design Fit score, as a ring.
 *
 * Not `ui/score-ring.tsx`: that one takes a non-nullable number and colours by
 * health bands. A design fit score has its own bands (90 / 75) and, crucially,
 * can be null — a suggestion that has never been previewed has no score, and
 * showing that as a 0 would read as "terrible fit" instead of "not measured".
 */

export type DesignFitLabel =
  | "Safe to Publish"
  | "Needs Review"
  | "High Design Risk"
  | "Not scored";

export function labelForScore(score: number | null): DesignFitLabel {
  if (score === null) return "Not scored";
  if (score >= 90) return "Safe to Publish";
  if (score >= 75) return "Needs Review";
  return "High Design Risk";
}

/** Ring stroke per band. Muted grey when there is nothing to show. */
function strokeFor(score: number | null): string {
  if (score === null) return "var(--color-brand-300)";
  if (score >= 90) return "var(--color-success-500)";
  if (score >= 75) return "var(--color-warning-500)";
  return "var(--color-error-500)";
}

export function DesignFitRing({
  score,
  size = 34,
  strokeWidth = 3,
  className,
}: {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // A null score draws an empty track, so "not measured" looks different from
  // a measured zero, which fills nothing but is coloured as a failure.
  const filled = score === null ? 0 : (score / 100) * circumference;

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={score === null ? "Not scored" : `Design fit ${score} out of 100`}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-brand-200)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeFor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
    </span>
  );
}

/** Score with its ring and band label, as the inspector shows it. */
export function DesignFitBadge({ score }: { score: number | null }) {
  const label = labelForScore(score);
  return (
    <span className="inline-flex items-center gap-2">
      <DesignFitRing score={score} size={28} />
      <span className="font-mono text-[13px] font-semibold text-brand-950">
        {score === null ? "—" : `${score}/100`}
      </span>
      <span className="text-[11px] text-brand-400">{label}</span>
    </span>
  );
}
