/**
 * The Google section's views, in the order they are shown.
 *
 * `built` views render real screens. The rest are listed so the section's shape
 * is visible, and say which release brings them; where an older page already
 * covers some of the same ground, `current` points at it so nothing is lost in
 * the meantime.
 */
export interface GoogleView {
  id: string;
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
  { id: "overview", label: "Overview", href: "/google", built: true, will: "How Google visibility turns into traffic, engagement and results." },
  {
    id: "business-profile",
    label: "Google Business Profile",
    href: "/google/business-profile",
    built: true,
    will: "Your Business Profile audit, reviews, photos, categories and Maps ranking.",
  },
  {
    id: "search-performance",
    label: "Search Performance",
    href: "/google/search-performance",
    built: false,
    phase: 2,
    will: "Clicks, impressions, CTR and position, the position distribution, and the queries rising and declining.",
    current: { label: "Open the current Rankings tab", href: "/search-intelligence" },
  },
  {
    id: "keywords",
    label: "Keywords",
    href: "/google/keywords",
    built: false,
    phase: 2,
    will: "Top, new, rising and declining keywords, page-2 opportunities, cannibalization and a detail view per keyword.",
    current: { label: "Open Keywords", href: "/keywords" },
  },
  { id: "pages", label: "Pages", href: "/google/pages", built: true, will: "Every organic page with its search and visit figures side by side." },
  {
    id: "traffic",
    label: "Traffic & Acquisition",
    href: "/google/traffic",
    built: false,
    phase: 3,
    will: "Organic Search against Direct, Referral, Social and Paid, with landing-page performance.",
  },
  {
    id: "engagement",
    label: "Engagement",
    href: "/google/engagement",
    built: false,
    phase: 3,
    will: "What visitors from Google do after they arrive, and the pages where that goes wrong.",
  },
  {
    id: "conversions",
    label: "Conversions",
    href: "/google/conversions",
    built: false,
    phase: 3,
    will: "Organic key events, conversion rate and revenue, and the pages that earn them.",
  },
  {
    id: "index",
    label: "Google Index",
    href: "/google/index",
    built: false,
    phase: 4,
    will: "Crawled, indexable, indexed, ranking and receiving traffic, with every indexing issue.",
    current: { label: "Open Index status", href: "/search-intelligence" },
  },
  {
    id: "opportunities",
    label: "Opportunities",
    href: "/google/opportunities",
    built: false,
    phase: 2,
    will: "CTR, ranking, page-2, content, internal-link and indexing opportunities, each with its evidence.",
    current: { label: "Open Opportunities", href: "/opportunities" },
  },
  {
    id: "changes",
    label: "Changes & Alerts",
    href: "/google/changes",
    built: false,
    phase: 2,
    will: "Automatic detection of traffic, ranking, CTR, indexing and conversion changes.",
    current: { label: "Open Change results", href: "/search-intelligence" },
  },
  {
    id: "insights",
    label: "Insights",
    href: "/google/insights",
    built: false,
    phase: 4,
    will: "What happened, why, the evidence, and what to do, across search, traffic, conversions and technical health.",
  },
  {
    id: "explorer",
    label: "Data Explorer",
    href: "/google/explorer",
    built: false,
    phase: 4,
    will: "Build your own table or chart from the Google data, with filters.",
  },
];

/** Views that are not built yet, keyed by the URL segment. */
export const UNBUILT = new Map(GOOGLE_VIEWS.filter((v) => !v.built).map((v) => [v.id, v]));
