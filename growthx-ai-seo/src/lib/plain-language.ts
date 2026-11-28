import type { IssueSeverity } from "@/lib/api-client";

/**
 * The words the customer-facing screens use for things the audit measures.
 *
 * Every customer is assumed to have never heard the word "SEO". The dashboard,
 * website audit, page inspector, and action plan all share this vocabulary so
 * raw database codes (like NO_CANONICAL or SHORT_TITLE) never leak to users.
 */
export const SEVERITY_PLAIN: Record<IssueSeverity, { label: string; tone: "bad" | "warn" | "info" | "default"; bar: string }> = {
  CRITICAL: { label: "Urgent", tone: "bad", bar: "bg-error-600" },
  HIGH: { label: "Important", tone: "warn", bar: "bg-warning-500" },
  MEDIUM: { label: "Moderate", tone: "info", bar: "bg-accent-500" },
  LOW: { label: "Minor", tone: "default", bar: "bg-brand-300" },
};

export const SEVERITY_ORDER: IssueSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export interface PlainIssueMeta {
  title: string;
  impactTag: string;
  area: "Search Rankings" | "Page Speed" | "AI & Citations" | "Mobile Experience" | "Crawl Access" | "Security & Trust";
}

const ISSUE_DICTIONARY: Record<string, PlainIssueMeta> = {
  // Crawl access & errors
  FETCH_FAILED: { title: "Page Could Not Be Reached", impactTag: "Invisible to Google & visitors", area: "Crawl Access" },
  FETCH_BLOCKED_SUSPECTED: { title: "Firewall Blocking Search & AI Bots", impactTag: "Blocks Google & AI crawlers", area: "Crawl Access" },
  SERVER_ERROR_5XX: { title: "Server Error (Page Crashed)", impactTag: "Dropped from Google search", area: "Crawl Access" },
  BROKEN_PAGE_4XX: { title: "Broken Page (404 Not Found)", impactTag: "Dead link losing visitors", area: "Crawl Access" },
  BROKEN_LINKS: { title: "Broken Internal Links", impactTag: "Dead ends hurting trust", area: "Crawl Access" },
  REDIRECT_CHAIN: { title: "Too Many Redirect Hops", impactTag: "Slows loading & loses authority", area: "Crawl Access" },
  TEMPORARY_REDIRECT_302: { title: "Temporary Redirect Instead of Permanent", impactTag: "Splits ranking strength", area: "Search Rankings" },
  NOINDEX_DETECTED: { title: "Page Hidden From Google (Noindex)", impactTag: "Zero search traffic possible", area: "Crawl Access" },
  ROBOTS_TXT_BLOCKED: { title: "Blocked by robots.txt", impactTag: "Search bots barred from reading", area: "Crawl Access" },
  NOT_IN_SITEMAP: { title: "Page Missing From Sitemap", impactTag: "Slower Google discovery", area: "Crawl Access" },
  SITEMAP_WRONG_DOMAIN: { title: "Sitemap Lists the Wrong Website", impactTag: "Sitemap completely ignored", area: "Crawl Access" },
  SITEMAP_DEAD_URLS: { title: "Sitemap Contains Broken Links", impactTag: "Wastes Google crawl trust", area: "Crawl Access" },
  JS_RENDER_REQUIRED: { title: "Content Needs JavaScript to Appear", impactTag: "Risk of being missed by AI bots", area: "AI & Citations" },
  RENDER_UNAVAILABLE: { title: "Page Could Not Be Rendered", impactTag: "Incomplete audit visibility", area: "Crawl Access" },

  // Titles, snippets & headings
  MISSING_TITLE: { title: "Missing Google Search Title", impactTag: "Weak clicks in Google results", area: "Search Rankings" },
  SHORT_TITLE: { title: "Search Headline Too Short", impactTag: "Missing key search terms", area: "Search Rankings" },
  LONG_TITLE: { title: "Search Headline Gets Cut Off", impactTag: "Truncated in Google results", area: "Search Rankings" },
  DUPLICATE_TITLE: { title: "Duplicate Page Titles", impactTag: "Pages compete against each other", area: "Search Rankings" },
  MULTIPLE_TITLE_TAGS: { title: "Conflicting Double Page Titles", impactTag: "Google picks the wrong headline", area: "Search Rankings" },
  MISSING_META_DESCRIPTION: { title: "Missing Search Preview Description", impactTag: "Google guesses snippet text", area: "Search Rankings" },
  LONG_META_DESCRIPTION: { title: "Search Description Gets Cut Off", impactTag: "Key pitch cut short on Google", area: "Search Rankings" },
  DUPLICATE_META_DESCRIPTION: { title: "Duplicate Search Descriptions", impactTag: "Pages look identical on Google", area: "Search Rankings" },
  MULTIPLE_META_DESCRIPTIONS: { title: "Conflicting Double Descriptions", impactTag: "Google shows wrong preview copy", area: "Search Rankings" },
  MISSING_H1: { title: "Missing Main Page Headline (H1)", impactTag: "Unclear page topic for Google", area: "Search Rankings" },
  MULTIPLE_H1: { title: "Multiple Competing Main Headlines", impactTag: "Dilutes primary page topic", area: "Search Rankings" },
  BROKEN_HEADING_HIERARCHY: { title: "Unclear Section Headings", impactTag: "Harder for visitors & AI to scan", area: "AI & Citations" },

  // Canonicals & duplicates
  NO_CANONICAL: { title: "Duplicate URL Risk (No Preferred Link)", impactTag: "Splits ranking authority", area: "Search Rankings" },
  MISSING_CANONICAL: { title: "Duplicate URL Risk (No Preferred Link)", impactTag: "Splits ranking authority", area: "Search Rankings" },
  CONFLICTING_CANONICALS: { title: "Conflicting Preferred URL Tags", impactTag: "Confuses Google indexing", area: "Search Rankings" },
  CANONICAL_POINTS_ELSEWHERE: { title: "Page Hands Its Ranking to Another URL", impactTag: "This URL won't rank in Google", area: "Search Rankings" },
  DUPLICATE_CONTENT: { title: "Identical Content Across Multiple URLs", impactTag: "Splits ranking authority", area: "Search Rankings" },

  // Content & AI readiness
  THIN_CONTENT: { title: "Too Little Helpful Content", impactTag: "Hard to rank or earn AI citations", area: "AI & Citations" },
  LOW_CONTENT_SIGNAL_RATIO: { title: "Menus & Footers Drown Out Page Copy", impactTag: "Weak unique topic signal", area: "AI & Citations" },
  MISSING_ALT_TEXT: { title: "Images Missing Descriptions (Alt Text)", impactTag: "Missed image search & accessibility", area: "Search Rankings" },
  MISSING_SCHEMA: { title: "Missing Rich Result Data (Schema)", impactTag: "No rich snippets or AI facts", area: "AI & Citations" },
  MISSING_STRUCTURED_DATA: { title: "Missing Rich Result Data (Schema)", impactTag: "No rich snippets or AI facts", area: "AI & Citations" },
  MISSING_OG_TAGS: { title: "Blank WhatsApp & Social Link Preview", impactTag: "Poor clicks when shared", area: "Search Rankings" },

  // Deep Speed, Mobile, Links & Security Forensics
  SLOW_SERVER_TTFB: { title: "Slow Server Start Time", impactTag: "Delays every page load", area: "Page Speed" },
  SLOW_PAGE: { title: "Slow Page Load Speed", impactTag: "Visitors leave before page opens", area: "Page Speed" },
  IMAGE_CLS_DIMENSIONS_MISSING: { title: "Images Causing Mobile Screen Jumps", impactTag: "Hurts mobile stability (CLS)", area: "Mobile Experience" },
  UNCOMPRESSED_HTML_PAYLOAD: { title: "Uncompressed Heavy Page Code", impactTag: "Slow downloads on mobile data", area: "Page Speed" },
  INTERNAL_NOFOLLOW_LEAK: { title: "Internal Link Blocking Ranking Power", impactTag: "Starves your own pages", area: "Search Rankings" },
  ORPHAN_PAGE: { title: "Page Has No Internal Links", impactTag: "Hard for Google to find or rank", area: "Crawl Access" },
  HTTPS_ISSUE: { title: "Unsecured HTTP Page", impactTag: "Browser 'Not Secure' warning", area: "Security & Trust" },
  MIXED_CONTENT: { title: "Unsecured Assets on HTTPS Page", impactTag: "Weakens browser security trust", area: "Security & Trust" },
  MISSING_SECURITY_HEADERS: { title: "Missing Browser Security Headers", impactTag: "Lower security protection", area: "Security & Trust" },
};

