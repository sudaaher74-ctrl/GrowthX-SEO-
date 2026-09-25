import type { WebsiteAuditReport } from "@/lib/api-client";

/** Downloads for the Website Audit report: Markdown to read, CSV to work in. Print goes through the shared renderer. */

const SEVERITY_WORDS: Record<string, string> = {
  CRITICAL: "urgent",
  HIGH: "important",
  MEDIUM: "worth fixing",
  LOW: "minor",
};

export function severityWord(severity: string): string {
  return SEVERITY_WORDS[severity.toUpperCase()] ?? severity.toLowerCase();
}

function date(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function auditReportFilename(report: WebsiteAuditReport, ext: string): string {
  return `website-audit-${report.facts.site?.domain ?? "site"}-${report.generatedAt.slice(0, 10)}.${ext}`;
}

/** The page numbers as plain rows: what was checked, how many pages, and whether that is good. */
export function pageRows(report: WebsiteAuditReport): Array<{ label: string; value: string; ok: boolean | null }> {
  const p = report.facts.pages;
  if (!p) return [];
  return [
    { label: "Pages we read", value: String(p.read), ok: null },
    { label: "Broken pages (show an error)", value: String(p.broken), ok: p.broken === 0 },
    { label: "Slow pages (over 1 second)", value: String(p.slow), ok: p.slow === 0 },
    { label: "Average time to respond", value: p.averageResponseMs != null ? `${(p.averageResponseMs / 1000).toFixed(1)} s` : "not measured", ok: p.averageResponseMs == null ? null : p.averageResponseMs <= 1000 },
    { label: "Pages with very little text (under 250 words)", value: String(p.thin), ok: p.thin === 0 },
    { label: "Typical page length", value: p.medianWords != null ? `${p.medianWords} words` : "not measured", ok: null },
    { label: "Pages with no title in Google", value: String(p.missingTitle), ok: p.missingTitle === 0 },
    { label: "Pages with no description in Google", value: String(p.missingDescription), ok: p.missingDescription === 0 },
    { label: "Pages with no main headline", value: String(p.missingHeadline), ok: p.missingHeadline === 0 },
    { label: "Pages hidden from Google", value: String(p.hiddenFromGoogle), ok: p.hiddenFromGoogle === 0 },
    { label: "Pages giving Google extra details (stars, prices, FAQs)", value: String(p.withGoogleDetails), ok: null },
  ];
}

export function auditToMarkdown(report: WebsiteAuditReport): string {
  const { facts, analysis } = report;
  const out: string[] = [];
  out.push(`# Website audit: ${facts.site?.domain ?? "your website"}`);
  out.push(
    `Generated ${date(report.generatedAt)}${report.model ? ` · written by ${report.model}` : ""} · website read ${date(facts.site?.crawledAt)} · health score ${facts.site?.healthScore ?? "not measured"}/100`,
  );

  if (analysis) {
    out.push(`## Summary\n${analysis.summary || "No summary returned."}`);
    if (analysis.scoreExplained) out.push(`## Your health score\n${analysis.scoreExplained}`);
    if (analysis.quickWins.length) out.push(`## Quick wins (under an hour)\n${analysis.quickWins.map((q) => `- ${q}`).join("\n")}`);
    out.push(`## What to fix (${analysis.fixes.length})`);
    analysis.fixes.forEach((f, i) => {
      out.push(
        `### ${i + 1}. ${f.title}\n**Priority:** ${f.priority} · **Who can fix it:** ${f.whoCanFix === "you" ? "you" : "your web developer"} · **Effort:** ${f.effort}${f.pages ? ` · **Pages:** ${f.pages}` : ""}\n\n` +
          `**What's wrong:** ${f.whatIsWrong || "—"}\n\n**Why it matters:** ${f.whyItMatters || "—"}\n\n` +
          `**How to fix it:**\n${f.steps.map((s, n) => `${n + 1}. ${s}`).join("\n") || "—"}`,
      );
    });
    if (analysis.whatIsGood.length) out.push(`## What's already good\n${analysis.whatIsGood.map((g) => `- ${g}`).join("\n")}`);
    if (analysis.plan.length) {
      out.push("## 4-week plan");
      analysis.plan.forEach((w) => out.push(`### ${w.week}\n${w.actions.map((a) => `- ${a}`).join("\n")}`));
    }
    if (analysis.dataGaps.length) out.push(`## Not measured yet\n${analysis.dataGaps.map((g) => `- ${g}`).join("\n")}`);
  } else {
    out.push(`## Analysis\nNot available: ${report.analysisError ?? "unknown reason"}. The measured facts below are complete.`);
  }

  const rows = pageRows(report);
  if (rows.length) {
    out.push(`## Your pages, measured\n| Check | Result | OK |\n| --- | --- | --- |\n${rows.map((r) => `| ${r.label} | ${r.value} | ${r.ok == null ? "" : r.ok ? "yes" : "no"} |`).join("\n")}`);
  }
  out.push(`## Every problem found (${facts.problems.length}${facts.moreProblems ? ` of ${facts.problems.length + facts.moreProblems}` : ""})`);
  facts.problems.forEach((p) =>
    out.push(
      `### ${p.title}\n_${severityWord(p.severity)}_ · ${p.pages} page(s)\n\n**Why it matters:** ${p.why}\n\n**What to do:** ${p.action}\n\n**Examples:**\n${p.exampleUrls.map((u) => `- ${u}`).join("\n") || "- none"}`,
    ),
  );
  if (facts.moreProblems) out.push(`_…and ${facts.moreProblems} smaller problems. See Website Audit for the full list._`);
  return out.join("\n\n") + "\n";
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  // A leading =, +, - or @ is read as a formula by spreadsheet apps.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function auditToCsv(report: WebsiteAuditReport): string {
  const header = ["type", "title", "priority", "pages", "who_can_fix", "why_it_matters", "what_to_do", "example_urls"];
  const rows: unknown[][] = [];
  report.analysis?.fixes.forEach((f) =>
    rows.push(["fix", f.title, f.priority, f.pages || "", f.whoCanFix === "you" ? "you" : "web developer", f.whyItMatters, f.steps.join(" | "), ""]),
  );
  report.facts.problems.forEach((p) =>
    rows.push(["problem", p.title, severityWord(p.severity), p.pages, "", p.why, p.action, p.exampleUrls.join(" | ")]),
  );
  pageRows(report).forEach((r) => rows.push(["page_check", r.label, r.ok == null ? "" : r.ok ? "ok" : "needs work", r.value, "", "", "", ""]));
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
