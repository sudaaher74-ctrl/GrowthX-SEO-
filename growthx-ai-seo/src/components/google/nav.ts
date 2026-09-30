/**
 * The Google section's views, in the order they are shown.
 *
 * Google Business Profile is not listed: it has its own sidebar entry, and
 * /google/business-profile stays only as the return address of its connect flow.
 *
 * Every view here is built. `built` stays on the type so a planned view can be
 * listed, with a "soon" badge, before it exists.
 */
export type GoogleGroup = "search-console" | "analytics" | "analysis";

/**
 * The Google section is two simple pages, one per source. Every other view is
 * reached from one of them, and belongs to the group whose page links to it.
 */
export const GOOGLE_GROUPS: Record<GoogleGroup, { label: string; href: string }> = {
  "search-console": { label: "Search Console", href: "/google/search-console" },
  analytics: { label: "Analytics 4", href: "/google/analytics" },
  analysis: { label: "Insights & tools", href: "/google" },
};

export interface GoogleView {
  id: string;
  group: GoogleGroup;
  label: string;
  href: string;
  built: boolean;
  /** What the view will answer, shown where it is not built yet. */
  will: string;
  phase?: 2 | 3 | 4;
  /** An existing page that covers part of this today. */
  current?: { label: string; href: string };
}

export const GOOGLE_VIEWS: GoogleView[] = [
  { id: "overview", group: "analysis", label: "Combined overview", href: "/google/overview", built: true, will: "How Google visibility turns into traffic, engagement and results." },
  {
    id: "search-performance", group: "search-console",
    label: "Search Performance",
    href: "/google/search-performance",
    built: true,
    will: "Clicks, impressions, CTR and position, the position distribution, and the queries rising and declining.",
  },
  {
    id: "keywords", group: "search-console",
    label: "Keywords",
    href: "/google/keywords",
    built: true,
    will: "Top, new, rising and declining keywords, page-2 opportunities, cannibalization and a detail view per keyword.",
  },
  { id: "pages", group: "search-console", label: "Pages", href: "/google/pages", built: true, will: "Every organic page with its search and visit figures side by side." },
  {
    id: "traffic", group: "analytics",
    label: "Traffic & Acquisition",
    href: "/google/traffic",
    built: true,
    will: "Organic Search against Direct, Referral, Social and Paid, with landing-page performance.",
  },
  {
    id: "engagement", group: "analytics",
    label: "Engagement",
    href: "/google/engagement",
    built: true,
    will: "What visitors from Google do after they arrive, and the pages where that goes wrong.",
  },
  {
    id: "conversions", group: "analytics",
    label: "Conversions",
    href: "/google/conversions",
    built: true,
    will: "Organic key events, conversion rate and revenue, and the pages that earn them.",
  },
  {
    id: "index", group: "search-console",
    label: "Google Index",
    href: "/google/index",
    built: true,
    will: "Crawled, indexable, indexed, ranking and receiving traffic, with every indexing issue.",
  },
  {
    id: "opportunities", group: "analysis",
    label: "Opportunities",
    href: "/google/opportunities",
    built: true,
    will: "CTR, ranking, page-2, content, internal-link and indexing opportunities, each with its evidence.",
  },
  {
    id: "changes", group: "analysis",
    label: "Changes & Alerts",
    href: "/google/changes",
    built: true,
    will: "Automatic detection of traffic, ranking, CTR, indexing and conversion changes.",
  },
  {
    id: "insights", group: "analysis",
    label: "Insights",
    href: "/google/insights",
    built: true,
    will: "What happened, why, the evidence, and what to do, across search, traffic, conversions and technical health.",
  },
  {
    id: "explorer", group: "analysis",
    label: "Data Explorer",
    href: "/google/explorer",
    built: true,
    will: "Build your own table or chart from the Google data, with filters.",
  },
];
