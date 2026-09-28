import type { ContentIdeas } from "@/lib/api-client";

/**
 * Keyword and blog suggestions as Markdown, for the report downloads. Labelled
 * as suggestions: nothing in them is a measured search figure.
 */
export function ideasToMarkdown(ideas: ContentIdeas | null | undefined): string[] {
  if (!ideas || (!ideas.keywords.length && !ideas.blogIdeas.length)) return [];
  const by = ideas.model ? ` (suggested by ${ideas.model})` : "";
  const out: string[] = [];
  if (ideas.keywords.length) {
    out.push(
      `## Words your customers search for${by}\n` +
        ideas.keywords
          .map((k) => `- **${k.phrase}**: ${k.why}${k.usePage ? ` Use on: ${k.usePage}` : " Needs a new page."}`)
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
