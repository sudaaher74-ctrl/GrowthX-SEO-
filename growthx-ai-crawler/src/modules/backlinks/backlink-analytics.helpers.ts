import { getDomain } from "tldts";
import { ExtractedLink, hostOf } from "./backlink-evidence";

/** Analytics grouping only. URL parsing and SSRF decisions still use WHATWG URL. */
export function referringDomain(url: string): string {
  const host = hostOf(url);
  return (
    getDomain(host, { allowPrivateDomains: true, extractHostname: false }) ??
    host
  );
}

export function summarizeOccurrences(links: ExtractedLink[]) {
  const qualified = links.some(
    (link) =>
      link.pageNofollow ||
      link.rel.some((rel) => ["nofollow", "sponsored", "ugc"].includes(rel)),
  );
  const followed = links.some(
    (link) =>
      !link.pageNofollow &&
      !link.rel.some((rel) => ["nofollow", "sponsored", "ugc"].includes(rel)),
  );
  return {
    anchorText:
      links
        .map((link) => link.anchorText)
        .filter(Boolean)
        .sort()[0] ?? "",
    rel: [...new Set(links.flatMap((link) => link.rel))].sort(),
    linkTypes: [...new Set(links.map((link) => link.linkType))].sort(),
    placements: [...new Set(links.map((link) => link.placement))].sort(),
    followState:
      qualified && followed ? "MIXED" : qualified ? "QUALIFIED" : "FOLLOWED",
  };
}

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Prevent spreadsheet formula execution from untrusted anchor text or URLs.
  if (/^\s*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvDocument(rows: unknown[][]): string {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
