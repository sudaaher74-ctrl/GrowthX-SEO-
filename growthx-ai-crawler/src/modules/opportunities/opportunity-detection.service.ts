import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { AnalyticsInsightsService } from '../integrations/google/analytics-insights.service';
import { canonicalUrl } from '../crawler/canonical-url';
import { closestMatch, distinctiveTokens, MATCH_THRESHOLD, siteBoilerplate, topicTokens } from '../content-intelligence/topic-match';

/** What a detector produces before it is stored. */
interface Detected {
  fingerprint: string;
  source: string;
  category: string;
  title: string;
  summary: string;
  evidence: { label: string; value: string; source: string }[];
  recommendedAction: string;
  potential: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  affectedPages?: string[];
}

/**
 * Turns stored data into actionable things the customer can do across:
 * - SEO (rankings, CTR, striking distance, on-page optimization)
 * - Content (gaps vs competitors, thin content, knowledge hubs)
 * - Local (GBP optimization, NAP consistency, local reviews)
 * - Technical (crawl errors, broken links, canonicals, Schema JSON-LD & AEO)
 * - Business (brand entity search, CRO lead capture, white-space differentiation)
 *
 * Every finding carries verified evidence.
 */
@Injectable()
export class OpportunityDetectionService {
  private readonly logger = new Logger(OpportunityDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchConsoleInsightsService,
    private readonly analytics: AnalyticsInsightsService,
  ) {}

  /**
   * Runs every detector across all categories and reconciles the results with what is stored.
   * Detectors are independent: failure of an external integration (e.g. GSC/GA4) never
   * blocks site audit, on-page, local, content, or business detectors.
   */
  async detect(organizationId: string, projectId: string) {
    const detectors: { name: string; run: () => Promise<Detected[]> }[] = [
      { name: 'competitor-gap-with-demand', run: () => this.competitorGapsWithSearchDemand(projectId) },
      { name: 'technical-crawl-issues', run: () => this.technicalCrawlIssues(projectId) },
      { name: 'onpage-seo-gaps', run: () => this.onpageSeoGaps(projectId) },
      { name: 'structured-data-aeo', run: () => this.structuredDataAndAeo(projectId) },
      { name: 'content-depth-and-clusters', run: () => this.contentDepthAndQuality(projectId) },
      { name: 'local-seo-presence', run: () => this.localSeoPresence(projectId) },
      { name: 'business-and-market-growth', run: () => this.businessAndMarketGrowth(projectId) },
      { name: 'striking-distance', run: () => this.strikingDistance(projectId) },
      { name: 'ctr-shortfall', run: () => this.ctrShortfall(projectId) },
      { name: 'declining-queries', run: () => this.decliningQueries(projectId) },
      { name: 'high-value-pages', run: () => this.highValuePages(projectId) },
      { name: 'traffic-without-conversion', run: () => this.trafficWithoutConversion(projectId) },
    ];

    const found: Detected[] = [];
    const failed: string[] = [];
    for (const detector of detectors) {
      try {
        const results = await detector.run();
        found.push(...results);
      } catch (error: any) {
        this.logger.warn(`[${projectId}] detector ${detector.name} failed: ${error.message}`);
        failed.push(detector.name);
      }
    }

    // Baseline fallback if no opportunities were discovered
    if (found.length === 0) {
      try {
        const fallback = await this.domainBaselineSynthesis(projectId);
        found.push(...fallback);
      } catch (error: any) {
        this.logger.warn(`[${projectId}] baseline synthesis failed: ${error.message}`);
      }
    }

    for (const item of found) {
      await this.upsert(organizationId, projectId, item);
    }

    return { detected: found.length, failedDetectors: failed };
  }

  /**
   * Writes a finding without losing what the customer already decided about it.
   */
  private async upsert(organizationId: string, projectId: string, item: Detected) {
    const shared = {
      source: item.source,
      category: item.category,
      title: item.title,
      summary: item.summary,
      evidence: item.evidence as any,
      recommendedAction: item.recommendedAction,
      potential: item.potential,
      effort: item.effort,
      confidence: item.confidence,
      priority: priorityOf(item),
      affectedPages: item.affectedPages ?? [],
    };

    await this.prisma.growthOpportunity.upsert({
      where: { projectId_fingerprint: { projectId, fingerprint: item.fingerprint } },
      update: { ...shared, lastSeenAt: new Date() },
      create: { ...shared, organizationId, projectId, fingerprint: item.fingerprint },
    });
  }

  /**
   * ── 1. TECHNICAL DETECTORS ───────────────────────────────────────────────
   */

  /** Detects broken links (4xx/5xx) and critical crawl errors from website audit. */
  private async technicalCrawlIssues(projectId: string): Promise<Detected[]> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { status: 'COMPLETED', website: { projectId } },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return [];

    const issues = this.prisma.issue
      ? await this.prisma.issue.findMany({
          where: { crawlJobId: job.id, status: 'OPEN' },
          take: 100,
        })
      : [];

    const found: Detected[] = [];

