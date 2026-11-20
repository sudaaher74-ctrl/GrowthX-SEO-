/** Public origin of the marketing site. Used for metadata, the sitemap and structured data. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://reigel.in";

export const SITE_TITLE = "Reigel: find what's costing you customers, then fix it";
export const SITE_DESCRIPTION =
  "Reigel audits your website, tracks rivals, backlinks, and AI-assistant answers, ships safe fixes to GitHub, WordPress, Shopify & Webflow with 1-click rollback, and exports white-label client reports. Free audit, plans from ₹2,999/month.";
