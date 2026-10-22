import { createHash } from "crypto";
import * as cheerio from "cheerio";
import { assertPublicUrl } from "../security/ssrf";

export const DAY = 86_400_000;
export const MAX_SOURCES = 2000;
export const MAX_IMPORT = 200;

/** Keep meaningful query strings and trailing slashes; only fragments are irrelevant. */
export function linkUrl(value: string, base?: string): string {
  const url = new URL(value.trim(), base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.href.length > 2048
  ) {
    throw new Error(
      "Use a public HTTP or HTTPS URL without credentials (maximum 2048 characters).",
    );
  }
  url.hash = "";
  assertPublicUrl(url.href);
  return url.href;
}

export function hostOf(url: string): string {
  return new URL(url.includes("://") ? url : `https://${url}`).hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

export function belongsTo(host: string, roots: string[]): boolean {
  return roots.some((root) => host === root || host.endsWith(`.${root}`));
}

export function kindOf(
  url: string,
  own: string[],
  competitors: string[],
): "OWN" | "COMPETITOR" | null {
  const host = hostOf(url);
  return belongsTo(host, own)
    ? "OWN"
    : belongsTo(host, competitors)
      ? "COMPETITOR"
      : null;
}

export type ExtractedLink = {
  targetUrl: string;
  targetHost: string;
  targetKind: "OWN" | "COMPETITOR";
  anchorText: string;
  rel: string[];
  linkType: "TEXT" | "IMAGE" | "OTHER";
  placement: "CONTENT" | "NAVIGATION" | "FOOTER" | "SIDEBAR" | "UNKNOWN";
  pageNofollow: boolean;
};

/** Only observed anchors count. An imported URL is a candidate until fetched. */
export function extractBacklinks(
  html: string,
  finalUrl: string,
  own: string[],
  competitors: string[],
  headerNofollow = false,
): ExtractedLink[] {
  const $ = cheerio.load(html);
  const pageNofollow =
    headerNofollow ||
    $('meta[name="robots"],meta[name="googlebot"]')
      .toArray()
      .some((meta) =>
        /(?:^|[\s,])(nofollow|none)(?:$|[\s,])/i.test(
          $(meta).attr("content") ?? "",
        ),
      );
  const found = new Map<string, ExtractedLink>();
  let truncated = false;
  let base = finalUrl;
  try {
    base = linkUrl($("base[href]").first().attr("href") ?? finalUrl, finalUrl);
  } catch {
    /* ignore malformed base */
  }
  $("a[href]").each((_, element) => {
    try {
      const targetUrl = linkUrl($(element).attr("href")!, base);
      const targetKind = kindOf(targetUrl, own, competitors);
      const targetHost = hostOf(targetUrl);
      // Links within the same site are not backlinks, even on www/subdomains.
      if (
        !targetKind ||
        hostOf(finalUrl) === targetHost ||
        (belongsTo(hostOf(finalUrl), own) && targetKind === "OWN") ||
        (belongsTo(
          hostOf(finalUrl),
          competitors.filter((root) => belongsTo(targetHost, [root])),
        ) &&
          targetKind === "COMPETITOR")
      )
        return;
      const rel = ($(element).attr("rel") ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const anchorText = (
        $(element).text() ||
        $(element).find("img").attr("alt") ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);
      // Preserve separate occurrences in evidence rather than infer a page-wide follow flag.
      const linkType = $(element).text().trim()
        ? "TEXT"
        : $(element).find("img").length
          ? "IMAGE"
          : "OTHER";
      const placement = $(element).closest("footer").length
        ? "FOOTER"
        : $(element).closest("nav,header").length
          ? "NAVIGATION"
          : $(element).closest("aside").length
            ? "SIDEBAR"
            : $(element).closest("article,main").length
              ? "CONTENT"
              : "UNKNOWN";
      const key = JSON.stringify([
        targetUrl,
        anchorText,
        rel,
        linkType,
        placement,
        pageNofollow,
      ]);
      if (found.size < 500 || found.has(key))
        found.set(key, {
          targetUrl,
          targetHost,
          targetKind,
          anchorText,
          rel,
          linkType,
          placement,
          pageNofollow,
        });
      else truncated = true;
    } catch {
      /* mailto, javascript, private URLs and malformed anchors are not candidates */
    }
  });
  if (truncated)
    throw new Error(
      "More than 500 relevant link occurrences; verification is incomplete and cannot establish absence.",
    );
  return [...found.values()];
}

export function evidenceHash(html: string): string {
  return createHash("sha256").update(html).digest("hex");
}

export function absenceState(
  previous: {
    lastVerifiedAt: Date | null;
    firstMissingAt: Date | null;
    missingChecks: number;
  },
  now: Date,
) {
  const firstMissingAt = previous.firstMissingAt ?? now;
  const missingChecks = previous.missingChecks + 1;
  return {
    firstMissingAt,
    missingChecks,
    status:
      previous.lastVerifiedAt &&
      missingChecks >= 2 &&
      now.getTime() - firstMissingAt.getTime() >= DAY
        ? "LOST"
        : "MISSING",
  };
}

/** RFC4180-style quoted fields, including commas/newlines and UTF-8 BOM. */
export function parseImport(
  text: string,
): Array<{ sourceUrl: string; targetUrl?: string }> {
  if (Buffer.byteLength(text, "utf8") > 500_000)
    throw new Error("Import must be under 500 KB.");
  const plainUrls = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    plainUrls.length &&
    plainUrls.every(
      (line) => /^https?:\/\//i.test(line) && !line.includes("\t"),
    )
  ) {
    if (plainUrls.length > MAX_IMPORT)
      throw new Error(`Import at most ${MAX_IMPORT} source pages at a time.`);
    return plainUrls.map((sourceUrl) => ({ sourceUrl }));
  }
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === "," || char === "\t")) {
      row.push(cell.trim());
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      if (rows.length > MAX_IMPORT + 1)
        throw new Error(`Import at most ${MAX_IMPORT} source pages at a time.`);
    } else cell += char;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) throw new Error("Add at least one source page URL.");
  const headers = rows[0].map((h) =>
    h
      .replace(/^\uFEFF/, "")
      .toLowerCase()
      .replace(/[ _-]/g, ""),
  );
  const sourceIndex = headers.findIndex((h) =>
    [
      "sourceurl",
      "source",
      "linkingpage",
      "linkingurl",
      "referringpage",
      "referringpageurl",
      "url",
    ].includes(h),
  );
  const targetIndex = headers.findIndex((h) =>
    ["targeturl", "target", "targetpage", "destinationurl"].includes(h),
  );
  const data = sourceIndex >= 0 ? rows.slice(1) : rows;
  if (data.length > MAX_IMPORT)
    throw new Error(`Import at most ${MAX_IMPORT} source pages at a time.`);
  if (!data.length)
    throw new Error("The CSV contains headers but no source pages.");
  return data.map((r) => ({
    sourceUrl:
      r[sourceIndex >= 0 ? sourceIndex : 0]?.replace(/^\uFEFF/, "") ?? "",
    targetUrl: targetIndex >= 0 ? r[targetIndex] || undefined : undefined,
  }));
}
