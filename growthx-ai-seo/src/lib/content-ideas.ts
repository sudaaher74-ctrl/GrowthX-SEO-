import type { ContentIdeas } from "@/lib/api-client";

/**
 * Keyword and blog suggestions as Markdown, for the report downloads. A phrase
 * carries numbers only when they are Google's own (Search Console); the rest
 * are labelled suggestions.
 */
export function ideasToMarkdown(ideas: ContentIdeas | null | undefined): string[] {
  if (!ideas || (!ideas.keywords.length && !ideas.blogIdeas.length)) return [];
  const by = ideas.model ? ` (suggested by ${ideas.model})` : "";
  const out: string[] = [];
  const almost = ideas.search?.status === "OK" ? ideas.search.almostWinning : [];
  if (almost.length) {
    out.push(
      `## Searches you almost win (Google Search Console, last ${ideas.search!.days} days)\n` +
        almost
          .map(
            (s) =>
              `- **${s.query}**: seen ${s.impressions} times, ${s.clicks} clicks, position ${Math.round(s.position * 10) / 10}${s.pagePath ? ` on ${s.pagePath}` : ""}`,
          )
          .join("\n"),
    );
  }
  if (ideas.keywords.length) {
    out.push(
      `## Words your customers search for${by}\n` +
        ideas.keywords
          .map(
            (k) =>
              `- **${k.phrase}**: ${k.why}${k.usePage ? ` Use on: ${k.usePage}` : " Needs a new page."}${
                k.measured
                  ? ` _Google: seen ${k.measured.impressions} times, ${k.measured.clicks} clicks, position ${k.measured.position}._`
                  : ""
              }`,
          )
          .join("\n"),
    );
  }
  if (ideas.blogIdeas.length) {
    out.push(
      `## Blog posts to write${by}\n` +
        ideas.blogIdeas.map((b, i) => `${i + 1}. **${b.title}**: ${b.covers}${b.keyword ? ` _For: ${b.keyword}_` : ""}`).join("\n"),
    );
  }
  return out;
}

/** The phrases alone, one per line, for pasting into a notes app or a message. */
export function keywordsText(ideas: ContentIdeas): string {
  return ideas.keywords.map((k) => k.phrase).join("\n");
}
