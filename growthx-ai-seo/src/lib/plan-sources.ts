import type { GrowthOpportunity } from './api-types';

export const PLAN_SOURCES = [
  { id: 'BACKLINKS', label: 'Backlink Intelligence', sources: ['BACKLINKS', 'BACKLINK', 'LINK'], href: '/backlinks', report: '/backlinks' },
  { id: 'WEBSITE', label: 'Website Audit', sources: ['WEBSITE', 'LOCAL', 'AUDIT', 'TECHNICAL', 'ONPAGE'], href: '/website', report: '/website?tab=report' },
  { id: 'GOOGLE', label: 'Traffic', sources: ['SEARCH_CONSOLE', 'ANALYTICS', 'TRAFFIC', 'GOOGLE', 'GSC', 'GA4'], href: '/google', report: '/google?tab=report' },
  { id: 'COMPETITOR', label: 'Competitor Intelligence', sources: ['COMPETITOR', 'MARKET_INTELLIGENCE', 'COMPETITOR_ANALYSIS', 'CONTENT_GAP'], href: '/competitor-intelligence', report: '/competitor-intelligence?tab=report' },
  { id: 'AI', label: 'AI Visibility', sources: ['MARKET', 'AI_VISIBILITY', 'AI'], href: '/ai-visibility', report: '/ai-visibility?tab=actions' },
];

/**
 * Ensures Fix Engine always provides actionable improvement items for every active workflow tab,
 * preventing empty states when a user reviews Backlink Intelligence, Traffic, or Competitor Intelligence.
 */
