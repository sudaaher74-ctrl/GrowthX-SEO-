import type { CompetitorIntelReport, IntelReportSite } from "@/lib/api-client";

/** Downloads for the competitor report: Markdown to read, CSV to work in, HTML to print. */

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

function num(n: number | null | undefined, suffix = ""): string {
  return n == null ? "not measured" : `${n.toLocaleString("en-IN")}${suffix}`;
}

function date(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function reportFilename(report: CompetitorIntelReport, ext: string): string {
  const domain = report.facts.you?.domain ?? "site";
  return `competitor-report-${domain}-${report.generatedAt.slice(0, 10)}.${ext}`;
}

function siteMarkdown(site: IntelReportSite): string {
  const issues = site.issues.length
    ? site.issues
        .map(
          (i) =>
            `- **${i.severity} · ${i.issueType.replace(/_/g, " ")}** on ${i.pages} page(s). ${i.description}\n  - Fix: ${i.recommendation}\n  - Examples: ${i.exampleUrls.join(", ") || "none"}`,
        )
        .join("\n")
    : "- No open issues recorded.";
  return (
    `### ${site.name} (${site.domain})\n` +
    `Crawled ${date(site.crawledAt)} · ${num(site.pagesCrawled, " pages")} · health ${num(site.healthScore, "/100")}\n\n${issues}\n`
  );
}

export function toMarkdown(report: CompetitorIntelReport): string {
  const { facts, analysis } = report;
  const out: string[] = [];
  out.push(`# Competitor intelligence report: ${facts.you?.domain ?? "your site"}`);
  out.push(
    `Generated ${date(report.generatedAt)}${report.model ? ` · analysis by ${report.model}` : ""} · ${facts.rivals.length} rival(s)`,
  );

  if (analysis) {
    out.push(`## Summary\n${analysis.executiveSummary || "No summary returned."}`);
    out.push(`## Problems and how to fix them (${analysis.problems.length})`);
    analysis.problems.forEach((p, i) => {
      out.push(
        `### ${i + 1}. ${p.title}\n**Severity:** ${p.severity} · **Where:** ${p.where} · **Effort:** ${p.effort}\n\n` +
          `**Evidence:** ${p.evidence || "—"}\n\n**Why it matters:** ${p.whyItMatters || "—"}\n\n` +
          `**Fix:**\n${p.fix.map((f, n) => `${n + 1}. ${f}`).join("\n") || "—"}`,
      );
    });
    if (analysis.competitorInsights.length) {
      out.push(`## Rival by rival`);
      analysis.competitorInsights.forEach((c) => {
        out.push(
          `### ${c.competitor}\n**They lead on:** ${c.theyLead.join("; ") || "—"}\n\n**You lead on:** ${c.youLead.join("; ") || "—"}\n\n**Worth copying:** ${c.copyThis || "—"}`,
        );
      });
    }
    if (analysis.plan.length) {
      out.push(`## 4-week plan`);
      analysis.plan.forEach((w) => out.push(`### ${w.week}\n${w.actions.map((a) => `- ${a}`).join("\n")}`));
    }
    if (analysis.dataGaps.length) out.push(`## Not measured yet\n${analysis.dataGaps.map((g) => `- ${g}`).join("\n")}`);
  } else {
    out.push(`## Analysis\nNot available: ${report.analysisError ?? "unknown reason"}. The crawl facts below are complete.`);
  }

  out.push(`## Crawl facts`);
  if (facts.you) out.push(siteMarkdown(facts.you));
  facts.rivals.forEach((r) => {
    const cmp = r.comparison.map((c) => `| ${c.label} | ${num(c.you)} | ${num(c.them)} | ${c.leader} |`).join("\n");
    out.push(
      siteMarkdown(r) +
        (cmp ? `\n| Measure | You | ${r.name} | Leader |\n| --- | --- | --- | --- |\n${cmp}\n` : "") +
        (r.notes.length ? `\n_${r.notes.join(" ")}_\n` : ""),
    );
  });
  if (facts.notIncluded.length) out.push(`_Not included (limit reached): ${facts.notIncluded.join(", ")}_`);
  return out.join("\n\n") + "\n";
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  // A leading =, +, - or @ is read as a formula by spreadsheet apps.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(report: CompetitorIntelReport): string {
  const header = ["type", "site", "severity", "title", "pages", "evidence_or_description", "fix", "effort", "example_urls"];
  const rows: unknown[][] = [];
  report.analysis?.problems.forEach((p) =>
    rows.push(["problem", p.where, p.severity, p.title, "", p.evidence, p.fix.join(" | "), p.effort, ""]),
  );
  const sites = [...(report.facts.you ? [report.facts.you] : []), ...report.facts.rivals];
  sites.forEach((s) =>
    s.issues.forEach((i) =>
      rows.push(["crawl_issue", s.domain, i.severity.toLowerCase(), i.issueType, i.pages, i.description, i.recommendation, "", i.exampleUrls.join(" | ")]),
    ),
  );
  rows.sort((a, b) =>
    a[0] === b[0] ? SEVERITY_ORDER.indexOf(String(a[2])) - SEVERITY_ORDER.indexOf(String(b[2])) : a[0] === "problem" ? -1 : 1,
  );
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface PrintColours {
  text: string;
  rule: string;
  faint: string;
}

/**
 * The print view is a separate document and cannot read the app's CSS, so
 * the theme tokens are resolved here and passed in.
 */
export function themeColours(): PrintColours {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    text: token("--color-brand-950", "black"),
    rule: token("--color-brand-200", "silver"),
    faint: token("--color-brand-100", "whitesmoke"),
  };
}

/** Minimal Markdown → HTML for the print view. Everything is escaped first. */
export function toPrintableHtml(report: CompetitorIntelReport, colours: PrintColours): string {
  const lines = escapeHtml(toMarkdown(report)).split("\n");
  const body: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => {
    if (list) body.push(`</${list}>`);
    list = null;
  };
  const inline = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/_(.+?)_/g, "<em>$1</em>");
  for (const line of lines) {
    const h = /^(#{1,3}) (.*)$/.exec(line);
    const ul = /^\s*- (.*)$/.exec(line);
    const ol = /^\d+\. (.*)$/.exec(line);
    if (h) {
      close();
      body.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    } else if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        close();
        body.push(`<${kind}>`);
        list = kind;
      }
      body.push(`<li>${inline((ul ?? ol)![1])}</li>`);
    } else if (/^\|/.test(line)) {
      close();
      if (/^\| ---/.test(line)) continue;
      body.push(`<div class="row">${line.split("|").slice(1, -1).map((c) => `<span>${inline(c.trim())}</span>`).join("")}</div>`);
    } else if (line.trim()) {
      close();
      body.push(`<p>${inline(line)}</p>`);
    }
  }
  close();
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(reportFilename(report, "pdf"))}</title>
<style>body{font:13px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:${colours.text};max-width:820px;margin:32px auto;padding:0 20px}
h1{font-size:22px}h2{font-size:16px;margin-top:28px;border-bottom:1px solid ${colours.rule};padding-bottom:4px}h3{font-size:14px;margin-top:18px}
.row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;border-bottom:1px solid ${colours.faint};padding:3px 0}
@media print{body{margin:0}h2{break-after:avoid}}</style></head><body>${body.join("\n")}</body></html>`;
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
