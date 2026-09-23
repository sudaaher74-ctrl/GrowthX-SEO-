import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface InterceptDefect {
  type: 'NO_SCHEMA' | 'SLOW_CWV' | 'THIN_CONTENT' | 'WEAK_TITLE' | 'NO_DIRECT_ANSWER';
  label: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  description: string;
  points: number;
}

export interface InterceptBlueprint {
  id: string;
  keyword: string;
  targetH1: string;
  targetSlug: string;
  targetWordCount: number;
  attackThesis: string;
  semanticHeadings: Array<{ level: 'H2' | 'H3'; title: string; intentSummary: string }>;
  jsonLdSchema: string;
  keyDifferentiators: string[];
  deliverableCode: string;
}

export interface InterceptOpportunity {
  id: string;
  keyword: string;
  intent: 'COMMERCIAL' | 'INFORMATIONAL' | 'TRANSACTIONAL';
  /**
   * The customer's own Search Console impressions for this query over the last
   * 30 days. Null when Search Console has no row for it.
   */
  searchVolume: number | null;
  competitorDomain: string;
  competitorName: string;
  competitorUrl: string;
  competitorRank: number | null;
  /** Average Search Console position. Null when not measured. */
  customerRank: number | null;
  /** The customer already has a page whose title or H1 covers this topic. */
  coveredByUs: boolean;
  vulnerabilityScore: number;
  vulnerabilityTier: 'PRIME_TARGET' | 'MODERATE' | 'DEFENDED';
  defects: InterceptDefect[];
  blueprint: InterceptBlueprint;
  responseTimeMs?: number | null;
  wordCount?: number | null;
}

export interface InterceptScoreboard {
  totalPoachable: number;
  primeTargetsCount: number;
  /** Sum of the customer's measured Search Console impressions across these topics. */
  searchImpressionsAtStake: number;
  averageVulnerabilityScore: number;
  /** Null when no competitor page showed a defect. */
  topDefectArea: string | null;
  totalAuditedPages: number;
  avgResponseTimeMs: number;
}

export interface InterceptAnalysisResponse {
  scoreboard: InterceptScoreboard;
  opportunities: InterceptOpportunity[];
}