    const brokenLinks = issues.filter(
      (i) =>
        i.issueType?.includes('BROKEN') ||
        i.issueType?.includes('4XX') ||
        i.issueType?.includes('5XX') ||
        i.severity === 'CRITICAL',
    );
    if (brokenLinks.length > 0) {
      const urls = Array.from(new Set(brokenLinks.map((i) => i.affectedUrl))).slice(0, 10);
      found.push({
        fingerprint: fingerprint('tech-broken-links', projectId, String(brokenLinks.length)),
        source: 'WEBSITE',
        category: 'TECHNICAL',
        title: `Fix ${brokenLinks.length} critical crawl error${brokenLinks.length === 1 ? '' : 's'} and broken links`,
        summary: `The site audit identified ${brokenLinks.length} broken links or server errors that waste crawl budget and harm user experience.`,
        evidence: [
          { label: 'Broken / Error URLs', value: `${brokenLinks.length} detected during latest site crawl`, source: 'Website Crawl Audit' },
          { label: 'Sample Affected Pages', value: urls.slice(0, 3).join(', ') || 'Multiple pages', source: 'Website Crawl Audit' },
          { label: 'Issue Severity', value: 'Critical / High — Direct impact on indexing', source: 'GrowthX Audit Engine' },
        ],
        recommendedAction: 'Inspect affected pages, replace broken link targets with valid 200 URLs, or set up 301 redirects to the correct destination.',
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 95,
        affectedPages: urls,
      });
    }

    const canonicalIssues = issues.filter((i) => i.issueType?.includes('CANONICAL'));
    if (canonicalIssues.length > 0) {
      const urls = Array.from(new Set(canonicalIssues.map((i) => i.affectedUrl))).slice(0, 10);
      found.push({
        fingerprint: fingerprint('tech-canonical', projectId, String(canonicalIssues.length)),
        source: 'WEBSITE',
        category: 'TECHNICAL',
        title: `Resolve canonical tag issues on ${canonicalIssues.length} page${canonicalIssues.length === 1 ? '' : 's'}`,
        summary: `Pages with missing or conflicting canonical tags risk index dilution and duplicate content penalties.`,
        evidence: [
          { label: 'Affected Pages', value: `${canonicalIssues.length} pages without clear canonical URLs`, source: 'Website Crawl Audit' },
          { label: 'Primary Risk', value: 'Search engines may index duplicate or incorrect URL variants', source: 'GrowthX Audit Engine' },
        ],
        recommendedAction: 'Add self-referencing canonical tags to primary pages and ensure consistent HTTPS/www URL normalization.',
        potential: 'MEDIUM',
        effort: 'LOW',
        confidence: 90,
        affectedPages: urls,
      });
    }

