/**
 * Everything the printed audit report states, derived from the crawl.
 *
 * The report this replaces was a static mockup: every client's PDF carried the
 * same "MiQuu Fresh" milk-delivery pages, a technical checklist that said
 * robots.txt and sitemap were found without checking, "+20-30 points" of
 * expected improvement, and — whenever a list came back empty — a score of 68,
 * 32 pages and 28 issues. A client reads this document as a statement about
 * their own site, so each figure below is either measured or visibly absent.
 */

import type { CrawlIssue, CrawlPage, IssueCounts, IssueGroup, IssueSeverity } from "@/lib/api-client";

export const SEVERITIES: IssueSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/** The thresholds the crawler's own issue rules apply (issue-rules.ts). */
export const TITLE_MAX = 65;
export const META_MAX = 160;
export const THIN_CONTENT_WORDS = 250;
/** Google's "good" LCP boundary. */
export const LCP_GOOD_MS = 2500;
export const SLOW_RESPONSE_MS = 1000;

export interface ReportGroup {
  issueType: string;
  label: string;
  severity: IssueSeverity;
  affectedCount: number;
  sampleUrls: string[];
  confidence: "CONFIRMED" | "LIKELY" | "ADVISORY" | null;
  fixClass: IssueGroup["fixClass"] | null;
  /** A representative finding, for its description, explanation and fix. */
  example: CrawlIssue | null;
}

export type CheckTone = "pass" | "warn" | "fail" | "info";

export interface CheckRow {
  check: string;
  tone: CheckTone;
  detail: string;
}

export function humanizeIssueType(issueType: string): string {
  const words = issueType.toLowerCase().replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : issueType;
}

const severityRank = (s: IssueSeverity) => SEVERITIES.indexOf(s);

/**
 * Problems, not findings. Prefers the server's grouping, which counts every
 * affected page; the client-side fallback can only count the findings it was
 * sent, so it says so through `partial`.
 */
export function reportGroups(
  groups: IssueGroup[] | null | undefined,
  issues: CrawlIssue[],
): { groups: ReportGroup[]; partial: boolean } {
  const exampleFor = (type: string) => issues.find((i) => i.issueType === type) ?? null;

  if (groups && groups.length > 0) {
    return {
      partial: false,
      groups: groups.map((g) => ({
        issueType: g.issueType,
        label: humanizeIssueType(g.issueType),
        severity: g.severity,
        affectedCount: g.affectedCount,
        sampleUrls: g.sampleUrls,
        confidence: g.confidence,
        fixClass: g.fixClass,
        example: exampleFor(g.issueType),
      })),
    };
  }

  const byType = new Map<string, CrawlIssue[]>();
  for (const issue of issues) {
    const list = byType.get(issue.issueType) ?? [];
    list.push(issue);
    byType.set(issue.issueType, list);
  }

  const derived = [...byType.entries()].map(([type, list]) => {
    const urls = [...new Set(list.map((i) => i.affectedUrl).filter(Boolean))];
    const severity = list.map((i) => i.severity).sort((a, b) => severityRank(a) - severityRank(b))[0];
    return {
      issueType: type,
      label: humanizeIssueType(type),
      severity,
      affectedCount: urls.length,
      sampleUrls: urls.slice(0, 8),
      confidence: list[0].confidence ?? null,
      fixClass: null,
      example: list[0],
    };
  });

  derived.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.affectedCount - a.affectedCount);
  return { groups: derived, partial: true };
}

/** Open findings by severity: the shared counts endpoint when available. */
export function severityCounts(
  counts: IssueCounts | null | undefined,
  issues: CrawlIssue[],
): { bySeverity: Record<IssueSeverity, number>; total: number; exact: boolean } {
  if (counts) {
    return { bySeverity: counts.bySeverity, total: counts.openFindings, exact: true };
  }
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<IssueSeverity, number>;
  for (const issue of issues) bySeverity[issue.severity] += 1;
  return { bySeverity, total: issues.length, exact: false };
}

export function scoreBand(score: number | null): string {
  if (score == null) return "Not scored yet";
  if (score >= 85) return "Strong — keep it that way";
  if (score >= 65) return "Good foundation with room for improvement";
  if (score >= 40) return "Needs attention";
  return "Significant problems to fix";
}

/** The homepage if it was crawled, else the first page — for the cover. */
export function homepageOf(pages: CrawlPage[]): CrawlPage | null {
  return (
    pages.find((p) => {
      try {
        return new URL(p.url).pathname.replace(/\/+$/, "") === "";
      } catch {
        return false;
      }
    }) ??
    pages[0] ??
    null
  );
}

/** The crawled page carrying the most findings, for the page-wise section. */
export function mostAffectedPage(
  pages: CrawlPage[],
  issues: CrawlIssue[],
): { page: CrawlPage; issues: CrawlIssue[] } | null {
  if (pages.length === 0) return null;
  const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();
  const byUrl = new Map<string, CrawlIssue[]>();
  for (const issue of issues) {
    const key = norm(issue.affectedUrl);
    byUrl.set(key, [...(byUrl.get(key) ?? []), issue]);
  }
  let best: { page: CrawlPage; issues: CrawlIssue[] } | null = null;
  for (const page of pages) {
    const found = byUrl.get(norm(page.url)) ?? [];
    if (!best || found.length > best.issues.length) best = { page, issues: found };
  }
  return best;
}

