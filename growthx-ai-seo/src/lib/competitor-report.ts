import type { CompetitorIntelReport, IntelPriority, IntelReportRival } from "@/lib/api-client";

/** Downloads for the competitor report: Markdown to read, CSV to work in, HTML to print. */

const PRIORITY_ORDER: IntelPriority[] = ["high", "medium", "low"];

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

/** "Named in 3 of 12 AI answers", or why it is not known. */
export function aiMentionText(rival: IntelReportRival, asked: number): string {
  return rival.aiMentions == null ? "not measured" : `named in ${rival.aiMentions} of ${asked} AI answers`;
}

export function reviewText(rival: IntelReportRival): string {
  return rival.googleReviews == null ? "not measured" : `${rival.googleRating ?? "?"}★ from ${rival.googleReviews.toLocaleString("en-IN")} reviews`;
}

function rivalMarkdown(r: IntelReportRival, report: CompetitorIntelReport): string {
  const out: string[] = [`### ${r.name} (${r.domain})`];
  out.push(
    `Crawled ${date(r.crawledAt)} · ${num(r.pagesCrawled, " pages")} · AI assistants: ${aiMentionText(r, report.facts.aiAnswers.asked)} · Google: ${reviewText(r)}`,
  );
  const a = r.advantages;
  if (!a) {
    out.push("_Page-level comparison needs a completed crawl of both sites._");
  } else {
    out.push(`**Topics they have a page for and you do not (${a.missingTopicsTotal}):**`);
    out.push(
      a.missingTopics.length
        ? a.missingTopics.map((t) => `- ${t.title} (${t.pageType.toLowerCase()}, ${t.wordCount} words): ${t.url}`).join("\n")
        : "- None found.",
    );
    if (a.missingTopicsTotal > a.missingTopics.length) out.push(`_…and ${a.missingTopicsTotal - a.missingTopics.length} more._`);
    const rows: string[] = [
      ...a.pageTypes.map((t) => `| ${t.label} | ${t.you} | ${t.them} | them |`),
      ...a.schema.map((s) => `| ${s.type.toLowerCase()} structured data (pages) | ${s.you} | ${s.them} | them |`),
      `| Median words per page | ${num(a.depth.yourMedianWords)} | ${num(a.depth.theirMedianWords)} | ${lead(a.depth.yourMedianWords, a.depth.theirMedianWords)} |`,
      `| In-depth pages (1,000+ words) | ${a.depth.yourLongPages} | ${a.depth.theirLongPages} | ${lead(a.depth.yourLongPages, a.depth.theirLongPages)} |`,
      `| Questions answered in headings | ${a.questions.yourCount} | ${a.questions.theirCount} | ${lead(a.questions.yourCount, a.questions.theirCount)} |`,
      `| Topics only one side covers | ${a.yourUniqueTopicsTotal} | ${a.missingTopicsTotal} | ${lead(a.yourUniqueTopicsTotal, a.missingTopicsTotal)} |`,
      ...r.comparison.filter((c) => !a.pageTypes.some((t) => t.label === c.label)).map((c) => `| ${c.label} | ${num(c.you)} | ${num(c.them)} | ${c.leader} |`),
    ];
    out.push(`| What they have | You | ${r.name} | Ahead |\n| --- | --- | --- | --- |\n${rows.join("\n")}`);
    if (a.questions.theirs.length) out.push(`**Questions they answer:**\n${a.questions.theirs.map((q) => `- ${q}`).join("\n")}`);
  }
  if (r.notes.length) out.push(`_${r.notes.join(" ")}_`);
  return out.join("\n\n");
}

function lead(you: number | null, them: number | null): string {
  if (you == null || them == null) return "unknown";
  return you === them ? "level" : them > you ? "them" : "you";
}