@Injectable()
export class CompetitorInterceptService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates all tracked competitor pages against client pages to discover
   * competitor URLs suffering from real, measured structural SEO defects.
   * 100% grounded in real crawl data with zero synthetic fallbacks.
   */
  async getInterceptOpportunities(
    projectId: string,
    options?: { competitorId?: string },
  ): Promise<InterceptAnalysisResponse> {
    const website = await this.prisma.website.findFirst({
      where: { projectId },
      select: { id: true, domain: true },
    });
    const customerDomain = website?.domain || 'yourdomain.com';

    // 1. Fetch tracked competitors
    const trackedCompetitors = await this.prisma.competitorDomain.findMany({
      where: {
        projectId,
        ...(options?.competitorId ? { id: options.competitorId } : {}),
      },
      select: {
        id: true,
        domain: true,
        name: true,
        label: true,
        websiteId: true,
      },
      take: 10,
    });

    if (trackedCompetitors.length === 0) {
      return {
        scoreboard: {
          totalPoachable: 0,
          primeTargetsCount: 0,
          searchImpressionsAtStake: 0,
          averageVulnerabilityScore: 0,
          topDefectArea: null,
          totalAuditedPages: 0,
          avgResponseTimeMs: 0,
        },
        opportunities: [],
      };
    }

    // 2. Fetch customer page titles to check our coverage
    let ourPageTitles: string[] = [];
    if (website?.id) {
      const ourPages = await this.prisma.page.findMany({
        where: {
          crawlJob: { websiteId: website.id, status: 'COMPLETED' },
          statusCode: { gte: 200, lt: 300 },
        },
        select: { title: true, h1: true, url: true },
        take: 200,
      });
      ourPageTitles = ourPages
        .flatMap((p) => [
          p.title || '',
          ...(Array.isArray(p.h1) ? p.h1 : [p.h1 || '']),
        ])
        .filter(Boolean)
        .map((t) => t.toLowerCase());
    }

    // 3. Attempt to fetch real Search Console queries for this project
    const gscMap = new Map<string, { impressions: number; position: number | null }>();
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const gscRows: any[] = await (this.prisma.gscDailyMetric as any).groupBy({
        by: ['query'],
        where: { projectId, grain: 'QUERY', date: { gte: since }, query: { not: null } },
        _sum: { impressions: true },
        _avg: { position: true },
        orderBy: { _sum: { impressions: 'desc' } },
        take: 100,
      });
      for (const row of gscRows) {
        if (row?.query) {
          gscMap.set(row.query.toLowerCase(), {
            impressions: row._sum?.impressions ?? 0,
            position: row._avg?.position ?? null,
          });
        }
      }
    } catch {
      // GSC not configured or unpopulated
    }

    // 4. For each competitor, fetch real crawled pages
    const opportunities: InterceptOpportunity[] = [];
    const seenUrls = new Set<string>();
    let totalAuditedPages = 0;
    let totalResponseTimeMs = 0;
    let pagesWithResponseTime = 0;

    for (const competitor of trackedCompetitors) {
      const compName = competitor.name || competitor.label || competitor.domain;
      if (!competitor.websiteId) continue;

      const pages = await this.prisma.page.findMany({
        where: {
          crawlJob: { websiteId: competitor.websiteId, status: 'COMPLETED' },
          statusCode: { gte: 200, lt: 300 },
        },
        select: {
          id: true,
          url: true,
          title: true,
          metaDescription: true,
          h1: true,
          h2: true,
          wordCount: true,
          responseTimeMs: true,
          pageType: true,
          schemas: { select: { schemaType: true } },
          issues: { select: { issueType: true, severity: true } },
        },
        take: 100,
      });

      totalAuditedPages += pages.length;

      for (const page of pages) {
        if (page.responseTimeMs) {
          totalResponseTimeMs += page.responseTimeMs;
          pagesWithResponseTime++;
        }

        // Avoid duplicate URLs and ignore utility/navigation pages
        if (seenUrls.has(page.url)) continue;
        if (this.isUtilityOrBoilerplatePath(page.url)) continue;
        seenUrls.add(page.url);

        const keyword = this.extractKeyword(page);
        if (!keyword || keyword.length < 3) continue;

        // Check if customer already covers this topic
        const isCoveredByUs = ourPageTitles.some((t) => t.includes(keyword.toLowerCase()));

        const { defects, score } = this.measureDefects(page);
        if (score < 30) continue; // Skip pages that have minimal or no defects

        const vulnerabilityTier: 'PRIME_TARGET' | 'MODERATE' | 'DEFENDED' =
          score >= 65 ? 'PRIME_TARGET' : score >= 45 ? 'MODERATE' : 'DEFENDED';

        const intent: 'COMMERCIAL' | 'INFORMATIONAL' | 'TRANSACTIONAL' =
          /cost|pricing|software|tool|platform|agency|service|best|supplier|manufacturer|export/i.test(keyword)
            ? 'COMMERCIAL'
            : /buy|order|quote|hire|demo|trial/i.test(keyword)
            ? 'TRANSACTIONAL'
            : 'INFORMATIONAL';

        // 100% REAL: If Search Console has this query, use real impressions; otherwise null.
        const gscMatch = gscMap.get(keyword.toLowerCase());
        const searchVolume = gscMatch ? Math.round(gscMatch.impressions) : null;
        const competitorRank = null; // Unmeasured without live SERP probe — never fabricated
        const customerRank = gscMatch?.position ? Math.round(gscMatch.position) : null;

        const blueprint = this.createCounterAttackBlueprint({
          keyword,
          competitorDomain: competitor.domain,
          competitorUrl: page.url,
          customerDomain,
          defects,
          wordCount: page.wordCount || 0,
          intent,
        });

        opportunities.push({
          id: `intercept_${competitor.id}_${Buffer.from(page.url).toString('hex').slice(0, 12)}`,
          keyword,
          intent,
          searchVolume,
          competitorDomain: competitor.domain,
          competitorName: compName,
          competitorUrl: page.url,
          competitorRank,
          customerRank,
          coveredByUs: isCoveredByUs,
          vulnerabilityScore: score,
          vulnerabilityTier,
          defects,
          blueprint,
          responseTimeMs: page.responseTimeMs || null,
          wordCount: page.wordCount || null,
        });
      }
    }

    // Sort opportunities by highest vulnerability score first
    opportunities.sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);

    // Compute scoreboard
    const totalPoachable = opportunities.length;
    const primeTargetsCount = opportunities.filter((o) => o.vulnerabilityTier === 'PRIME_TARGET').length;
    // Measured impressions only. This used to multiply them by an assumed 32%
    // click-through rate and present the product as visits a month.
    const searchImpressionsAtStake = opportunities.reduce((acc, o) => acc + (o.searchVolume ?? 0), 0);
    const avgScore =
      totalPoachable > 0
        ? Math.round(opportunities.reduce((acc, o) => acc + o.vulnerabilityScore, 0) / totalPoachable)
        : 0;

    const avgResponseTimeMs =
      pagesWithResponseTime > 0 ? Math.round(totalResponseTimeMs / pagesWithResponseTime) : 0;

    const defectCounts: Record<string, number> = {};
    for (const opp of opportunities) {
      for (const d of opp.defects) {
        defectCounts[d.label] = (defectCounts[d.label] || 0) + 1;
      }
    }
    const topDefectArea =
      Object.entries(defectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      scoreboard: {
        totalPoachable,
        primeTargetsCount,
        searchImpressionsAtStake,
        averageVulnerabilityScore: avgScore,
        topDefectArea,
        totalAuditedPages,
        avgResponseTimeMs,
      },
      opportunities,
    };
  }

  /**
   * Generates an on-demand, comprehensive Counter-Attack Blueprint for any keyword.
   */
  async generateBlueprint(
    projectId: string,
    input: {
      keyword: string;
      competitorDomain: string;
      competitorUrl?: string;
      weaknessType?: string;
    },
  ): Promise<InterceptBlueprint> {
    const website = await this.prisma.website.findFirst({
      where: { projectId },
      select: { domain: true },
    });
    const customerDomain = website?.domain || 'yourdomain.com';

    // The defects are read off the competitor's crawled page. Without one
    // there is nothing measured to cite, so none are claimed.
    const page = input.competitorUrl
      ? await this.prisma.page.findFirst({
          where: { url: input.competitorUrl, statusCode: { gte: 200, lt: 300 } },
          orderBy: { crawledAt: 'desc' },
          select: {
            title: true,
            metaDescription: true,
            h2: true,
            wordCount: true,
            responseTimeMs: true,
            schemas: { select: { schemaType: true } },
          },
        })
      : null;
    const defects = page ? this.measureDefects(page).defects : [];

    return this.createCounterAttackBlueprint({
      keyword: input.keyword,
      competitorDomain: input.competitorDomain,
      competitorUrl: input.competitorUrl || `https://${input.competitorDomain}/${this.slugify(input.keyword)}`,
      customerDomain,
      defects,
      wordCount: page?.wordCount || 0,
      intent: 'COMMERCIAL',
    });
  }

  private createCounterAttackBlueprint(params: {
    keyword: string;
    competitorDomain: string;
    competitorUrl: string;
    customerDomain: string;
    defects: InterceptDefect[];
    wordCount: number;
    intent: 'COMMERCIAL' | 'INFORMATIONAL' | 'TRANSACTIONAL';
  }): InterceptBlueprint {
    const { keyword, competitorDomain, customerDomain, defects, wordCount } = params;
    const cleanKeyword = this.toTitleCase(keyword);
    const slug = this.slugify(keyword);

    const targetH1 = `The Complete Guide to ${cleanKeyword} in ${new Date().getFullYear()}`;
    const targetSlug = `/solutions/${slug}`;
    const targetWordCount = Math.max(1600, wordCount * 3);
    const defectLabels = defects.map((d) => d.label.toLowerCase()).join(', ');
    const attackThesis = defects.length
      ? `The crawled page on ${competitorDomain} shows these measured weaknesses: ${defectLabels}. A page on ${customerDomain} that covers the topic in more depth, loads quickly and carries valid JSON-LD addresses each of them.`
      : `No crawled page on ${competitorDomain} was found for this topic, so no weakness is claimed. The outline below is a starting structure for a page on ${customerDomain}.`;

    const semanticHeadings: Array<{ level: 'H2' | 'H3'; title: string; intentSummary: string }> = [
      {
        level: 'H2',
        title: `What is ${cleanKeyword} and Why Does It Matter Today?`,
        intentSummary: 'Immediate direct definition targeting Google AI Overview and LLM entity extraction.',
      },
      {
        level: 'H2',
        title: `Key Architectural Requirements & Evaluation Criteria`,
        intentSummary: 'In-depth breakdown of features, reliability, and modern technical specifications.',
      },
      {
        level: 'H3',
        title: `Performance Benchmarks vs Traditional Alternatives`,
        intentSummary: 'Comparative table illustrating latency, crawl efficiency, and automation ROI.',
      },
      {
        level: 'H2',
        title: `Step-by-Step Implementation Framework`,
        intentSummary: 'Actionable 4-step deployment sequence that captures high-intent technical buyers.',
      },
      {
        level: 'H2',
        title: `Frequently Asked Questions About ${cleanKeyword}`,
        intentSummary: 'Structured FAQ block anchored directly into JSON-LD FAQPage schema markup.',
      },
    ];

    // The answers are the customer's to write. This used to ship publishable
    // JSON-LD claiming "sub-second TTFB" and results "within 14 to 28 days" on
    // the customer's behalf, none of it measured.
    const jsonLdObj = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `What is ${keyword}?`,
          acceptedAnswer: { '@type': 'Answer', text: '[Your answer]' },
        },
        {
          '@type': 'Question',
          name: `How does ${customerDomain} compare with ${competitorDomain}?`,
          acceptedAnswer: { '@type': 'Answer', text: '[Your answer]' },
        },
        {
          '@type': 'Question',
          name: `How do I choose a provider for ${keyword}?`,
          acceptedAnswer: { '@type': 'Answer', text: '[Your answer]' },
        },
      ],
    };

    const jsonLdSchema = JSON.stringify(jsonLdObj, null, 2);

    const deliverableCode = `<!-- GrowthX Counter-Attack Content Blueprint -->
<!-- Target Keyword: ${cleanKeyword} -->
<!-- Intercept Target: ${competitorDomain} -->
<!-- Proposed URL: https://${customerDomain}${targetSlug} -->

<article class="prose max-w-4xl mx-auto py-12">
  <header class="mb-10">
    <h1 class="text-4xl font-extrabold tracking-tight text-slate-900">${targetH1}</h1>
    <p class="mt-4 text-xl text-slate-600 leading-relaxed">
      <!-- Your one-paragraph summary of ${cleanKeyword} -->
    </p>
  </header>

  <section class="space-y-6">
    <h2>What is ${cleanKeyword}?</h2>
    <p>
      <!-- A direct 40–60 word definition, written for this business -->
    </p>
  </section>

  <!-- Structured FAQ Schema Patch -->
  <script type="application/ld+json">
${jsonLdSchema}
  </script>
</article>`;

    return {
      id: `bp_${this.slugify(keyword)}_${Date.now()}`,
      keyword,
      targetH1,
      targetSlug,
      targetWordCount,
      attackThesis,
      semanticHeadings,
      jsonLdSchema,
      keyDifferentiators: [
        'Add valid FAQPage JSON-LD with your own answers',
        'Keep server response under 800ms',
        'Include a comparison table a search engine can lift as a snippet',
        `Cover the topic in at least ${targetWordCount.toLocaleString()} words`,
      ],
      deliverableCode,
    };
  }

  /** Weaknesses read directly off a crawled page, with the points each is worth. */
  private measureDefects(page: {
    title?: string | null;
    metaDescription?: string | null;
    h2?: unknown;
    wordCount?: number | null;
    responseTimeMs?: number | null;
    schemas?: unknown[] | null;
  }): { defects: InterceptDefect[]; score: number } {
    const defects: InterceptDefect[] = [];
    let score = 0;

    const schemasCount = page.schemas?.length || 0;
    if (schemasCount === 0) {
      defects.push({
        type: 'NO_SCHEMA',
        label: 'Missing Structured JSON-LD',
        severity: 'HIGH',
        description: 'Competitor page has zero Schema.org structured data, missing Rich Results & AI citation anchors.',
        points: 25,
      });
      score += 25;
    }

    const responseTime = page.responseTimeMs || 0;
    if (responseTime > 800) {
      defects.push({
        type: 'SLOW_CWV',
        label: `Slow Server Response (${responseTime}ms)`,
        severity: responseTime > 1500 ? 'CRITICAL' : 'HIGH',
        description: `Server TTFB is ${responseTime}ms, failing Google Core Web Vitals threshold for optimal indexing.`,
        points: responseTime > 1500 ? 25 : 20,
      });
      score += responseTime > 1500 ? 25 : 20;
    }

    const wordCount = page.wordCount || 0;
    if (wordCount > 0 && wordCount < 600) {
      defects.push({
        type: 'THIN_CONTENT',
        label: `Thin Content Depth (${wordCount} words)`,
        severity: wordCount < 300 ? 'CRITICAL' : 'HIGH',
        description: `Page provides surface-level content (${wordCount} words), lacking comprehensive sub-topic exploration.`,
        points: wordCount < 300 ? 25 : 20,
      });
      score += wordCount < 300 ? 25 : 20;
    }

    if (!page.metaDescription || (page.title && page.title.length < 25)) {
      defects.push({
        type: 'WEAK_TITLE',
        label: 'Weak Title / Missing Meta Description',
        severity: 'MEDIUM',
        description: 'Snippet CTR is impaired due to suboptimal title length or missing meta description tag.',
        points: 15,
      });
      score += 15;
    }

    const h2List = Array.isArray(page.h2) ? page.h2 : [];
    if (h2List.length < 2) {
      defects.push({
        type: 'NO_DIRECT_ANSWER',
        label: 'Lacks Direct Answer & Heading Hierarchy',
        severity: 'MEDIUM',
        description: 'Absence of structured H2 sections prevents LLM search engines and Google from extracting direct answers.',
        points: 15,
      });
      score += 15;
    }

    return { defects, score: Math.min(98, score) };
  }

  private isUtilityOrBoilerplatePath(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, '');
      if (pathname === '' || pathname === '/') return true;
      return /^\/(privacy|terms|cookie|contact|about|management|our-management|team|leadership|careers|jobs|login|signin|signup|register|sitemap|cdn-cgi|legal|disclaimer|sustainability)(\/|$)/.test(
        pathname,
      );
    } catch {
      return false;
    }
  }

  private extractKeyword(page: any): string {
    const raw = (Array.isArray(page.h1) ? page.h1[0] : page.h1) || page.title || '';
    if (!raw) return '';

    // Strip brand suffix (e.g. " | Acme Corp" or " - Competitor")
    let cleaned = raw.replace(/\s*[-|–—].*$/, '').trim();

    // Remove filler punctuation
    cleaned = cleaned.replace(/[^\w\s-]/g, '').trim();

    const words = cleaned.split(/\s+/);
    if (words.length > 7) {
      cleaned = words.slice(0, 5).join(' ');
    }
    return cleaned.toLowerCase();
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
  }
}
