import type { GoogleReport, WhiteLabelSettings } from "@/lib/api-client";
import { markdownToPrintableHtml, type PrintColours } from "@/lib/competitor-report";
import { businessContextToMarkdown, playbookToMarkdown } from "@/lib/report-playbook-markdown";
import type { CsvSection } from "@/lib/report-csv";

/** Downloads for the Traffic & Business Improvement Report: Markdown, 1-Click CSV, and White-Label Printable PDF. */

const PLATFORM: Record<"GSC" | "GA4" | "BOTH", string> = {
  GSC: "Search Console",
  GA4: "Analytics 4",
  BOTH: "Search Console + Analytics 4",
};

function fmtKpiVal(value: number | null, format: string): string {
  if (value === null) return "not measured";
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  if (format === "position") return value.toFixed(1);
  return Math.round(value).toLocaleString("en-US");
}

export function googleReportFilename(report: GoogleReport, ext: string): string {
  return `traffic-intelligence-report-${report.facts.site ?? "site"}-${report.generatedAt.slice(0, 10)}.${ext}`;
}

export function googleReportMarkdown(report: GoogleReport, whiteLabel?: WhiteLabelSettings | null): string {
  const { facts, analysis: a } = report;
  const brandPrefix = whiteLabel?.whiteLabelEnabled && whiteLabel.agencyName ? `${whiteLabel.agencyName} — ` : "";
  const lines: string[] = [
    `# ${brandPrefix}Traffic & Growth Intelligence Report${facts.site ? `: ${facts.site}` : ""}`,
    "",
    `Last ${facts.days} days · Generated ${report.generatedAt.slice(0, 10)}${report.model ? ` · Analyzed by ${report.model}` : ""}.`,
    ...(whiteLabel?.whiteLabelEnabled && whiteLabel.contactLine ? [`Prepared by ${whiteLabel.agencyName || "Agency"} · ${whiteLabel.contactLine}`] : []),
    "",
  ];

  if (facts.business) {
    const b = facts.business;
    lines.push("## Business Understanding (from Website Audit)", "");
    if (b.businessName) lines.push(`- **Business:** ${b.businessName}`);
    if (b.industry) lines.push(`- **Industry:** ${b.industry}`);
    if (b.summary) lines.push(`- **Summary:** ${b.summary}`);
    if (b.offerings.length) lines.push(`- **Core Offerings:** ${b.offerings.join(", ")}`);
    if (b.targetCities.length) lines.push(`- **Target Cities / Service Areas:** ${b.targetCities.join(", ")}`);
    lines.push(`- **Website Pages Audited:** ${b.pagesAudited}${b.healthScore != null ? ` (Health Score: ${b.healthScore}/100)` : ""}`, "");
  }

  if (facts.businessContext) {
    lines.push(...businessContextToMarkdown(facts.businessContext), "");
  }

  if (facts.diagnostics) {
    const d = facts.diagnostics;
    lines.push("## Traffic Quality & Attribution Audit", "");
    lines.push(`- **Datacenter / Bot Noise:** ${d.botAndNoise.diagnosis}`);
    lines.push(`- **Conversion Tracking (GA4 Key Events):** ${d.conversionTracking.diagnosis}`);
    lines.push(`- **Channel Attribution:** ${d.attributionHealth.diagnosis}`);
    if (d.aiVisibility) {
      lines.push(
        `- **AI Search Visibility:** Cited in ${d.aiVisibility.brandMentions} of ${d.aiVisibility.answersMeasured} measured AI answers (${(d.aiVisibility.mentionRate * 100).toFixed(1)}%).`,
      );
    }
    if (d.attributionHealth.utmTemplates.length > 0) {
      lines.push("", "### Ready-to-Use UTM Links", "");
      for (const utm of d.attributionHealth.utmTemplates) {
        lines.push(`- **${utm.label} (${utm.channel}):** ${utm.url}`);
      }
    }
    lines.push("");
  }

  if (facts.locationGaps && facts.locationGaps.length > 0) {
    lines.push("## Target City & Market Traffic Plan", "");
    for (const g of facts.locationGaps) {
      lines.push(
        `### ${g.location} (${g.status === "NO_CLICKS" ? "0 clicks — Action Needed" : g.status === "LOW_TRAFFIC" ? "Low search clicks" : "Active traffic"})`,
        "",
      );
      lines.push(`- **Measured Traffic:** ${g.searchClicks} search clicks · ${g.searchImpressions} impressions · ${g.sessions} GA4 sessions`);
      lines.push(`- **Finding:** ${g.finding}`);
      lines.push(`- **Plan:** ${g.plan}`, "");
      g.recommendedSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      if (g.recommendedSteps.length) lines.push("");
    }
  }

  if (!a) {
    lines.push(report.analysisError ?? "The analysis could not be written.", "");
  } else {
    lines.push("## Executive Summary", "", a.executiveSummary || "No summary returned.", "");
    lines.push("## Where You Stand", "");
    for (const [name, side] of [
      ["Search Console", a.whereWeAre.searchConsole],
      ["Analytics 4", a.whereWeAre.analytics],
    ] as const) {
      lines.push(`### ${name}`, "", side.verdict || "Nothing to report.", "");
      for (const p of side.points) lines.push(`- ${p}`);
      if (side.points.length) lines.push("");
    }
    const m = a.marketingStrategy;
    if (m && (m.summary || m.channels.length || m.whereTrafficComesFrom.length)) {
      lines.push("## Where Your Traffic Comes From", "");
      if (m.summary) lines.push(m.summary, "");
      for (const w of m.whereTrafficComesFrom) lines.push(`- ${w}`);
      if (m.whereTrafficComesFrom.length) lines.push("");
      if (m.audience.length) lines.push("### Audience & Geography", "", ...m.audience.map((w) => `- ${w}`), "");
      if (m.channels.length) {
        lines.push("## Marketing Strategy by Channel", "");
        for (const c of m.channels) {
          lines.push(`### ${c.channel} (${c.verdict}, ${c.share})`, "");
          if (c.whatWeSee) lines.push(`**What we see:** ${c.whatWeSee}`, "");
          if (c.strategy) lines.push(`**Strategy:** ${c.strategy}`, "");
          c.actions.forEach((x, i) => lines.push(`${i + 1}. ${x}`));
          if (c.actions.length) lines.push("");
        }
      }
    }
    lines.push("## Priority Execution Queue", "");
    for (const p of a.priorities) {
      lines.push(
        `### ${p.rank}. ${p.title}`,
        "",
        `${PLATFORM[p.platform]} · priority ${p.priority} · impact ${p.impact} · effort ${p.effort}`,
        "",
      );
      if (p.evidence) lines.push(`**Evidence:** ${p.evidence}`, "");
      if (p.whyItMatters) lines.push(`**Why it matters:** ${p.whyItMatters}`, "");
      p.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      if (p.steps.length) lines.push("");
      if (p.measureBy) lines.push(`**Measure by:** ${p.measureBy}`, "");
    }
    if (a.quickWins.length) lines.push("## Quick Wins (Under 1 Hour)", "", ...a.quickWins.map((w) => `- ${w}`), "");
    if (a.plan.length) {
      lines.push("## 4-Week Execution Roadmap", "");
      for (const w of a.plan) lines.push(`### ${w.week}`, "", ...w.actions.map((x) => `- ${x}`), "");
    }
    if (a.dataGaps.length) lines.push("## Not Measured Yet", "", ...a.dataGaps.map((g) => `- ${g}`), "");
    if (a.playbook) lines.push(...playbookToMarkdown(a.playbook), "");
  }

  if (facts.strikingDistance.length > 0) {
    lines.push("## Striking-Distance Queries (Positions 4–20)", "");
    lines.push("| Query | Position | Impressions | Clicks | CTR |", "| --- | --- | --- | --- | --- |");
    for (const q of facts.strikingDistance.slice(0, 12)) {
      lines.push(`| ${q.key} | ${q.position.toFixed(1)} | ${q.impressions} | ${q.clicks} | ${(q.ctr * 100).toFixed(1)}% |`);
    }
    lines.push("");
  }

  lines.push("## Headline Figures Used", "");
  for (const k of facts.kpis) {
    lines.push(
      `- ${k.label} (${k.source}): ${fmtKpiVal(k.value, k.format)}${k.value === null && k.note ? ` (${k.note})` : ""}${k.change ? ` · ${k.change}` : ""}`,
    );
  }
  if (whiteLabel?.whiteLabelEnabled && whiteLabel.footerText) {
    lines.push("", `---`, `*${whiteLabel.footerText}*`);
  }
  return lines.join("\n");
}

