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
 * One line saying why the score is what it is.
 *
 * The audit showed 89/100 labelled Good next to a hundred open findings. Both
 * numbers were right — the scorer caps each page's penalty and discounts
 * low-confidence findings, so many small problems barely move it — but nothing
 * said so, and a client who cannot reconcile two numbers stops trusting both.
 *
 * The per-page cap mirrors MAX_PENALTY_PER_URL in the crawler's
 * health-score.util.ts. Everything else here is read off the counts.
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
    <div className="space-y-3.5">
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 pt-0.5">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">Health score</p>
          <p className="mt-1 flex items-baseline gap-1 text-[24px] sm:text-[26px] font-bold leading-none tracking-tight text-brand-950">
            {score != null ? score : "—"}
            <span className="text-[12px] font-medium text-brand-400 tracking-normal">/100</span>
          </p>
        </div>
        {counts && (
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">Problems to fix</p>
            <p className="mt-1 text-[24px] sm:text-[26px] font-bold leading-none tracking-tight text-brand-950">{counts.openGroups}</p>
          </div>
        )}
        {pagesChecked != null && (
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-brand-400">Pages checked</p>
            <p className="mt-1 text-[24px] sm:text-[26px] font-bold leading-none tracking-tight text-brand-950">{pagesChecked}</p>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-brand-200/30">
        {grade ? (
          <p className="text-[12px] text-brand-400">{grade.line}</p>
        ) : (
          <p className="text-[12px] text-brand-400">We checked your website but couldn&apos;t work out a score this time.</p>
        )}
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
