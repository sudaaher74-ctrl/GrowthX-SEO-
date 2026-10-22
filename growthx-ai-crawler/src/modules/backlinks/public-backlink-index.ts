import { createHash } from "crypto";
import { belongsTo, hostOf, linkUrl } from "./backlink-evidence";
import { referringDomain } from "./backlink-analytics.helpers";
import * as cheerio from "cheerio";

export const ARCHIVE_PATH =
  /^crawl-data\/CC-MAIN-\d{4}-\d{2}\/segments\/\d+\.\d+\/wat\/CC-MAIN-[\w.-]+\.warc\.wat\.gz$/;
export type PublicEdge = {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  targetHost: string;
  targetRoot: string;
  archivePath: string;
  archivedAt: Date | null;
};

/** WAT contains many URL types. Only actual HTML anchor hrefs become candidates. */
export function watEdges(
  line: string,
  archivePath: string,
): { page: boolean; edges: PublicEdge[] } {
  if (!ARCHIVE_PATH.test(archivePath) || !line.startsWith("{"))
    return { page: false, edges: [] };
  try {
    const record = JSON.parse(line);
    const envelope = record.Envelope;
    const header = envelope?.["WARC-Header-Metadata"];
    const html =
      envelope?.["Payload-Metadata"]?.["HTTP-Response-Metadata"]?.[
        "HTML-Metadata"
      ];
    if (
      header?.["WARC-Type"] !== "response" ||
      !html ||
      !Array.isArray(html.Links)
    )
      return { page: false, edges: [] };
    const sourceUrl = linkUrl(header["WARC-Target-URI"]);
    const sourceHost = hostOf(sourceUrl);
    const archived = new Date(header["WARC-Date"]);
    const archivedAt = Number.isFinite(archived.getTime()) ? archived : null;
    const edges = new Map<string, PublicEdge>();
    for (const link of html.Links.slice(0, 1000)) {
      if (
        typeof link.path !== "string" ||
        !/^A@\/?href$/i.test(link.path) ||
        typeof link.url !== "string"
      )
        continue;
      try {
        const targetUrl = linkUrl(link.url, sourceUrl),
          targetHost = hostOf(targetUrl);
        if (
          belongsTo(targetHost, [sourceHost]) ||
          belongsTo(sourceHost, [targetHost])
        )
          continue;
        const id = createHash("sha256")
          .update(sourceUrl + "\n" + targetUrl)
          .digest("hex");
        edges.set(id, {
          id,
          sourceUrl,
          targetUrl,
          targetHost,
          targetRoot: referringDomain(targetUrl),
          archivePath,
          archivedAt,
        });
      } catch {
        /* Reject malformed/private archive URLs before persistence. */
      }
    }
    return { page: true, edges: [...edges.values()] };
  } catch {
    return { page: false, edges: [] };
  }
}

export function footprintLinks(
  html: string,
  base: string,
  own: string[],
  limit = 12,
): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, a) => {
    try {
      const url = linkUrl($(a).attr("href")!, base);
      if (!belongsTo(hostOf(url), own) && urls.size < limit) urls.add(url);
    } catch {
      /* Non-public/non-HTTP anchors are not crawl seeds. */
    }
  });
  return [...urls];
}