/**
 * Turns any raw crawler issueType enum (e.g. `NO_CANONICAL`, `IMAGE_CLS_DIMENSIONS_MISSING`)
 * into a crystal-clear human headline and impact summary.
 */
export function humanizeIssue(rawType: string): PlainIssueMeta {
  const key = (rawType || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (ISSUE_DICTIONARY[key]) {
    return ISSUE_DICTIONARY[key];
  }

  // Partial fallbacks for legacy/custom issue codes
  if (key.includes("CANONICAL")) return ISSUE_DICTIONARY.NO_CANONICAL;
  if (key.includes("NOINDEX")) return ISSUE_DICTIONARY.NOINDEX_DETECTED;
  if (key.includes("ALT")) return ISSUE_DICTIONARY.MISSING_ALT_TEXT;
  if (key.includes("SCHEMA") || key.includes("JSON_LD")) return ISSUE_DICTIONARY.MISSING_SCHEMA;
  if (key.includes("REDIRECT") && key.includes("302")) return ISSUE_DICTIONARY.TEMPORARY_REDIRECT_302;
  if (key.includes("REDIRECT")) return ISSUE_DICTIONARY.REDIRECT_CHAIN;
  if (key.includes("TTFB") || key.includes("SLOW")) return ISSUE_DICTIONARY.SLOW_SERVER_TTFB;
  if (key.includes("HTTPS") || key.includes("SSL")) return ISSUE_DICTIONARY.HTTPS_ISSUE;

  const fallbackTitle = rawType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: fallbackTitle,
    impactTag: "Affects website visibility",
    area: "Search Rankings",
  };
}

/** The audit's copy is written without a closing full stop; some fallbacks have one. */
export function asSentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}
