import {
  Activity,
  BarChart,
  Bell,
  Bot,
  Brain,
  Calendar,
  Code,
  Cpu,
  CreditCard,
  Crosshair,
  Edit3,
  Gauge,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Link2,
  ListChecks,
  MapPin,
  Megaphone,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  Telescope,
  TrendingUp,
  Users,
} from "lucide-react";

/**
 * The one list of routes in the app.
 *
 * There used to be three partial ones: the sidebar's nav arrays, the top bar's
 * `ROUTE_META` breadcrumb table, and the command palette's item list. They
 * disagreed. The sidebar linked 16 of the 40 built pages, so ten finished
 * routes could only be reached by typing the URL; `ROUTE_META` covered 12, so
 * most pages showed the breadcrumb "Workspace / Workspace"; and the palette
 * pointed at six routes that were never built (`/search-console`, `/analytics`,
 * `/rank-tracking`, `/local-seo`, `/backlinks`, `/automations`), so a third of
 * its entries led to a 404.
 *
 * Everything that needs to know about a route reads it from here, which is why
 * this file carries the display name, the breadcrumb scope, and the icon
 * together — those are the three things the three consumers each needed.
 */

export interface AppRoute {
  href: string;
  /** Display name. Matches the heading the page itself renders. */
  label: string;
  /** Breadcrumb scope shown before the label in the top bar. */
  scope: string;
  icon: React.ElementType;
  /** Where the route appears in the sidebar. `null` keeps it out of the nav
   *  but still reachable from search and the breadcrumb. */
  section: "portfolio" | "workspace" | "content-intelligence" | "tools" | "account" | null;
  /** One line describing the page, shown as the palette's subtitle. */
  description: string;
  /** Extra words to match on in search that aren't in the label. */
  keywords?: string[];
}

