import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type IssueCounts, type IssueSeverity } from "@/lib/api-client";
import { SEVERITY_ORDER, SEVERITY_PLAIN } from "@/lib/plain-language";
import { cn } from "@/lib/utils";

const SEVERITY = SEVERITY_PLAIN;

/**
 * A verdict read straight off the measured score, on the same bands the
 * Website Audit gauge colours by (80 and 50), so the two screens agree.
 */
export function gradeScore(score: number): { label: string; tone: "good" | "warn" | "bad"; line: string } {
  if (score >= 90) return { label: "Excellent", tone: "good", line: "Strong technical health across crawled pages." };
  if (score >= 80) return { label: "Good", tone: "good", line: "Healthy foundation with a few items to polish." };
  if (score >= 50) return { label: "Needs work", tone: "warn", line: "Several issues are limiting visibility on Google." };
  return { label: "Poor", tone: "bad", line: "Critical issues are blocking search visibility." };
}

/** One razor-thin bar split by severity with a quiet inline legend. */
function SeverityBreakdown({ bySeverity, total }: { bySeverity: Record<IssueSeverity, number>; total: number }) {
  return (
    <div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-brand-100" aria-hidden>
        {SEVERITY_ORDER.map((sev) =>
          bySeverity[sev] > 0 ? (
            <div
              key={sev}
              className={cn("rounded-full", SEVERITY[sev].bar)}
              style={{ width: `${(bySeverity[sev] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {SEVERITY_ORDER.map((sev) => (
          <li key={sev} className="flex items-center gap-1.5 text-[11.5px] text-brand-500">
            <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY[sev].bar)} />
            <span>{SEVERITY[sev].label}</span>
            <span className="font-mono font-semibold text-brand-950 tabular-nums">{bySeverity[sev]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PENALTY_CAP_PER_PAGE = 20;

function explainHealthScore(
  score: number,
  openFindings: number,
  bySeverity: Record<IssueSeverity, number>,
): string {
  if (openFindings === 0) return `${score}/100 — nothing to fix.`;

  const dominant = SEVERITY_ORDER.reduce(
    (best, sev) => (bySeverity[sev] > bySeverity[best] ? sev : best),
    SEVERITY_ORDER[0],
  );
  const noun = openFindings === 1 ? "issue" : "issues";

  return (
    `Why ${score} and not lower? ${openFindings} ${noun}, mostly ${SEVERITY[dominant].label.toLowerCase()}. ` +
    `No single page can take away more than ${PENALTY_CAP_PER_PAGE} points.`
  );
}

/** Minimal precision SVG radial score ring */
function CircularScoreGauge({ score }: { score: number | null }) {
  const safeScore = score != null ? Math.max(0, Math.min(score, 100)) : 0;
  const radius = 34;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  const strokeColor =
    score == null
      ? "var(--color-brand-300)"
      : safeScore >= 80
        ? "var(--color-success-500)"
        : safeScore >= 50
          ? "var(--color-warning-500)"
          : "var(--color-error-500)";

  return (
    <div
      className="relative flex h-20 w-20 shrink-0 items-center justify-center"
      role="img"
      aria-label={`Crawl Health Score: ${score != null ? `${score} out of 100` : "not measured"}`}
    >
      <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="var(--color-brand-200)"
          strokeWidth={stroke}
          fill="transparent"
          opacity={0.45}
        />
        {score != null && (
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke={strokeColor}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        )}
      </svg>
      <span className="absolute font-mono text-[17px] font-bold tracking-tight text-brand-950 tabular-nums">
        {score != null ? `${score}/100` : "—"}
      </span>
    </div>
  );
}

export function HealthSummary({
  score,
  counts,
  pagesChecked,
}: {
  score: number | null;
  counts: IssueCounts | null;
  pagesChecked: number | null;
}) {
  const grade = score != null ? gradeScore(score) : null;

  return (
    <div className="flex flex-1 flex-col justify-between gap-5">
      <div className="flex items-center gap-4">
        <CircularScoreGauge score={score} />
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {grade && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  grade.tone === "good"
                    ? "bg-success-50 text-success-700"
                    : grade.tone === "warn"
                      ? "bg-warning-50 text-warning-700"
                      : "bg-error-50 text-error-700",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    grade.tone === "good" ? "bg-success-500" : grade.tone === "warn" ? "bg-warning-500" : "bg-error-500",
                  )}
                  aria-hidden="true"
                />
                {grade.label}
              </span>
            )}
            {pagesChecked != null && (
              <span className="font-mono text-[11px] text-brand-400">
                {pagesChecked} pages
              </span>
            )}
          </div>
          <p className="text-[12.5px] leading-snug text-brand-600">
            {counts ? (
              counts.openFindings === 0 ? (
                <>
                  Nothing to fix
                  {pagesChecked != null && <> across the {pagesChecked} pages we checked</>}.
                </>
              ) : (
                <>
                  <strong className="font-semibold text-brand-950">
                    {counts.openGroups} {counts.openGroups === 1 ? "problem" : "problems"} to fix
                  </strong>
                  , showing up {counts.openFindings} {counts.openFindings === 1 ? "time" : "times"}
                  {pagesChecked != null && <> across the {pagesChecked} pages we checked</>}.
                </>
              )
            ) : (
              grade?.line ?? "Health score calculated from your latest crawl."
            )}
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-brand-100 pt-4">
        {counts && counts.openFindings > 0 && (
          <SeverityBreakdown bySeverity={counts.bySeverity} total={counts.openFindings} />
        )}
        {counts && score != null && counts.openFindings > 0 && (
          <p className="text-[11px] leading-relaxed text-brand-400">
            {explainHealthScore(score, counts.openFindings, counts.bySeverity)}
          </p>
        )}
        {counts && counts.openGroups > 0 && (
          <div className="pt-1">
            <Link
              href="/fix-engine"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-950 hover:text-primary-700 transition"
            >
              <span>Fix {counts.openGroups} issues in Fix Engine</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