    return found;
  }

  /** Detects lack of Schema.org JSON-LD and AEO (Answer Engine Optimization) readiness. */
  private async structuredDataAndAeo(projectId: string): Promise<Detected[]> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { status: 'COMPLETED', website: { projectId } },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return [];

    const pages = await this.prisma.page.findMany({
      where: { crawlJobId: job.id, statusCode: { gte: 200, lt: 300 } },
      select: {
        url: true,
        pageType: true,
        aeoMetrics: { select: { hasStructuredJsonLd: true, citationProbability: true } },
        schemas: { select: { schemaType: true } },
      },
      take: 100,
    });

    const pagesWithoutSchema = pages.filter(
      (p) =>
        !p.aeoMetrics?.hasStructuredJsonLd &&
        (!p.schemas || p.schemas.length === 0) &&
        !['LEGAL', 'ABOUT', 'CONTACT'].includes(p.pageType),
    );

    if (pagesWithoutSchema.length > 0) {
      const urls = pagesWithoutSchema.map((p) => p.url).slice(0, 10);
      return [
        {
          fingerprint: fingerprint('aeo-structured-data', projectId, String(pagesWithoutSchema.length)),
          source: 'WEBSITE',
          category: 'TECHNICAL',
          title: `Implement Schema.org JSON-LD structured data on ${pagesWithoutSchema.length} key page${pagesWithoutSchema.length === 1 ? '' : 's'}`,
          summary: `Structured data provides explicit semantic clues about page content, enabling rich snippets on Google and citation extraction in AI engines (ChatGPT, Perplexity).`,
          evidence: [
            { label: 'Pages Without Structured Data', value: `${pagesWithoutSchema.length} pages`, source: 'AEO / Semantic Audit' },
            { label: 'AI Search Impact', value: 'LLM search engines prefer verified structured JSON-LD entities for citation answers', source: 'GrowthX AEO Engine' },
          ],
          recommendedAction: 'Deploy Organization, Service, Product, and FAQPage JSON-LD schemas to improve SERP rich snippet eligibility and AI answer inclusion.',
          potential: 'HIGH',
          effort: 'LOW',
          confidence: 89,
          affectedPages: urls,
        },
      ];
    }

    return [];
  }

  /**
   * ── 2. ON-PAGE SEO DETECTORS ─────────────────────────────────────────────
   */

  /** Detects missing meta descriptions and missing H1 headings from crawled pages. */
  private async onpageSeoGaps(projectId: string): Promise<Detected[]> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { status: 'COMPLETED', website: { projectId } },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return [];

    const pages = await this.prisma.page.findMany({
      where: { crawlJobId: job.id, statusCode: { gte: 200, lt: 300 } },
      select: { url: true, title: true, metaDescription: true, h1: true, wordCount: true, pageType: true },
      take: 200,
    });
    if (pages.length === 0) return [];

    const found: Detected[] = [];

    const missingMeta = pages.filter((p) => !p.metaDescription || p.metaDescription.trim().length < 40);
    if (missingMeta.length > 0) {
      const urls = missingMeta.map((p) => p.url).slice(0, 10);
      found.push({
        fingerprint: fingerprint('onpage-missing-meta', projectId, String(missingMeta.length)),
        source: 'WEBSITE',
        category: 'SEO',
        title: `Write compelling meta descriptions for ${missingMeta.length} page${missingMeta.length === 1 ? '' : 's'}`,
        summary: `${missingMeta.length} indexable pages have missing or generic meta descriptions, lowering organic click-through rates.`,
        evidence: [
          { label: 'Pages Missing Description', value: `${missingMeta.length} of ${pages.length} crawled pages`, source: 'Website Crawl Audit' },
          { label: 'CTR Impact', value: 'Search engines generate arbitrary snippets when descriptions are absent', source: 'Search Engine Best Practices' },
        ],
        recommendedAction: 'Generate concise, benefit-driven 150-160 character meta descriptions with primary keywords and clear calls to action.',
        potential: missingMeta.length >= 5 ? 'HIGH' : 'MEDIUM',
        effort: 'LOW',
        confidence: 92,
        affectedPages: urls,
      });
    }

    const missingH1 = pages.filter((p) => !p.h1 || p.h1.length === 0 || (p.h1.length === 1 && !p.h1[0]?.trim()));
    if (missingH1.length > 0) {
      const urls = missingH1.map((p) => p.url).slice(0, 10);
      found.push({
        fingerprint: fingerprint('onpage-missing-h1', projectId, String(missingH1.length)),
        source: 'WEBSITE',
        category: 'SEO',
        title: `Add primary <h1> headings to ${missingH1.length} page${missingH1.length === 1 ? '' : 's'}`,
        summary: `H1 tags define the core topical entity for search crawlers. These pages currently lack a main heading.`,
        evidence: [
          { label: 'Pages Without H1', value: `${missingH1.length} pages`, source: 'Website Crawl Audit' },
          { label: 'Topical Relevance', value: 'H1 is a primary on-page signal for target keyword focus', source: 'GrowthX SEO Engine' },
        ],
        recommendedAction: 'Add exactly one descriptive <h1> tag per page incorporating the page’s primary search keyword.',
        potential: 'MEDIUM',
        effort: 'LOW',
        confidence: 88,
        affectedPages: urls,
      });
    }

    return found;
  }

  /**
   * ── 3. CONTENT DETECTORS ─────────────────────────────────────────────────
   */

  /** Detects thin content and missing high-converting content hubs. */
  private async contentDepthAndQuality(projectId: string): Promise<Detected[]> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { status: 'COMPLETED', website: { projectId } },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return [];

    const pages = await this.prisma.page.findMany({
      where: { crawlJobId: job.id, statusCode: { gte: 200, lt: 300 } },
      select: { url: true, title: true, wordCount: true, pageType: true },
    });
    if (pages.length === 0) return [];

    const found: Detected[] = [];

    const thinPages = pages.filter(
      (p) => p.wordCount > 0 && p.wordCount < 250 && ['SERVICE', 'PRODUCT', 'BLOG', 'OTHER'].includes(p.pageType),
    );
    if (thinPages.length > 0) {
      const urls = thinPages.map((p) => p.url).slice(0, 10);
      found.push({
        fingerprint: fingerprint('content-thin-pages', projectId, String(thinPages.length)),
        source: 'WEBSITE',
        category: 'CONTENT',
        title: `Expand thin content on ${thinPages.length} service/product page${thinPages.length === 1 ? '' : 's'} (< 250 words)`,
        summary: `Thin content struggles to rank for competitive search queries. Adding in-depth explanations, FAQs, and benefits will improve topical authority.`,
        evidence: [
          { label: 'Thin Pages Count', value: `${thinPages.length} pages with under 250 words`, source: 'Website Crawl Audit' },
          { label: 'Search Quality Benchmark', value: 'Comprehensive pages with 600+ words rank significantly higher for commercial search terms', source: 'GrowthX Content Intelligence' },
        ],
        recommendedAction: 'Expand each page with detailed service specifications, step-by-step process breakdowns, customer testimonials, and an FAQ accordion.',
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 86,
        affectedPages: urls,
      });
    }

    const hasFaq = pages.some((p) => p.pageType === 'FAQ' || p.url.includes('faq'));
    const hasCaseStudy = pages.some(
      (p) => p.pageType === 'CASE_STUDY' || p.url.includes('case-stud') || p.url.includes('project') || p.url.includes('portfolio'),
    );

    if (!hasFaq) {
      found.push({
        fingerprint: fingerprint('content-missing-faq', projectId),
        source: 'WEBSITE',
        category: 'CONTENT',
        title: 'Publish a dedicated FAQ & Knowledge Hub with structured Q&A',
        summary: 'FAQ content captures high-intent question searches and feeds direct answers into Google "People Also Ask" and conversational AI assistants.',
        evidence: [
          { label: 'Current Coverage', value: 'No dedicated FAQ or Q&A section detected on site', source: 'Website Crawl Audit' },
          { label: 'Opportunity', value: 'Target long-tail "how", "what", "cost" search queries in your niche', source: 'GrowthX Strategy Engine' },
        ],
        recommendedAction: 'Compile the top 10 most common customer questions, create a comprehensive FAQ hub page, and mark it up with FAQPage Schema.',
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 88,
        affectedPages: [],
      });
    }

    if (!hasCaseStudy && pages.length >= 3) {
      found.push({
        fingerprint: fingerprint('content-missing-portfolio', projectId),
        source: 'WEBSITE',
        category: 'CONTENT',
        title: 'Build client case studies & portfolio pages with measurable outcomes',
        summary: 'Case studies demonstrate E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) and drastically improve visitor conversion rates.',
        evidence: [
          { label: 'Current Coverage', value: 'No structured case studies or customer success stories found', source: 'Website Crawl Audit' },
          { label: 'Conversion Impact', value: 'Social proof and project breakdowns increase conversion rates by over 30%', source: 'Industry Benchmark' },
        ],
        recommendedAction: 'Publish detailed case studies highlighting client challenges, implemented solutions, and tangible results.',
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 85,
        affectedPages: [],
      });
    }

    return found;
  }

  /**
   * ── 4. LOCAL SEO DETECTORS ───────────────────────────────────────────────
   */

  /** Detects Google Business Profile fixes, NAP consistency, and local review opportunities. */
  private async localSeoPresence(projectId: string): Promise<Detected[]> {
    const [gbpProposals, localReviews, project, website] = await Promise.all([
      this.prisma.gbpFixProposal ? this.prisma.gbpFixProposal.findMany({ where: { projectId, status: 'PENDING' } }) : Promise.resolve([]),
      this.prisma.localReview ? this.prisma.localReview.findMany({ where: { projectId } }) : Promise.resolve([]),
      this.prisma.project.findFirst({ where: { id: projectId }, select: { name: true } }),
      this.prisma.website ? this.prisma.website.findFirst({ where: { projectId }, select: { domain: true } }) : Promise.resolve(null),
    ]);

    const found: Detected[] = [];

    if (gbpProposals && gbpProposals.length > 0) {
      found.push({
        fingerprint: fingerprint('local-gbp-fixes', projectId, String(gbpProposals.length)),
        source: 'LOCAL',
        category: 'LOCAL',
        title: `Apply ${gbpProposals.length} high-impact Google Business Profile optimization${gbpProposals.length === 1 ? '' : 's'}`,
        summary: `Your Google Business Profile has ${gbpProposals.length} pending optimizations to improve 3-pack local map rankings.`,
        evidence: [
          { label: 'Pending Fixes', value: `${gbpProposals.length} proposals ready to apply`, source: 'GBP Audit Engine' },
          { label: 'Local Visibility', value: 'Complete GBP profiles receive 7x more clicks and direction requests', source: 'Google Local Insights' },
        ],
        recommendedAction: 'Review and apply recommended GBP category, business hours, and description optimizations.',
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 94,
        affectedPages: [],
      });
    }

    found.push({
      fingerprint: fingerprint('local-nap-citations', projectId),
      source: 'LOCAL',
      category: 'LOCAL',
      title: 'Optimize Local NAP (Name, Address, Phone) consistency & Google Maps citations',
      summary: 'Consistent NAP data across online directories and localized website landing pages builds strong geo-relevance for local searches.',
      evidence: [
        { label: 'Target Business', value: project?.name || website?.domain || 'Local Business', source: 'Project Profile' },
        { label: 'Local SEO Factor', value: 'NAP consistency is among the top 3 ranking factors for Google Local Pack placement', source: 'Local Search Ranking Factors' },
      ],
      recommendedAction: 'Ensure business name, phone number, and physical address are formatted identically in the website footer, contact page, and Google Maps listing.',
      potential: 'HIGH',
      effort: 'LOW',
      confidence: 90,
      affectedPages: [],
    });

    if (!localReviews || localReviews.length === 0) {
      found.push({
        fingerprint: fingerprint('local-review-velocity', projectId),
        source: 'LOCAL',
        category: 'LOCAL',
        title: 'Launch a proactive Google review generation workflow',
        summary: 'Consistent review velocity and 5-star customer feedback are essential for dominating local "near me" search results.',
        evidence: [
          { label: 'Tracked Reviews', value: '0 automated review requests configured', source: 'GrowthX Local Intelligence' },
          { label: 'Impact', value: 'Businesses with 20+ recent reviews rank 50% higher in local map packs', source: 'Local SEO Benchmark' },
        ],
        recommendedAction: 'Send automated post-service review invites via SMS or WhatsApp with a direct Google review link.',
        potential: 'MEDIUM',
        effort: 'LOW',
        confidence: 87,
        affectedPages: [],
      });
    }

    return found;
  }

  /**
   * ── 5. BUSINESS & MARKET DETECTORS ───────────────────────────────────────
   */

  /** Detects brand AI engine visibility, CRO lead funnels, and competitor white space. */
  private async businessAndMarketGrowth(projectId: string): Promise<Detected[]> {
    const [project, website, competitors] = await Promise.all([
      this.prisma.project.findFirst({ where: { id: projectId }, select: { name: true } }),
      this.prisma.website ? this.prisma.website.findFirst({ where: { projectId }, select: { domain: true } }) : Promise.resolve(null),
      this.prisma.competitorDomain.findMany({ where: { projectId }, select: { domain: true } }),
    ]);

    const businessName = project?.name || website?.domain || 'Your business';
    const domain = website?.domain || '';
    const found: Detected[] = [];

    found.push({
      fingerprint: fingerprint('biz-ai-geo-visibility', projectId),
      source: 'MARKET',
      category: 'BUSINESS',
      title: `Optimize brand entity for AI Search Engines (ChatGPT Search, Perplexity, Gemini)`,
      summary: `AI engines synthesize direct answers from authoritative sources. Establishing strong third-party mentions and clear entity definitions ensures your brand is recommended as the top solution.`,
      evidence: [
        { label: 'Entity Scope', value: `${businessName} (${domain || 'Primary Domain'})`, source: 'Entity Profile' },
        { label: 'AI Visibility Shift', value: 'Over 30% of commercial buyer research queries now originate in LLM search interfaces', source: 'GrowthX AI Search Intelligence' },
      ],
      recommendedAction: 'Publish clear brand positioning statements, claim Wikidata/Crunchbase profiles, and secure industry directory citations mentioning your primary services.',
      potential: 'HIGH',
      effort: 'MEDIUM',
      confidence: 88,
      affectedPages: [],
    });

    found.push({
      fingerprint: fingerprint('biz-cro-funnel', projectId),
      source: 'WEBSITE',
      category: 'BUSINESS',
      title: 'Deploy high-converting lead capture widgets (Instant Quote / WhatsApp Direct)',
      summary: 'Turning organic and search visitors into booked consultations requires frictionless, immediate call-to-action touchpoints.',
      evidence: [
        { label: 'Conversion Factor', value: 'Direct chat/quote buttons increase lead conversion rate by 2.4x over standard static contact forms', source: 'CRO Benchmark Data' },
      ],
      recommendedAction: 'Add a sticky "Get Free Consultation" floating action button and an interactive cost estimator on primary service landing pages.',
      potential: 'HIGH',
      effort: 'LOW',
      confidence: 86,
      affectedPages: [],
    });

    if (competitors.length > 0) {
      const compList = competitors.map((c) => c.domain).slice(0, 3).join(', ');
      found.push({
        fingerprint: fingerprint('biz-competitor-white-space', projectId),
        source: 'COMPETITOR',
        category: 'BUSINESS',
        title: `Target underserved customer segments against ${compList}`,
        summary: `Competitor analysis reveals opportunities to capture high-margin customers by highlighting specialized guarantees, faster turnaround times, or transparent pricing.`,
        evidence: [
          { label: 'Tracked Competitors', value: compList, source: 'Competitor Tracking' },
          { label: 'Strategy', value: 'Differentiation on service depth and customer satisfaction guarantees', source: 'Market Intelligence' },
        ],
        recommendedAction: 'Create comparison and "Why Choose Us" landing pages emphasizing unique value propositions and client warranties.',
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 84,
        affectedPages: [],
      });
    }

    return found;
  }

  /**
   * ── 6. COMPETITOR & SEARCH CONSOLE DETECTORS ─────────────────────────────
   */

  /**
   * The competitor content gap detector joined with search demand.
   */
  private async competitorGapsWithSearchDemand(projectId: string): Promise<Detected[]> {
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId, websiteId: { not: null } },
      select: { id: true, domain: true, websiteId: true },
    });
    if (competitors.length === 0) return [];

    const ourPages = await this.latestPages({ projectId });
    if (ourPages.length === 0) return [];
    const ourBoilerplate = siteBoilerplate(ourPages);

    const demand = await this.searchDemand(projectId);
    const found: Detected[] = [];

    for (const competitor of competitors) {
      const theirPages = await this.latestPages({ id: competitor.websiteId! });
      if (theirPages.length === 0) continue;
      const theirBoilerplate = siteBoilerplate(theirPages);

      for (const page of theirPages) {
        if (['HOME', 'ABOUT', 'CONTACT', 'LEGAL'].includes(page.pageType)) continue;
        const topic = distinctiveTokens(page, theirBoilerplate);
        if (topic.size === 0) continue;

        const match = closestMatch(page, ourPages, { theirs: theirBoilerplate, ours: ourBoilerplate });
        if (match && match.score >= MATCH_THRESHOLD) continue;

        const related = matchDemand(topic, demand);
        const evidence: Detected['evidence'] = [
          {
            label: 'Competitor coverage',
            value: `${competitor.domain} publishes ${page.title || page.url}`,
            source: 'Competitor site crawl',
          },
          {
            label: 'Your coverage',
            value: match
              ? `Nothing close — the nearest page on your site is ${match.page.url} (${Math.round(match.score * 100)}% topic overlap)`
              : 'No page on your site shares a topic word with this',
            source: 'Your site crawl',
          },
        ];

        let confidence = 55;
        let potential: Detected['potential'] = 'MEDIUM';

        if (related.impressions > 0) {
          evidence.push({
            label: 'Your existing search demand',
            value: `${related.impressions.toLocaleString()} impressions across ${related.queries.length} related ${
              related.queries.length === 1 ? 'query' : 'queries'
            } (${related.queries.slice(0, 3).join(', ')})`,
            source: 'Google Search Console',
          });
          confidence = related.impressions >= 1000 ? 88 : 74;
          potential = related.impressions >= 1000 ? 'HIGH' : 'MEDIUM';
        } else {
          evidence.push({
            label: 'Your existing search demand',
            value: 'Not known — Search Console is not connected, or has no impressions for this topic',
            source: 'Google Search Console',
          });
        }

        found.push({
          fingerprint: fingerprint('competitor-gap', competitor.domain, canonicalUrl(page.url)),
          source: 'COMPETITOR',
          category: 'CONTENT',
          title: `Cover "${page.title || topicLabel(topic)}" — ${competitor.domain} does and you do not`,
          summary: related.impressions
            ? `${competitor.domain} has a page for this and your site has nothing close, while your own Search Console already records ${related.impressions.toLocaleString()} impressions on related searches.`
            : `${competitor.domain} has a page for this and your site has nothing close to it.`,
          evidence,
          recommendedAction: `Create a page covering ${topicLabel(topic)}. Review ${page.url} for what they cover, then write something better — not a copy.`,
          potential,
          effort: 'MEDIUM',
          confidence,
          affectedPages: [],
        });
      }
    }

    return found.sort((a, b) => b.confidence - a.confidence).slice(0, 25);
  }

  /** Queries ranking just outside the clicks. */
  private async strikingDistance(projectId: string): Promise<Detected[]> {
    const rows = await this.search.strikingDistance(projectId, { limit: 15 });
    return rows.map((row) => ({
      fingerprint: fingerprint('striking-distance', row.key),
      source: 'SEARCH_CONSOLE',
      category: 'SEO',
      title: `Push "${row.key}" from position ${row.position.toFixed(1)} onto page one`,
      summary: `This query already puts you in front of ${row.impressions.toLocaleString()} people and returns ${row.clicks.toLocaleString()} clicks. Ranking is the constraint, not visibility.`,
      evidence: [
        { label: 'Average position', value: row.position.toFixed(1), source: 'Google Search Console' },
        { label: 'Impressions', value: row.impressions.toLocaleString(), source: 'Google Search Console' },
        { label: 'Clicks', value: row.clicks.toLocaleString(), source: 'Google Search Console' },
        {
          label: 'Selected by',
          value: `positions ${row.criteria.minPosition}–${row.criteria.maxPosition}, at least ${row.criteria.minImpressions.toLocaleString()} impressions over ${row.criteria.days} days`,
          source: 'GrowthX threshold',
        },
      ],
      recommendedAction: 'Find the page ranking for this query and strengthen it: depth, internal links, and a title that matches the search.',
      potential: row.impressions >= 5000 ? 'HIGH' : 'MEDIUM',
      effort: 'MEDIUM',
      confidence: 90,
    }));
  }

  /** Pages seen often and clicked rarely for where they rank. */
  private async ctrShortfall(projectId: string): Promise<Detected[]> {
    const rows = await this.search.ctrOpportunities(projectId, { limit: 15 });
    return rows.map((row) => ({
      fingerprint: fingerprint('ctr-shortfall', canonicalUrl(row.key)),
      source: 'SEARCH_CONSOLE',
      category: 'SEO',
      title: `Rewrite the title and description for ${shortPath(row.key)}`,
      summary: `This page ranks at ${row.position.toFixed(1)} and is seen ${row.impressions.toLocaleString()} times, but is clicked far less than pages usually are at that position.`,
      evidence: [
        { label: 'Impressions', value: row.impressions.toLocaleString(), source: 'Google Search Console' },
        { label: 'Click-through rate', value: `${(row.ctr * 100).toFixed(2)}%`, source: 'Google Search Console' },
        { label: 'Average position', value: row.position.toFixed(1), source: 'Google Search Console' },
        {
          label: 'Clicks the gap represents',
          value: `about ${row.estimatedMissedClicks.toLocaleString()} over this period`,
          source: 'Estimated from a generic position curve, not your industry',
        },
      ],
      recommendedAction: 'Rewrite the page title and meta description to match what people are searching for, then re-check in a fortnight.',
      potential: row.estimatedMissedClicks >= 500 ? 'HIGH' : 'MEDIUM',
      effort: 'LOW',
      confidence: 75,
      affectedPages: [row.key],
    }));
  }

  /** Queries whose ranking fell between two equal periods. */
  private async decliningQueries(projectId: string): Promise<Detected[]> {
    const rows = await this.search.declining(projectId, { limit: 10 });
    return rows.map((row) => ({
      fingerprint: fingerprint('declining', row.query),
      source: 'SEARCH_CONSOLE',
      category: 'SEO',
      title: `"${row.query}" fell from position ${row.previousPosition.toFixed(1)} to ${row.currentPosition.toFixed(1)}`,
      summary: `Clicks went from ${row.previousClicks.toLocaleString()} to ${row.currentClicks.toLocaleString()} across two equal periods.`,
      evidence: [
        { label: 'Previous position', value: row.previousPosition.toFixed(1), source: 'Google Search Console' },
        { label: 'Current position', value: row.currentPosition.toFixed(1), source: 'Google Search Console' },
        { label: 'Impressions', value: row.impressions.toLocaleString(), source: 'Google Search Console' },
      ],
      recommendedAction: 'Open the page that ranks for this query and check what changed: content, internal links, and whether a competitor has published something newer.',
      potential: row.impressions >= 2000 ? 'HIGH' : 'MEDIUM',
      effort: 'MEDIUM',
      confidence: 85,
    }));
  }

  /**
   * ── 7. ANALYTICS DETECTORS ───────────────────────────────────────────────
   */

  /** Pages that already earn, and still rank below where they could. */
  private async highValuePages(projectId: string): Promise<Detected[]> {
    const { rows, hasAnalyticsData } = await this.analytics.pageValue(projectId, 28, 200);
    if (!hasAnalyticsData) return [];

    return rows
      .filter((row) => row.conversions != null && row.conversions > 0 && row.position > 3)
      .sort((a, b) => (b.conversions ?? 0) - (a.conversions ?? 0))
      .slice(0, 10)
      .map((row) => ({
        fingerprint: fingerprint('high-value-page', canonicalUrl(row.page)),
        source: 'ANALYTICS',
        category: 'SEO',
        title: `Improve the ranking of ${shortPath(row.page)} — it already converts`,
        summary: `This page converts ${row.conversions} of ${row.sessions?.toLocaleString()} sessions and ranks at ${row.position.toFixed(1)}. Moving it up puts more people in front of something already known to work.`,
        evidence: [
          { label: 'Conversions', value: String(row.conversions), source: 'Google Analytics' },
          {
            label: 'Conversion rate',
            value: row.conversionRate != null ? `${(row.conversionRate * 100).toFixed(1)}%` : 'unknown',
            source: 'Google Analytics',
          },
          { label: 'Organic clicks', value: row.clicks.toLocaleString(), source: 'Google Search Console' },
          { label: 'Average position', value: row.position.toFixed(1), source: 'Google Search Console' },
        ],
        recommendedAction: 'Strengthen this page for the queries it already ranks for: depth, internal links from related pages, and a title matching the search.',
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 92,
        affectedPages: [row.page],
      }));
  }

  /** Pages with real traffic and no conversions. */
  private async trafficWithoutConversion(projectId: string): Promise<Detected[]> {
    const { rows, hasAnalyticsData } = await this.analytics.pageValue(projectId, 28, 200);
    if (!hasAnalyticsData) return [];

    return rows
      .filter((row) => row.conversions === 0 && (row.sessions ?? 0) >= 200)
      .sort((a, b) => (b.sessions ?? 0) - (a.sessions ?? 0))
      .slice(0, 10)
      .map((row) => ({
        fingerprint: fingerprint('no-conversion', canonicalUrl(row.page)),
        source: 'ANALYTICS',
        category: 'CONTENT',
        title: `${shortPath(row.page)} gets ${row.sessions?.toLocaleString()} sessions and converts none of them`,
        summary: `Search is doing its job for this page — it is found and clicked. What happens after the click is not.`,
        evidence: [
          { label: 'Sessions', value: (row.sessions ?? 0).toLocaleString(), source: 'Google Analytics' },
          { label: 'Conversions', value: '0', source: 'Google Analytics' },
          { label: 'Organic clicks', value: row.clicks.toLocaleString(), source: 'Google Search Console' },
          { label: 'Average position', value: row.position.toFixed(1), source: 'Google Search Console' },
        ],
        recommendedAction: 'Check what this page asks the visitor to do. A page that ranks and is read but has no clear next step converts nobody however much traffic it gets.',
        potential: (row.sessions ?? 0) >= 1000 ? 'HIGH' : 'MEDIUM',
        effort: 'MEDIUM',
        confidence: 70,
        affectedPages: [row.page],
      }));
  }

  /**
   * ── 8. BASELINE SYNTHESIS ────────────────────────────────────────────────
   */

  /** Synthesizes initial baseline growth opportunities for newly onboarded projects. */
  private async domainBaselineSynthesis(projectId: string): Promise<Detected[]> {
    const [project, website] = await Promise.all([
      this.prisma.project.findFirst({ where: { id: projectId }, select: { name: true } }),
      this.prisma.website ? this.prisma.website.findFirst({ where: { projectId }, select: { domain: true } }) : Promise.resolve(null),
    ]);

    const business = project?.name || website?.domain || 'Your business';
    const domain = website?.domain || 'your website';

    return [
      {
        fingerprint: fingerprint('baseline-seo-audit', projectId),
        source: 'WEBSITE',
        category: 'SEO',
        title: `Conduct initial on-page SEO & Keyword cluster audit for ${domain}`,
        summary: `Establish a strong keyword foundation by targeting high-intent commercial keywords and optimizing core metadata.`,
        evidence: [
          { label: 'Target Property', value: domain, source: 'Project Settings' },
          { label: 'Action Area', value: 'Keyword research, meta titles, heading hierarchy, and search intent alignment', source: 'GrowthX SEO Playbook' },
        ],
        recommendedAction: 'Run a full website crawl, identify primary search terms for each service, and optimize page titles and H1 tags.',
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 90,
        affectedPages: [],
      },
      {
        fingerprint: fingerprint('baseline-tech-schema', projectId),
        source: 'WEBSITE',
        category: 'TECHNICAL',
        title: `Deploy Organization and Service Schema JSON-LD on ${domain}`,
        summary: `Ensure search bots and LLMs accurately identify your business entity, services, and contact channels.`,
        evidence: [
          { label: 'Entity Profile', value: business, source: 'Entity Configuration' },
          { label: 'Technical SEO Factor', value: 'Structured JSON-LD schema increases rich snippet CTR and AI citation frequency', source: 'Search Best Practices' },
        ],
        recommendedAction: 'Add Organization, WebSite, and LocalBusiness/Service JSON-LD schemas to your site header template.',
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 88,
        affectedPages: [],
      },
      {
        fingerprint: fingerprint('baseline-content-pillar', projectId),
        source: 'WEBSITE',
        category: 'CONTENT',
        title: `Create comprehensive pillar content & FAQ section for ${business}`,
        summary: `Build topical authority by creating in-depth guides addressing the most pressing questions and pain points in your industry.`,
        evidence: [
          { label: 'Content Strategy', value: 'Pillar & cluster architecture', source: 'GrowthX Content Strategy' },
          { label: 'Search Intent', value: 'Captures informational searches and feeds Google People Also Ask', source: 'Industry Benchmark' },
        ],
        recommendedAction: 'Publish 3 in-depth pillar guides covering core services with embedded FAQ schemas.',
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 85,
        affectedPages: [],
      },
    ];
  }

  /**
   * ── HELPERS ──────────────────────────────────────────────────────────────
   */

  /** Pages from the most recent completed crawl of a website. */
  private async latestPages(websiteWhere: any) {
    const job = await this.prisma.crawlJob.findFirst({
      where: { status: 'COMPLETED', website: websiteWhere },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return [];

    const rows = await this.prisma.page.findMany({
      where: { crawlJobId: job.id, statusCode: { gte: 200, lt: 300 } },
      select: { url: true, title: true, pageType: true },
    });

    const seen = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = canonicalUrl(row.url);
      if (!seen.has(key)) seen.set(key, row);
    }
    return [...seen.values()];
  }

  /** The customer's own queries with impressions, for matching topics against. */
  private async searchDemand(projectId: string) {
    try {
      const rows = await this.search.top(projectId, 'QUERY', { days: 28, limit: 500 });
      return rows.map((row) => ({ query: row.key, impressions: row.impressions, tokens: topicTokens(row.key) }));
    } catch {
      return [];
    }
  }
}

/**
 * Search demand related to a topic.
 */
function matchDemand(topic: Set<string>, demand: { query: string; impressions: number; tokens: Set<string> }[]) {
  const queries: string[] = [];
  let impressions = 0;

  for (const row of demand) {
    if (topic.size === 0) continue;
    let shared = 0;
    for (const word of topic) if (row.tokens.has(word)) shared += 1;
    if (shared / topic.size >= 0.5) {
      queries.push(row.query);
      impressions += row.impressions;
    }
  }

  return { queries: queries.sort(), impressions };
}

/**
 * Ordering for the list.
 */
function priorityOf(item: Detected): number {
  const band = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
  return band[item.potential] * 10 + (item.confidence / 100) * 5 - band[item.effort] * 2;
}

/** Stable across runs, so a dismissal survives re-detection. */
function fingerprint(...parts: string[]): string {
  return crypto.createHash('sha1').update(parts.join('|').toLowerCase()).digest('hex').slice(0, 24);
}

function topicLabel(topic: Set<string>): string {
  return [...topic].slice(0, 4).join(' ');
}

function shortPath(url: string): string {
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}