export const ROUTES: AppRoute[] = [
  // ───── Portfolio ─────
  {
    href: "/clients",
    label: "Projects",
    scope: "Portfolio",
    icon: LayoutGrid,
    section: "portfolio",
    description: "Every client and what needs attention",
    keywords: ["clients", "portfolio", "accounts"],
  },
  {
    href: "/projects",
    label: "Add a project",
    scope: "Portfolio",
    icon: Sparkles,
    section: "portfolio",
    description: "Connect a new website to the workspace",
    keywords: ["new", "create", "onboard", "add site"],
  },

  // ───── Workspace ─────
  {
    href: "/dashboard",
    label: "Overview",
    scope: "Workspace",
    icon: Activity,
    section: "workspace",
    description: "Headline metrics and what changed this period",
    keywords: ["home", "summary", "kpi"],
  },
  {
    href: "/website",
    label: "Website",
    scope: "Workspace",
    icon: Globe,
    section: "workspace",
    description: "Crawl results, pages and site structure",
    keywords: ["crawl", "pages", "sitemap"],
  },
  {
    href: "/search",
    label: "Search & AI Visibility",
    scope: "Workspace",
    icon: Search,
    section: "workspace",
    description: "Queries, clicks and where AI answers cite you",
    keywords: ["gsc", "search console", "queries", "impressions", "ctr"],
  },
  {
    href: "/keywords",
    label: "Keywords",
    scope: "Workspace",
    icon: Target,
    section: "workspace",
    description: "Tracked terms, volume and ranking movement",
    keywords: ["rank tracking", "positions", "serp", "difficulty"],
  },
  {
    href: "/local",
    label: "Local",
    scope: "Workspace",
    icon: MapPin,
    section: "workspace",
    description: "Local listings, citations and service areas",
    keywords: ["gbp", "google business", "maps", "citations"],
  },
  {
    href: "/geo-tracking",
    label: "Geo-Grid Tracker",
    scope: "Workspace",
    icon: Gauge,
    section: "workspace",
    description: "Map pack position across a grid of locations",
    keywords: ["map pack", "grid", "geo", "proximity"],
  },
  {
    href: "/market-research",
    label: "Market Research",
    scope: "Workspace",
    icon: Telescope,
    section: "workspace",
    description: "Demand, segments and category research",
    keywords: ["research", "demand", "audience"],
  },
  {
    href: "/market",
    label: "Market Intelligence",
    scope: "Workspace",
    icon: TrendingUp,
    section: "workspace",
    description: "Category trends and share of search",
    keywords: ["trends", "share of search"],
  },
  {
    href: "/competitors",
    label: "Competitors",
    scope: "Workspace",
    icon: Crosshair,
    section: "workspace",
    description: "Side-by-side traffic and keyword gaps",
    keywords: ["rivals", "gap analysis", "benchmark"],
  },
  {
    href: "/action-queue",
    label: "Action Queue",
    scope: "Workspace",
    icon: ListChecks,
    section: "workspace",
    description: "Prioritised work waiting on you",
    keywords: ["tasks", "todo", "queue", "backlog"],
  },
  {
    href: "/strategy",
    label: "Growth Strategy",
    scope: "Workspace",
    icon: Layers,
    section: "workspace",
    description: "Channel plan and content pillars",
    keywords: ["plan", "pillars", "channels", "roadmap"],
  },
  {
    href: "/monitoring",
    label: "Monitoring",
    scope: "Workspace",
    icon: Bell,
    section: "workspace",
    description: "Uptime, regressions and alerting",
    keywords: ["alerts", "uptime", "24/7", "notifications"],
  },
  {
    href: "/reports",
    label: "Reports",
    scope: "Workspace",
    icon: BarChart,
    section: "workspace",
    description: "White-label client reporting and exports",
    keywords: ["pdf", "export", "client portal", "white label"],
  },
  {
    href: "/activity",
    label: "Activity Log",
    scope: "Workspace",
    icon: Activity,
    section: "workspace",
    description: "Everything that ran, and when",
    keywords: ["history", "audit log", "events"],
  },

  // ───── Content Intelligence ─────
  {
    href: "/content-intelligence",
    label: "Content Intelligence",
    scope: "Content Intelligence",
    icon: Brain,
    section: "content-intelligence",
    description: "Competitor content, gaps and creative patterns",
    keywords: ["ci", "hub"],
  },
  {
    href: "/content-intelligence/competitors",
    label: "Competitor Workspace",
    scope: "Content Intelligence",
    icon: Crosshair,
    section: "content-intelligence",
    description: "Add and monitor competitor accounts",
    keywords: ["accounts", "monitor", "social"],
  },
  {
    href: "/content-intelligence/gaps",
    label: "Content Gap Analysis",
    scope: "Content Intelligence",
    icon: Target,
    section: "content-intelligence",
    description: "Topics competitors cover and you do not",
    keywords: ["gaps", "opportunities", "topics"],
  },
  {
    href: "/content-intelligence/patterns",
    label: "Creative Pattern Library",
    scope: "Content Intelligence",
    icon: Layers,
    section: "content-intelligence",
    description: "Recurring formats and hooks that perform",
    keywords: ["hooks", "formats", "creative"],
  },
  {
    href: "/content-intelligence/strategy",
    label: "AI Content Strategy",
    scope: "Content Intelligence",
    icon: Sparkles,
    section: "content-intelligence",
    description: "Generated strategy and differentiated angles",
    keywords: ["angles", "positioning"],
  },
  {
    href: "/content-intelligence/calendar",
    label: "Content Calendar",
    scope: "Content Intelligence",
    icon: Calendar,
    section: "content-intelligence",
    description: "Scheduled posts and publishing plan",
    keywords: ["schedule", "publishing", "planner"],
  },
  {
    href: "/content-intelligence/campaigns",
    label: "Campaign Workspace",
    scope: "Content Intelligence",
    icon: Megaphone,
    section: "content-intelligence",
    description: "Budgets, briefs and campaign tracking",
    keywords: ["budget", "briefs"],
  },
  {
    href: "/content-intelligence/creators",
    label: "Creator CRM",
    scope: "Content Intelligence",
    icon: Users,
    section: "content-intelligence",
    description: "Creator pipeline and relationships",
    keywords: ["influencers", "crm", "partners"],
  },
  {
    href: "/content-intelligence/outreach",
    label: "Collaboration Outreach",
    scope: "Content Intelligence",
    icon: Megaphone,
    section: "content-intelligence",
    description: "Outreach sequences and replies",
    keywords: ["email", "sequences", "pitch"],
  },

  // ───── Tools ─────
  {
    href: "/content",
    label: "Content Studio",
    scope: "Tools",
    icon: Edit3,
    section: "tools",
    description: "Draft and edit optimised content",
    keywords: ["writing", "editor", "articles"],
  },
  {
    href: "/content-ai",
    label: "Content AI",
    scope: "Tools",
    icon: Sparkles,
    section: "tools",
    description: "Generate SEO blogs, landing and local pages",
    keywords: ["generate", "blog", "ai writer"],
  },
  {
    href: "/marketing",
    label: "Marketing Consultant",
    scope: "Tools",
    icon: Megaphone,
    section: "tools",
    description: "AI guidance on campaigns and positioning",
    keywords: ["consultant", "advice"],
  },
  {
    href: "/technical-seo",
    label: "Site Health",
    scope: "Tools",
    icon: ShieldCheck,
    section: "tools",
    description: "Technical audit and detected issues",
    keywords: ["technical", "audit", "issues", "core web vitals"],
  },
  {
    href: "/meta-optimizer",
    label: "Meta Optimizer",
    scope: "Tools",
    icon: Sliders,
    section: "tools",
    description: "Bulk title and description generator",
    keywords: ["titles", "descriptions", "serp snippet"],
  },
  {
    href: "/schema-generator",
    label: "Schema Generator",
    scope: "Tools",
    icon: Code,
    section: "tools",
    description: "JSON-LD structured data builder",
    keywords: ["json-ld", "structured data", "rich results"],
  },
  {
    href: "/image-seo",
    label: "Image SEO",
    scope: "Tools",
    icon: ImageIcon,
    section: "tools",
    description: "Alt text generation and image weight",
    keywords: ["alt text", "images", "webp", "compression"],
  },
  {
    href: "/internal-linking",
    label: "Internal Linking",
    scope: "Tools",
    icon: Link2,
    section: "tools",
    description: "Orphan pages and link graph suggestions",
    keywords: ["links", "orphan", "anchor", "graph"],
  },
  {
    href: "/engineer",
    label: "AI Engineer",
    scope: "Tools",
    icon: Cpu,
    section: "tools",
    description: "Apply fixes to the site automatically",
    keywords: ["autofix", "deploy", "implementation"],
  },
  {
    href: "/ai-assistant",
    label: "AI Assistant",
    scope: "Tools",
    icon: Bot,
    section: "tools",
    description: "Ask questions about your workspace data",
    keywords: ["chat", "ask", "copilot"],
  },

  // ───── Account ─────
  {
    href: "/integrations",
    label: "Integrations",
    scope: "Account",
    icon: Plug,
    section: "account",
    description: "Connect Search Console, Analytics and more",
    keywords: ["connect", "oauth", "google", "api"],
  },
  {
    href: "/settings",
    label: "Settings",
    scope: "Account",
    icon: Settings,
    section: "account",
    description: "Workspace, domain and team settings",
    keywords: ["preferences", "team", "workspace"],
  },
  {
    href: "/billing",
    label: "Billing & Plans",
    scope: "Account",
    icon: CreditCard,
    section: "account",
    description: "Plan, invoices and payment details",
    keywords: ["invoice", "plan", "subscription", "payment"],
  },
  {
    href: "/help",
    label: "Help & Support",
    scope: "Account",
    icon: HelpCircle,
    section: "account",
    description: "Guides and getting in touch",
    keywords: ["support", "docs", "contact"],
  },
  {
    href: "/admin",
    label: "Admin",
    scope: "Account",
    icon: ShieldCheck,
    section: null,
    description: "Internal revenue and tenancy view",
    keywords: ["mrr", "revenue", "internal"],
  },
];

const BY_HREF = new Map(ROUTES.map((r) => [r.href, r]));

/**
 * The route a pathname is on.
 *
 * Longest match wins, so `/content-intelligence/gaps` resolves to the gaps page
 * rather than to the hub it is nested under. The old breadcrumb table did exact
 * lookups only, which is why every sub-page fell through to the default.
 */
export function routeFor(pathname: string): AppRoute | null {
  const exact = BY_HREF.get(pathname);
  if (exact) return exact;

  let best: AppRoute | null = null;
  for (const route of ROUTES) {
    if (pathname.startsWith(`${route.href}/`) && route.href.length > (best?.href.length ?? 0)) {
      best = route;
    }
  }
  return best;
}

/** The routes in one sidebar section, in declaration order. */
export function routesInSection(section: AppRoute["section"]): AppRoute[] {
  return ROUTES.filter((r) => r.section === section);
}

/** Case-insensitive match over label, description and keywords. */
export function searchRoutes(query: string): AppRoute[] {
  const q = query.trim().toLowerCase();
  if (!q) return ROUTES;
  return ROUTES.filter(
    (r) =>
      r.label.toLowerCase().includes(q) ||
      r.scope.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.keywords?.some((k) => k.includes(q)),
  );
}
