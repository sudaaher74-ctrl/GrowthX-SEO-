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
  "/admin",
  "/ai-visibility",
  "/clients",
  "/competitor-intelligence",
  "/fix-engine",
  "/google-business-profile",
  "/help",
  "/integrations",
  "/reports",
  "/reports/ai-visibility",
  "/reports/business-profile",
  "/reports/google",
  "/reports/plan",
  "/google",
  "/google/pages",
  "/settings",
  "/tokens",
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
