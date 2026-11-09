import React from "react";
import { type IssueCounts, type IssueSeverity } from "@/lib/api-client";
import { SEVERITY_ORDER, SEVERITY_PLAIN } from "@/lib/plain-language";
import { cn } from "@/lib/utils";

const SEVERITY = SEVERITY_PLAIN;

/**
 * A verdict read straight off the measured score, on the same bands the
 * Website Audit gauge colours by (80 and 50), so the two screens agree.
 */
export function gradeScore(score: number): { label: string; tone: "good" | "warn" | "bad"; line: string } {
  if (score >= 90) return { label: "Excellent", tone: "good", line: "Your website is in great shape." };
  if (score >= 80) return { label: "Good", tone: "good", line: "Your website is in good shape, with a few things to improve." };
  if (score >= 50) return { label: "Needs work", tone: "warn", line: "Some problems are holding your website back on Google." };
  return { label: "Poor", tone: "bad", line: "Serious problems are making it hard for Google to show your website." };
}

/** One bar split by how serious each finding is, with a plain-word legend. */
function SeverityBreakdown({ bySeverity, total }: { bySeverity: Record<IssueSeverity, number>; total: number }) {
  return (
    <div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-brand-200/40" aria-hidden>
        {SEVERITY_ORDER.map((sev) =>
          bySeverity[sev] > 0 ? (
            <div key={sev} className={cn("rounded-full", SEVERITY[sev].bar)} style={{ width: `${(bySeverity[sev] / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
        {SEVERITY_ORDER.map((sev) => (
          <li key={sev} className="flex items-center gap-1.5 text-[11px] font-medium text-brand-400">
            <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY[sev].bar)} />
            <span>{SEVERITY[sev].label}</span>
            <span className="text-brand-950 font-semibold">{bySeverity[sev]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Explain health score based on penalties.
 */
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
    `No single page can take away more than ${PENALTY_CAP_PER_PAGE} points, so one broken page can't sink your score.`
  );
}

/** Circular SVG Radial Progress Gauge */
function CircularScoreGauge({ score }: { score: number | null }) {
  const safeScore = score != null ? Math.max(0, Math.min(score, 100)) : 0;
  const radius = 38;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  const strokeColor =
    safeScore >= 90
      ? "var(--color-signal-400)"
      : safeScore >= 80
        ? "var(--color-brand-400)"
        : safeScore >= 50
          ? "var(--color-warning-500)"
          : "var(--color-error-500)";

  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
      <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 96 96">
        {/* Background track */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="var(--color-brand-200)"
          strokeWidth={stroke}
          fill="transparent"
          opacity={0.35}
        />
        {/* Active progress */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke={strokeColor}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="font-mono text-2xl font-black tracking-tight text-brand-950">
          {score != null ? score : "—"}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-brand-400">
          out of 100
        </span>
      </div>
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
    <div className="space-y-4">
      {/* Visual Radial Gauge + Quick Stats Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Circular Gauge */}
        <div className="flex items-center gap-3.5">
          <CircularScoreGauge score={score} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-brand-950 text-sm">Crawl Health Score</span>
              {grade && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold border",
                    grade.tone === "good"
                      ? "bg-success-50 text-success-700 border-success-200"
                      : grade.tone === "warn"
                        ? "bg-warning-50 text-warning-700 border-warning-200"
                        : "bg-error-50 text-error-700 border-error-200",
                  )}
                >
                  {grade.label}
                </span>
              )}
            </div>
            <p className="text-xs text-brand-500 mt-0.5">
              {grade ? grade.line : "We checked your website but could not compute a score."}
            </p>
          </div>
        </div>

        {/* Quick Numbers */}
        <div className="flex items-center gap-4 sm:gap-6 border-t sm:border-t-0 sm:border-l border-brand-200/80 pt-3 sm:pt-0 sm:pl-5 shrink-0 text-xs">
          {counts && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-400">Problems to fix</p>
              <p className="mt-0.5 text-[20px] font-bold text-brand-950">{counts.openGroups}</p>
              <p className="text-[10px] text-brand-400">Open groups</p>
            </div>
          )}
          {pagesChecked != null && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-400">Pages checked</p>
              <p className="mt-0.5 text-[20px] font-bold text-brand-950">{pagesChecked}</p>
              <p className="text-[10px] text-brand-400">Scanned routes</p>
            </div>
          )}
        </div>
      </div>

      {/* Severity Breakdown Bar */}
      <div className="space-y-2 pt-2 border-t border-brand-200/60">
        {counts && (
          <p className="text-[12px] text-brand-700 leading-snug">
            {counts.openFindings === 0 ? (
              <>
                We found <strong>nothing to fix</strong>
                {pagesChecked != null && <> across the {pagesChecked} pages we checked</>}.
              </>
            ) : (
              <>
                We found{" "}
                <strong>
                  {counts.openGroups} {counts.openGroups === 1 ? "problem" : "problems"} to fix
                </strong>
                , showing up {counts.openFindings} {counts.openFindings === 1 ? "time" : "times"}
                {pagesChecked != null && <> across the {pagesChecked} pages we checked</>}.
              </>
            )}
          </p>
        )}
        {counts && counts.openFindings > 0 && <SeverityBreakdown bySeverity={counts.bySeverity} total={counts.openFindings} />}
        {counts && score != null && counts.openFindings > 0 && (
          <p className="text-[11px] leading-relaxed text-brand-400">
            {explainHealthScore(score, counts.openFindings, counts.bySeverity)}
          </p>
        )}
      </div>
    </div>
  );
}