export function supplementPlanFindings(items: GrowthOpportunity[], projectId: string): GrowthOpportunity[] {
  const result = [...items];
  const now = new Date().toISOString();
  const presentSources = new Set(result.map((i) => (i.source || '').toUpperCase().trim()));

  const hasGroup = (sources: string[]) =>
    sources.some((s) => presentSources.has(s.toUpperCase().trim()));

  // 1. Backlink Intelligence Improvements
  if (!hasGroup(['BACKLINKS', 'BACKLINK', 'LINK'])) {
    result.push(
      {
        id: `synthetic-backlink-profile-${projectId}`,
        projectId,
        fingerprint: `backlink::foundational::${projectId}`,
        source: 'BACKLINKS',
        category: 'SEO',
        title: 'Build foundational niche backlinks and partner citations',
        summary: 'Competitors in your industry receive high authority signals from niche directories and trade publisher roundups. Establishing direct listings transfers domain authority.',
        recommendedAction: 'Identify top 10 verified business directories, local chambers, and trade publications in your industry. Submit comprehensive profiles with brand links.',
        evidence: [
          { label: 'Target Module', value: 'Backlink Intelligence', source: 'Backlink Analysis' },
          { label: 'SEO Factor', value: 'High referring domain diversity is a top ranking factor', source: 'Search Best Practices' },
        ],
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 85,
        priority: 75,
        impact: 75,
        affectedPages: [],
        status: 'OPEN',
        lifecycle: 'QUEUED',
        fixClass: 'MANUAL',
        detectedAt: now,
        lastSeenAt: now,
      },
      {
        id: `synthetic-backlink-anchor-${projectId}`,
        projectId,
        fingerprint: `backlink::anchor::${projectId}`,
        source: 'BACKLINKS',
        category: 'SEO',
        title: 'Balance inbound anchor text distribution with brand-first anchors',
        summary: 'A natural backlink profile consists of 60% brand name and URL variations, avoiding over-optimized exact-match anchors that trigger search engine scrutiny.',
        recommendedAction: 'When acquiring new editorial mentions, request branded anchor text (your company name) or conversational descriptive anchors.',
        evidence: [
          { label: 'Anchor Profile', value: 'Brand-forward anchor diversity', source: 'Link Building Guidelines' },
        ],
        potential: 'MEDIUM',
        effort: 'LOW',
        confidence: 80,
        priority: 60,
        impact: 60,
        affectedPages: [],
        status: 'OPEN',
        lifecycle: 'QUEUED',
        fixClass: 'APPROVAL',
        detectedAt: now,
        lastSeenAt: now,
      },
      {
        id: `synthetic-backlink-pr-${projectId}`,
        projectId,
        fingerprint: `backlink::pr::${projectId}`,
        source: 'BACKLINKS',
        category: 'CONTENT',
        title: 'Publish original case studies or industry data to earn editorial links',
        summary: 'Original research and customer outcome statistics attract high-authority editorial citations without requiring cold reciprocal outreach.',
        recommendedAction: 'Package customer success milestones or proprietary operational data into a shareable case study page.',
        evidence: [
          { label: 'Strategy', value: 'Data-driven digital PR and case study publishing', source: 'GrowthX Strategy Engine' },
        ],
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 82,
        priority: 70,
        impact: 70,
        affectedPages: [],
        status: 'OPEN',
        lifecycle: 'QUEUED',
        fixClass: 'MANUAL',
        detectedAt: now,
        lastSeenAt: now,
      },
    );
  }

  // 2. Traffic Improvements (Search Console & Analytics)
  if (!hasGroup(['SEARCH_CONSOLE', 'ANALYTICS', 'TRAFFIC', 'GOOGLE', 'GSC', 'GA4'])) {
    result.push(
      {
        id: `synthetic-traffic-gsc-${projectId}`,
        projectId,
        fingerprint: `traffic::gsc::${projectId}`,
        source: 'SEARCH_CONSOLE',
        category: 'SEO',
        title: 'Connect Google Search Console & Analytics to track daily click and keyword trends',
        summary: 'Direct Search Console integration enables daily tracking of search impressions, ranking movements, and CTR performance by keyword and device.',
        recommendedAction: 'Connect your verified Search Console property in project settings to enable real-time keyword position tracking.',
        evidence: [
          { label: 'Telemetry Type', value: 'Google Search Console API (impressions, clicks, average position)', source: 'Search Console Settings' },
        ],
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 95,
        priority: 85,
        impact: 85,
        affectedPages: [],
        status: 'OPEN',
        lifecycle: 'QUEUED',
        fixClass: 'MANUAL',
        detectedAt: now,
        lastSeenAt: now,
      },
      {
        id: `synthetic-traffic-cwv-${projectId}`,
        projectId,
        fingerprint: `traffic::cwv::${projectId}`,
        source: 'SEARCH_CONSOLE',
        category: 'TECHNICAL',
        title: 'Optimize mobile Core Web Vitals (LCP & CLS) to improve Google mobile rankings',
        summary: "Google's mobile-first index evaluates page speed, Largest Contentful Paint (LCP < 2.5s), and visual stability (CLS < 0.1) as direct search ranking factors.",
        recommendedAction: 'Compress hero images, preload critical web fonts, and defer non-essential third-party JavaScript.',
        evidence: [
          { label: 'Ranking Signal', value: 'Core Web Vitals & Page Experience', source: 'Google Search Central' },
        ],
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 90,
        priority: 75,
        impact: 75,
        affectedPages: [],
        status: 'OPEN',
        lifecycle: 'QUEUED',
        fixClass: 'APPROVAL',
        detectedAt: now,
        lastSeenAt: now,
      },
      {
        id: `synthetic-traffic-sitemap-${projectId}`,
        projectId,
        fingerprint: `traffic::sitemap::${projectId}`,
        source: 'SEARCH_CONSOLE',
        category: 'TECHNICAL',
        title: 'Submit XML sitemap and verify search indexation coverage',
        summary: 'Submitting an up-to-date XML sitemap accelerates indexation of newly published content and ensures Google discovers all canonical URLs.',
        recommendedAction: 'Generate a dynamic XML sitemap (sitemap.xml), reference it in robots.txt, and submit to Google Search Console.',
        evidence: [
          { label: 'Indexation Health', value: 'Clean XML sitemap with self-referencing canonicals', source: 'Google SEO Starter Guide' },
        ],
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 92,
        priority: 70,
        impact: 70,
        affectedPages: [],
        status: 'OPEN',
        lifecycle: 'QUEUED',
        fixClass: 'AUTO',
        detectedAt: now,
        lastSeenAt: now,
      },
      {
        id: `synthetic-traffic-intent-${projectId}`,
        projectId,
        fingerprint: `traffic::intent::${projectId}`,
        source: 'SEARCH_CONSOLE',
        category: 'CONTENT',
        title: 'Target commercial-intent search terms ("best", "cost", "near me") for core offerings',
        summary: 'High-intent queries convert significantly better than generic informational queries. Optimizing dedicated pages for commercial modifiers drives ready-to-buy visitors.',
        recommendedAction: 'Update primary service page titles and descriptions to include commercial modifiers such as "best", "services", and target city names.',
        evidence: [
          { label: 'Search Intent Focus', value: 'Commercial & transactional search queries', source: 'Search Strategy' },
        ],
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 86,
        priority: 80,
        impact: 80,
        affectedPages: [],
        status: 'OPEN',
        lifecycle: 'QUEUED',
        fixClass: 'APPROVAL',
        detectedAt: now,
        lastSeenAt: now,
      },
    );
  }

  // 3. Competitor Intelligence Improvements
  if (!hasGroup(['COMPETITOR', 'MARKET_INTELLIGENCE', 'COMPETITOR_ANALYSIS', 'CONTENT_GAP'])) {
    result.push(
      {
        id: `synthetic-competitor-topics-${projectId}`,
        projectId,
        fingerprint: `competitor::topics::${projectId}`,
        source: 'COMPETITOR',
        category: 'COMPETITOR',
        title: 'Cover high-intent topics that top competitors rank for and you do not',
        summary: 'Competitors in your market maintain dedicated landing pages capturing commercial search demand where your website has no dedicated page.',
        recommendedAction: 'Review competitors primary navigation and service pages. Publish dedicated, comprehensive pages targeting these exact search topics.',
        evidence: [
          { label: 'Market Opportunity', value: 'Commercial search queries captured by competitor pages', source: 'Competitor Intelligence' },
        ],
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 88,
        priority: 80,
        impact: 80,
        affectedPages: [],
        status: 'OPEN',
        lifecycle: 'QUEUED',
        fixClass: 'MANUAL',
        detectedAt: now,
        lastSeenAt: now,
      },
      {
        id: `synthetic-competitor-comparison-${projectId}`,
        projectId,
        fingerprint: `competitor::comparison::${projectId}`,
        source: 'COMPETITOR',
        category: 'COMPETITOR',
        title: 'Publish competitor comparison guide: Why choose your brand vs rivals',
        summary: 'Prospective customers actively search for comparisons before purchasing. Having your own transparent comparison page controls the narrative and captures high-converting decision traffic.',
        recommendedAction: 'Create a neutral, factual comparison page highlighting your distinctive strengths, local presence, and customer guarantees.',
        evidence: [
          { label: 'Intent Factor', value: 'High purchase intent comparison searches', source: 'CRO Insights' },
        ],
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 86,
        priority: 75,
        impact: 75,
        affectedPages: [],
        status: 'OPEN',
        lifecycle: 'QUEUED',
        fixClass: 'MANUAL',
        detectedAt: now,
        lastSeenAt: now,
      },
      {
        id: `synthetic-competitor-schema-${projectId}`,
        projectId,
        fingerprint: `competitor::schema::${projectId}`,
        source: 'COMPETITOR',
        category: 'TECHNICAL',
        title: 'Implement structured schema markup to match competitor rich search snippets',
        summary: 'Competitors utilize structured JSON-LD data (Product, Review, LocalBusiness, FAQ) to earn prominent star ratings and price badges in Google search results.',
        recommendedAction: 'Deploy Product, AggregateRating, and FAQPage JSON-LD schemas across your website to match competitor SERP CTR.',
        evidence: [
          { label: 'SERP Factor', value: 'Rich snippets increase organic click-through rates and search visibility', source: 'Google SERP Studies' },
        ],
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 90,
        priority: 70,
        impact: 70,
        affectedPages: [],
        status: 'OPEN',
        lifecycle: 'QUEUED',
        fixClass: 'APPROVAL',
        detectedAt: now,
        lastSeenAt: now,
      },
    );
  }

  return result;
}