/** On-page checks for one page, using the crawler's thresholds. */
export function pageChecks(page: CrawlPage): CheckRow[] {
  const title = page.title?.trim() ?? "";
  const meta = page.metaDescription?.trim() ?? "";
  const h1Count = page.h1?.length ?? 0;
  const lcp = page.performance?.lcpMs ?? null;

  return [
    {
      check: "Title tag",
      tone: !title ? "fail" : title.length > TITLE_MAX ? "warn" : "pass",
      detail: title ? `${title.length} characters` : "Missing",
    },
    {
      check: "Meta description",
      tone: !meta ? "fail" : meta.length > META_MAX ? "warn" : "pass",
      detail: meta ? `${meta.length} characters` : "Missing",
    },
    {
      check: "H1 heading",
      tone: h1Count === 1 ? "pass" : h1Count === 0 ? "fail" : "warn",
      detail: h1Count === 1 ? "One H1" : h1Count === 0 ? "Missing" : `${h1Count} H1 headings`,
    },
    {
      check: "Canonical URL",
      tone: page.canonicalUrl ? "pass" : "warn",
      detail: page.canonicalUrl ? "Declared" : "Not declared",
    },
    {
      check: "Content depth",
      tone: page.wordCount >= THIN_CONTENT_WORDS ? "pass" : "warn",
      detail: `${page.wordCount.toLocaleString()} words`,
    },
    {
      check: "Server response",
      tone: page.responseTimeMs > SLOW_RESPONSE_MS ? "warn" : "pass",
      detail: `${page.responseTimeMs.toLocaleString()} ms`,
    },
    {
      check: "Indexability",
      tone: page.indexability === "INDEXABLE" ? "pass" : page.indexability === "NOT_INDEXABLE" ? "fail" : "info",
      detail:
        page.indexability === "INDEXABLE"
          ? "Indexable"
          : page.indexability === "NOT_INDEXABLE"
          ? page.indexabilityReason?.[0]?.code?.replace(/_/g, " ").toLowerCase() ?? "Not indexable"
          : "Not determined",
    },
    {
      check: "Largest Contentful Paint",
      tone: lcp == null ? "info" : lcp > LCP_GOOD_MS ? "warn" : "pass",
      detail: lcp == null ? "Not measured" : `${(lcp / 1000).toFixed(1)} s`,
    },
  ];
}

/**
 * Site-level technical checks computed from the crawled pages. Only what the
 * crawl can show: there is no robots.txt or sitemap row, because the page list
 * does not say whether either was found.
 */
export function technicalChecks(pages: CrawlPage[]): CheckRow[] {
  if (pages.length === 0) return [];
  const count = (pred: (p: CrawlPage) => boolean) => pages.filter(pred).length;
  const of = (n: number) => `${n} of ${pages.length} crawled pages`;

  const insecure = count((p) => p.url.startsWith("http://"));
  const errors = count((p) => p.statusCode >= 400);
  const redirected = count((p) => (p.statusChain?.length ?? 0) > 1);
  const noCanonical = count((p) => !p.canonicalUrl);
  const notIndexable = count((p) => p.indexability === "NOT_INDEXABLE");
  const slow = count((p) => p.responseTimeMs > SLOW_RESPONSE_MS);
  const jsOnly = count((p) => p.jsRequired === true);
  const withLcp = pages.filter((p) => p.performance?.lcpMs != null);
  const slowLcp = withLcp.filter((p) => (p.performance?.lcpMs ?? 0) > LCP_GOOD_MS).length;

  return [
    { check: "HTTPS", tone: insecure ? "fail" : "pass", detail: insecure ? `${of(insecure)} served over HTTP` : "Every crawled page is served over HTTPS" },
    { check: "Error pages", tone: errors ? "fail" : "pass", detail: errors ? `${of(errors)} returned 4xx/5xx` : "No crawled page returned an error" },
    { check: "Redirects", tone: redirected ? "info" : "pass", detail: redirected ? `${of(redirected)} reached through a redirect` : "No crawled page was redirected" },
    { check: "Canonical tags", tone: noCanonical ? "warn" : "pass", detail: noCanonical ? `${of(noCanonical)} declare no canonical` : "Every crawled page declares one" },
    { check: "Indexability", tone: notIndexable ? "warn" : "pass", detail: notIndexable ? `${of(notIndexable)} not indexable` : "No crawled page is blocked from indexing" },
    { check: "Server response", tone: slow ? "warn" : "pass", detail: slow ? `${of(slow)} slower than ${SLOW_RESPONSE_MS} ms` : `All under ${SLOW_RESPONSE_MS} ms` },
    {
      check: "Core Web Vitals (LCP)",
      tone: withLcp.length === 0 ? "info" : slowLcp ? "warn" : "pass",
      detail:
        withLcp.length === 0
          ? "Not measured in this crawl"
          : slowLcp
          ? `${slowLcp} of ${withLcp.length} measured pages above ${LCP_GOOD_MS / 1000} s`
          : `All ${withLcp.length} measured pages under ${LCP_GOOD_MS / 1000} s`,
    },
    { check: "JavaScript rendering", tone: jsOnly ? "info" : "pass", detail: jsOnly ? `${of(jsOnly)} need JavaScript to show content` : "Content is present without JavaScript" },
  ];
}

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