export function googleReportCsvSections(report: GoogleReport): CsvSection[] {
  const { facts, analysis } = report;
  const sections: CsvSection[] = [];

  sections.push({
    title: "Headline KPIs",
    headers: ["Source", "Metric", "Value", "Previous", "Change", "Note"],
    rows: facts.kpis.map((k) => [
      k.source,
      k.label,
      fmtKpiVal(k.value, k.format),
      k.previous != null ? fmtKpiVal(k.previous, k.format) : "",
      k.change ?? "",
      k.note ?? "",
    ]),
  });

  if (facts.locationGaps && facts.locationGaps.length > 0) {
    sections.push({
      title: "Target City & Market Traffic Gaps",
      headers: ["Location", "Status", "GA4 Sessions", "Search Clicks", "Search Impressions", "Finding", "Plan"],
      rows: facts.locationGaps.map((g) => [
        g.location,
        g.status,
        g.sessions,
        g.searchClicks,
        g.searchImpressions,
        g.finding,
        g.plan,
      ]),
    });
  }

  if (facts.traffic?.channels.length) {
    sections.push({
      title: "GA4 Traffic Channels",
      headers: ["Channel", "Sessions", "Share %", "Engagement Rate %", "Key Events"],
      rows: facts.traffic.channels.map((c) => [
        c.channel,
        c.sessions,
        `${(c.share * 100).toFixed(1)}%`,
        c.engagementRate != null ? `${(c.engagementRate * 100).toFixed(1)}%` : "not measured",
        c.keyEvents ?? "not set",
      ]),
    });
  }

  if (facts.strikingDistance.length > 0) {
    sections.push({
      title: "Striking-Distance Queries (Positions 4-20)",
      headers: ["Query", "Position", "Impressions", "Clicks", "CTR %"],
      rows: facts.strikingDistance.map((q) => [
        q.key,
        q.position.toFixed(1),
        q.impressions,
        q.clicks,
        `${(q.ctr * 100).toFixed(1)}%`,
      ]),
    });
  }

  if (facts.ctrOpportunities.length > 0) {
    sections.push({
      title: "CTR Opportunities",
      headers: ["Page / Query", "Position", "Impressions", "Clicks", "CTR %", "Opportunity Note"],
      rows: facts.ctrOpportunities.map((q) => [
        q.key,
        q.position.toFixed(1),
        q.impressions,
        q.clicks,
        `${(q.ctr * 100).toFixed(1)}%`,
        q.extra ?? "",
      ]),
    });
  }

  if (facts.topQueries.length > 0) {
    sections.push({
      title: "Top Search Console Queries",
      headers: ["Query", "Clicks", "Impressions", "CTR %", "Position"],
      rows: facts.topQueries.map((q) => [
        q.key,
        q.clicks,
        q.impressions,
        `${(q.ctr * 100).toFixed(1)}%`,
        q.position.toFixed(1),
      ]),
    });
  }

  if (facts.traffic?.cities.length) {
    sections.push({
      title: "GA4 Top Cities",
      headers: ["City", "Country", "Sessions"],
      rows: facts.traffic.cities.map((c) => [c.city, c.country, c.sessions]),
    });
  }

  if (analysis?.priorities.length) {
    sections.push({
      title: "Priority Execution Queue",
      headers: ["Rank", "Platform", "Priority", "Impact", "Effort", "Title", "Evidence", "Measure By"],
      rows: analysis.priorities.map((p) => [
        p.rank,
        PLATFORM[p.platform],
        p.priority,
        p.impact,
        p.effort,
        p.title,
        p.evidence,
        p.measureBy,
      ]),
    });
  }

  return sections;
}

export function googleReportPrintableHtml(
  report: GoogleReport,
  colours: PrintColours,
  whiteLabel?: WhiteLabelSettings | null,
): string {
  return markdownToPrintableHtml(
    googleReportMarkdown(report, whiteLabel),
    googleReportFilename(report, "pdf"),
    colours,
  );
}
