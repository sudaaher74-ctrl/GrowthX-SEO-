import type { GoogleReport } from "@/lib/api-client";
import { markdownToPrintableHtml, type PrintColours } from "@/lib/competitor-report";

/** Downloads for the Google improvement report: Markdown to read, HTML to print. */

const PLATFORM: Record<"GSC" | "GA4" | "BOTH", string> = { GSC: "Search Console", GA4: "Analytics 4", BOTH: "Search Console + Analytics 4" };

export function googleReportFilename(report: GoogleReport, ext: string): string {
  return `google-improvement-report-${report.facts.site ?? "site"}-${report.generatedAt.slice(0, 10)}.${ext}`;
}

export function googleReportMarkdown(report: GoogleReport): string {
  const { facts, analysis: a } = report;
  const lines: string[] = [
    `# Google improvement report${facts.site ? `: ${facts.site}` : ""}`,
    "",
    `Last ${facts.days} days. Written by Sarvam from Search Console and Google Analytics 4 figures. Generated ${report.generatedAt.slice(0, 10)}.`,
    "",
  ];
  if (!a) {
    lines.push(report.analysisError ?? "The analysis could not be written.", "");
  } else {
    lines.push("## Summary", "", a.executiveSummary || "No summary returned.", "");
    lines.push("## Where we are", "");
    for (const [name, side] of [["Search Console", a.whereWeAre.searchConsole], ["Analytics 4", a.whereWeAre.analytics]] as const) {
      lines.push(`### ${name}`, "", side.verdict || "Nothing to report.", "");
      for (const p of side.points) lines.push(`- ${p}`);
      if (side.points.length) lines.push("");
    }
    lines.push("## What to do, in order", "");
    for (const p of a.priorities) {
      lines.push(`### ${p.rank}. ${p.title}`, "", `${PLATFORM[p.platform]} · priority ${p.priority} · impact ${p.impact} · effort ${p.effort}`, "");
      if (p.evidence) lines.push(`**Evidence:** ${p.evidence}`, "");
      if (p.whyItMatters) lines.push(`**Why it matters:** ${p.whyItMatters}`, "");
      p.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      if (p.steps.length) lines.push("");
      if (p.measureBy) lines.push(`**Measure by:** ${p.measureBy}`, "");
    }
    if (a.quickWins.length) lines.push("## Quick wins", "", ...a.quickWins.map((w) => `- ${w}`), "");
    if (a.plan.length) {
      lines.push("## 4-week plan", "");
      for (const w of a.plan) lines.push(`### ${w.week}`, "", ...w.actions.map((x) => `- ${x}`), "");
    }
    if (a.dataGaps.length) lines.push("## Not measured", "", ...a.dataGaps.map((g) => `- ${g}`), "");
  }
  lines.push("## Figures used", "");
  for (const k of facts.kpis) lines.push(`- ${k.label} (${k.source}): ${k.value === null ? `not measured${k.note ? `, ${k.note}` : ""}` : k.value}${k.change ? `, ${k.change}` : ""}`);
  return lines.join("\n");
}

export function googleReportPrintableHtml(report: GoogleReport, colours: PrintColours): string {
  return markdownToPrintableHtml(googleReportMarkdown(report), googleReportFilename(report, "pdf"), colours);
}
