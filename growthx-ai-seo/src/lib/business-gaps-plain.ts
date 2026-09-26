import type { CategoryGapItem } from "./api-client";

/** The plan handed to whoever manages the catalog — same shape as buildGapPlan in gaps-plain.ts. */
export function buildCategoryGapPlan(item: CategoryGapItem, you: { domain: string }): string {
  return (
    `# Plan: ${item.headline}\n\n` +
    `Competitor: ${item.competitorLabel} (${item.competitorDomain})\nYour website: ${you.domain}\n\n` +
    `## Why this matters\n${item.why}\n\n` +
    `## What to do\n${item.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
    `## When it's done\nRe-check Catalog (You) and Catalog (Them) after updating your site, and this item drops off the Gaps list.\n`
  );
}
