import type { ReportBusinessContext, ReportGrowthPlaybook } from "@/lib/api-types";

/**
 * Formats the shared Business & Hyper-Local Context + 7-layer Growth Playbook
 * into clean Markdown sections so every report download (.md & printable PDF)
 * includes possibilities, concrete methods, copy-paste assets, and 90-day plans.
 */
export function businessContextToMarkdown(ctx: ReportBusinessContext | null | undefined): string[] {
  if (!ctx) return [];
  const lines: string[] = ["## Business & Hyper-Local Market Lens"];
  const bullets: string[] = [
    `- **Business:** ${ctx.businessName}${ctx.domain ? ` (${ctx.domain})` : ""}`,
  ];
  if (ctx.industry) bullets.push(`- **Industry:** ${ctx.industry}`);
  if (ctx.businessModel) bullets.push(`- **Business Model:** ${ctx.businessModel}`);
  if (ctx.offerings.length) bullets.push(`- **Core Offerings:** ${ctx.offerings.join(", ")}`);
  const geo = [ctx.primaryCity, ctx.state, ctx.country].filter(Boolean).join(", ");
  if (geo) bullets.push(`- **Primary Market:** ${geo}`);
  if (ctx.coveredAreas.length) bullets.push(`- **Covered Neighborhoods:** ${ctx.coveredAreas.join(", ")}`);
  if (ctx.missingAreas.length) bullets.push(`- **Uncovered Nearby Neighborhoods (Expansion Gaps):** ${ctx.missingAreas.join(", ")}`);
  if (ctx.localPresence?.reviewCount != null) {
    bullets.push(
      `- **Google Business Profile:** ${ctx.localPresence.rating ?? "?"}★ from ${ctx.localPresence.reviewCount} reviews${ctx.localPresence.address ? ` (${ctx.localPresence.address})` : ""}`,
    );
  }
  if (ctx.trustSignals.length) bullets.push(`- **Detected Trust Signals:** ${ctx.trustSignals.slice(0, 5).join(" · ")}`);
  lines.push(bullets.join("\n"));
  return lines;
}

export function playbookToMarkdown(playbook: ReportGrowthPlaybook | null | undefined): string[] {
  if (!playbook) return [];
  const out: string[] = [];

  if (playbook.businessAngle) {
    out.push(`## Strategic Growth Angle\n${playbook.businessAngle}`);
  }

  if (playbook.possibilities.length > 0) {
    const blocks = playbook.possibilities.map((p) => {
      const label =
        p.tier === "conservative"
          ? "Conservative"
          : p.tier === "realistic"
            ? "Realistic"
            : "Aggressive";
      const assumptions = p.assumptions.length
        ? `\n\n**Assumptions:**\n${p.assumptions.map((a) => `- ${a}`).join("\n")}`
        : "";
      const unlocks = p.unlocksBy.length
        ? `\n\n**Unlocked by:**\n${p.unlocksBy.map((u) => `- ${u}`).join("\n")}`
        : "";
      return `### ${label} (${p.timeframe}) — ${p.headline}\n${p.expectedOutcome}${unlocks}${assumptions}`;
    });
    out.push(`## Growth Possibilities & Scenarios\n\n${blocks.join("\n\n")}`);
  }

  if (playbook.methods.length > 0) {
    const blocks = playbook.methods.map((m, i) => {
      const ownerLabel = m.owner === "you" ? "Business Owner" : m.owner === "developer" ? "Developer" : "Owner + Developer";
      return (
        `### ${i + 1}. [${m.category.replace(/_/g, " ")}] ${m.title}\n` +
        `**Owner:** ${ownerLabel} · **Impact:** ${m.expectedImpact} · **Effort:** ${m.effort}\n\n` +
        `**Objective:** ${m.objective}\n\n` +
        `**Why this works for your business:** ${m.whyForThisBusiness}\n\n` +
        `**How to apply:**\n${m.howToApply.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}` +
        (m.verifyWith ? `\n\n**Verify with:** ${m.verifyWith}` : "")
      );
    });
    out.push(`## Exact Methods & Playbooks to Apply (${playbook.methods.length})\n\n${blocks.join("\n\n")}`);
  }

  if (playbook.readyToUseAssets.length > 0) {
    const blocks = playbook.readyToUseAssets.map((a) => {
      return (
        `### ${a.title}\n` +
        `**Type:** ${a.kind.replace(/_/g, " ")} · **Target:** ${a.targetUrlOrChannel}\n\n` +
        "```text\n" +
        a.copyText +
        "\n```" +
        (a.usageNote ? `\n\n_${a.usageNote}_` : "")
      );
    });
    out.push(`## Ready-to-Use Copy-Paste Content & Assets (${playbook.readyToUseAssets.length})\n\n${blocks.join("\n\n")}`);
  }

  if (playbook.roadmap90Day.length > 0) {
    const blocks = playbook.roadmap90Day.map((m) => {
      const ownerPart = m.ownerTasks.length
        ? `\n\n**Business Owner Tasks:**\n${m.ownerTasks.map((t) => `- ${t}`).join("\n")}`
        : "";
      const devPart = m.developerTasks.length
        ? `\n\n**Developer Tasks:**\n${m.developerTasks.map((t) => `- ${t}`).join("\n")}`
        : "";
      const kpiPart = m.kpiTarget ? `\n\n**KPI Checkpoint:** ${m.kpiTarget}` : "";
      return `### ${m.phase}\n**Goal:** ${m.goal}${ownerPart}${devPart}${kpiPart}`;
    });
    out.push(`## 30 / 60 / 90-Day Execution Roadmap\n\n${blocks.join("\n\n")}`);
  }

  return out;
}
