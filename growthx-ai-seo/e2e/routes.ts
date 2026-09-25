/**
 * Every page the app serves.
 *
 * Kept as data so the smoke test covers new routes the moment they exist:
 * a page added without a line here is a page nothing checks.
 *
 * The converse costs just as much: a route listed here that no longer exists
 * fails the suite forever on Next's own 404, which reads as a broken page
 * rather than as a stale list. /onboarding and /projects went in d6ae619 and
 * /analyze/results in 64d4c1a, and all three sat here failing afterwards. When
 * a page is deleted, delete its line.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/pricing",
  "/legal/privacy",
  "/legal/terms",
  "/analyze",
  "/analyze/progress",
];

export const DASHBOARD_ROUTES = [
  "/dashboard",
  "/action-engine",
  "/action-queue",
  "/activity",
  "/admin",
  "/ai-assistant",
  "/ai-visibility",
  "/analytics",
  "/billing",
  "/clients",
  "/competitor-intelligence",
  "/competitors",
  "/content",
  "/content-ai",
  "/content-intelligence",
  "/content-intelligence/calendar",
  "/content-intelligence/campaigns",
  "/content-intelligence/competitors",
  "/content-intelligence/creators",
  "/content-intelligence/gaps",
  "/content-intelligence/outreach",
  "/content-intelligence/patterns",
  "/content-intelligence/strategy",
  "/content-opportunities",
  "/content-velocity",
  "/design-studio",
  "/engineer",
  "/fix-engine",
  "/geo-tracking",
  "/google-business-profile",
  "/help",
  "/image-seo",
  "/integrations",
  "/internal-linking",
  "/keywords",
  "/market",
  "/market-research",
  "/marketing",
  "/meta-optimizer",
  "/monitoring",
  "/opportunities",
  "/reports",
  "/schema-generator",
  "/search",
  "/search/search-console",
  "/search-performance",
  "/settings",
  "/social-media",
  "/strategy",
  "/technical-seo",
  "/website",
];

/** Tabs whose panels mount enough extra code to be worth their own check. */
export const TABBED_ROUTES = [
  "/fix-engine?tab=overview",
  "/fix-engine?tab=implementation",
  "/fix-engine?tab=verification",
  "/fix-engine?tab=history",
  "/website?tab=overview",
  "/website?tab=technical-seo",
  "/website?tab=performance",
  "/website?tab=pages",
  "/website?tab=issues",
  "/competitor-intelligence?tab=overview",
  "/competitor-intelligence?tab=battleground",
  "/competitor-intelligence?tab=gaps",
  "/competitor-intelligence?tab=radar",
  "/competitor-intelligence?tab=ai-answers",
  "/competitor-intelligence?tab=counter-moves",
  "/competitor-intelligence?tab=report",
];