export function toMarkdown(report: CompetitorIntelReport): string {
  const { facts, analysis } = report;
  const out: string[] = [];
  out.push(`# Why your competitors rank: ${facts.you?.domain ?? "your site"}`);
  out.push(
    `Generated ${date(report.generatedAt)}${report.model ? ` · analysis by ${report.model}` : ""} · ${facts.rivals.length} rival(s) · ` +
      (facts.aiAnswers.asked ? `you were named in ${facts.aiAnswers.namedYou} of ${facts.aiAnswers.asked} AI answers` : "AI answers not measured"),
  );

  if (analysis) {
    out.push(`## Summary\n${analysis.executiveSummary || "No summary returned."}`);
    if (analysis.whyTheyRank.length) {
      out.push(`## Why they rank`);
      analysis.whyTheyRank.forEach((c) => {
        out.push(
          `### ${c.competitor} · ${c.threat} threat\n${c.reasons.map((x) => `- **${x.factor}**${x.evidence ? `: ${x.evidence}` : ""}`).join("\n") || "- Nothing measured."}`,
        );
      });
    }
    out.push(`## What they have that you don't (${analysis.gaps.length})`);
    analysis.gaps.forEach((g, i) => {
      out.push(
        `### ${i + 1}. ${g.title}\n**Priority:** ${g.priority} · **Who has it:** ${g.rivals.join(", ") || "—"} · **Effort:** ${g.effort}\n\n` +
          `**Evidence:** ${g.evidence || "—"}\n\n**Why it helps them rank:** ${g.whyItHelpsThemRank || "—"}\n\n` +
          `**How to beat it:**\n${g.howToBeatIt.map((f, n) => `${n + 1}. ${f}`).join("\n") || "—"}`,
      );
    });
    if (analysis.whereYouLead.length) out.push(`## Where you lead\n${analysis.whereYouLead.map((w) => `- ${w}`).join("\n")}`);
    if (analysis.plan.length) {
      out.push(`## 4-week plan`);
      analysis.plan.forEach((w) => out.push(`### ${w.week}\n${w.actions.map((a) => `- ${a}`).join("\n")}`));
    }
    if (analysis.dataGaps.length) out.push(`## Not measured yet\n${analysis.dataGaps.map((g) => `- ${g}`).join("\n")}`);
  } else {
    out.push(`## Analysis\nNot available: ${report.analysisError ?? "unknown reason"}. The measured facts below are complete.`);
  }

  out.push(`## What each rival has, measured`);
  if (facts.you) out.push(`Your site: ${facts.you.name} (${facts.you.domain}), crawled ${date(facts.you.crawledAt)}, ${num(facts.you.pagesCrawled, " pages")}.`);
  facts.rivals.forEach((r) => out.push(rivalMarkdown(r, report)));
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
  const header = ["type", "rival", "item", "you", "them", "priority", "evidence", "how_to_beat_it", "url"];
  const rows: unknown[][] = [];
  const gaps = [...(report.analysis?.gaps ?? [])].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
  );
  gaps.forEach((g) => rows.push(["gap", g.rivals.join(" | "), g.title, "", "", g.priority, g.evidence, g.howToBeatIt.join(" | "), ""]));
  report.analysis?.whyTheyRank.forEach((c) =>
    c.reasons.forEach((x) => rows.push(["why_they_rank", c.competitor, x.factor, "", "", c.threat, x.evidence, "", ""])),
  );
  const asked = report.facts.aiAnswers.asked;
  report.facts.rivals.forEach((r) => {
    if (r.aiMentions != null) rows.push(["ai_answers", r.domain, "Named in AI answers", report.facts.aiAnswers.namedYou, r.aiMentions, "", `of ${asked} answers`, "", ""]);
    if (r.googleReviews != null) rows.push(["google_reviews", r.domain, "Google reviews", "", r.googleReviews, "", `${r.googleRating ?? "?"} stars`, "", ""]);
    const a = r.advantages;
    if (!a) return;
    a.missingTopics.forEach((t) => rows.push(["missing_topic", r.domain, t.title, 0, 1, "", `${t.pageType.toLowerCase()}, ${t.wordCount} words`, "", t.url]));
    a.pageTypes.forEach((t) => rows.push(["page_type", r.domain, t.label, t.you, t.them, "", "", "", ""]));
    a.schema.forEach((s) => rows.push(["structured_data", r.domain, s.type, s.you, s.them, "", "", "", s.exampleUrl]));
    rows.push(["depth", r.domain, "Median words per page", a.depth.yourMedianWords ?? "", a.depth.theirMedianWords ?? "", "", "", "", ""]);
    rows.push(["depth", r.domain, "Pages of 1000+ words", a.depth.yourLongPages, a.depth.theirLongPages, "", "", "", ""]);
    rows.push(["questions", r.domain, "Questions answered in headings", a.questions.yourCount, a.questions.theirCount, "", a.questions.theirs.join(" | "), "", ""]);
  });
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
  return markdownToPrintableHtml(toMarkdown(report), reportFilename(report, "pdf"), colours);
}

/** Any report's Markdown as a printable page. Shared by every downloadable report. */
export function markdownToPrintableHtml(markdown: string, title: string, colours: PrintColours): string {
  const lines = escapeHtml(markdown).split("\n");
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
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
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
