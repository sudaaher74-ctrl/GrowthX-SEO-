import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ProgrammaticVariable {
  name: string;
  exampleValues: string[];
  description: string;
}

export interface ProgrammaticCluster {
  id: string;
  patternName: string;
  category: 'INTEGRATIONS' | 'COMPARISONS' | 'TEMPLATES' | 'GLOSSARY' | 'LOCATIONS' | 'TOOLS' | 'CATEGORY_HUBS';
  urlPattern: string;
  competitorDomain: string;
  pageCount: number;
  commercialIntent: 'HIGH' | 'MEDIUM' | 'TRANSACTIONAL';
  variables: ProgrammaticVariable[];
  sampleUrls: string[];
  counterStrategy: {
    recommendedUrlPattern: string;
    targetH1Formula: string;
    recommendedSchemaType: string;
    contentDepthBenchmark: string;
    differentiatorAngle: string;
    sampleDeliverableTemplate: string;
  };
}

export interface ProgrammaticScoreboard {
  totalProgrammaticClusters: number;
  totalCompetitorPagesIndexed: number;
  topPatternCategory: string;
  readyToCounterCount: number;
}

export interface ProgrammaticMatrixResponse {
  scoreboard: ProgrammaticScoreboard;
  clusters: ProgrammaticCluster[];
}

@Injectable()
export class ProgrammaticDecompilerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Decompiles competitor crawled pages into distinct programmatic SEO patterns
   * and generates our counter-attack architectural blueprints.
   */
  async getProgrammaticMatrix(
    projectId: string,
    competitorId?: string,
  ): Promise<ProgrammaticMatrixResponse> {
    const website = await this.prisma.website.findFirst({
      where: { projectId },
      select: { id: true, domain: true },
    });
    const customerDomain = website?.domain || 'yourdomain.com';

    // 1. Fetch tracked competitors
    const competitors = await this.prisma.competitorDomain.findMany({
      where: {
        projectId,
        ...(competitorId ? { id: competitorId } : {}),
      },
      select: {
        id: true,
        domain: true,
        name: true,
        websiteId: true,
      },
      take: 5,
    });

    if (competitors.length === 0) {
      return {
        scoreboard: {
          totalProgrammaticClusters: 0,
          totalCompetitorPagesIndexed: 0,
          topPatternCategory: 'None',
          readyToCounterCount: 0,
        },
        clusters: [],
      };
    }

    const clusters: ProgrammaticCluster[] = [];
    let totalPagesIndexed = 0;

    for (const comp of competitors) {
      const compDomain = comp.domain;
      let pages: Array<{ url: string; title: string | null; h1: any }> = [];

      if (comp.websiteId) {
        pages = await this.prisma.page.findMany({
          where: {
            crawlJob: { websiteId: comp.websiteId, status: 'COMPLETED' },
            statusCode: { gte: 200, lt: 300 },
          },
          select: { url: true, title: true, h1: true },
          take: 300,
        });
      }

      totalPagesIndexed += pages.length;

      // Group pages by directory / URL path segments
      const detected = this.detectPatternsFromPages(pages, compDomain, customerDomain);
      clusters.push(...detected);
    }

    return {
      scoreboard: {
        totalProgrammaticClusters: clusters.length,
        totalCompetitorPagesIndexed: totalPagesIndexed,
        topPatternCategory: clusters[0]?.category || 'None',
        readyToCounterCount: clusters.length,
      },
      clusters,
    };
  }

  private detectPatternsFromPages(
    pages: Array<{ url: string; title: string | null; h1: any }>,
    compDomain: string,
    customerDomain: string,
  ): ProgrammaticCluster[] {
    const integrationUrls: string[] = [];
    const comparisonUrls: string[] = [];
    const templateUrls: string[] = [];
    const locationUrls: string[] = [];
    const toolUrls: string[] = [];

    for (const p of pages) {
      const url = p.url.toLowerCase();
      if (url.includes('/integrat') || url.includes('/apps/') || url.includes('/connect/')) {
        integrationUrls.push(p.url);
      } else if (url.includes('/vs/') || url.includes('/compare') || url.includes('-alternative') || url.includes('-vs-')) {
        comparisonUrls.push(p.url);
      } else if (url.includes('/template') || url.includes('/example') || url.includes('/samples/')) {
        templateUrls.push(p.url);
      } else if (url.includes('/location') || url.includes('/city/') || url.includes('/areas/')) {
        locationUrls.push(p.url);
      } else if (url.includes('/tool') || url.includes('/calculat') || url.includes('/checker')) {
        toolUrls.push(p.url);
      }
    }

    const results: ProgrammaticCluster[] = [];
    const year = new Date().getFullYear();
    const hex = Buffer.from(compDomain).toString('hex').slice(0, 8);

    // Nothing here measures a competitor's traffic, so no visit figure is
    // attached (this used to be page count × 520). Example values are the
    // competitor's own slugs, and the templates are scaffolds for the customer
    // to fill — never claims about either business.
    if (comparisonUrls.length >= 2) {
      results.push({
        id: `prog_comp_${hex}`,
        patternName: 'Direct Competitor & Alternative Comparisons',
        category: 'COMPARISONS',
        urlPattern: `https://${compDomain}/vs/{competitor-slug}`,
        competitorDomain: compDomain,
        pageCount: comparisonUrls.length,
        commercialIntent: 'HIGH',
        variables: [
          { name: 'competitor-slug', exampleValues: slugsFrom(comparisonUrls), description: 'Rival being compared, as it appears in their URLs' },
        ],
        sampleUrls: comparisonUrls.slice(0, 3),
        counterStrategy: {
          recommendedUrlPattern: `https://${customerDomain}/compare/{brand}-vs-{competitor}`,
          targetH1Formula: `{Your Brand} vs {Competitor}: Side-by-Side Comparison (${year})`,
          recommendedSchemaType: 'Product, FAQPage',
          contentDepthBenchmark: '1,500+ words + side-by-side comparison table + FAQ',
          differentiatorAngle: `${compDomain} publishes ${comparisonUrls.length} comparison pages. Publish your own, with figures you can back up and honest trade-offs.`,
          sampleDeliverableTemplate: `<!-- Comparison page scaffold: replace every [bracket] with your own facts -->\n<h1>{Brand} vs {Competitor}: Side-by-Side Comparison</h1>\n<p>[One-paragraph summary of who each option suits]</p>\n<table class="comparison-grid">\n  <thead><tr><th>Capability</th><th>{Brand}</th><th>{Competitor}</th></tr></thead>\n  <tbody>\n    <tr><td>[Capability]</td><td>[Your answer]</td><td>[Their answer]</td></tr>\n  </tbody>\n</table>`,
        },
      });
    }

    if (integrationUrls.length >= 2) {
      results.push({
        id: `prog_int_${hex}`,
        patternName: 'Ecosystem & Integration Directory',
        category: 'INTEGRATIONS',
        urlPattern: `https://${compDomain}/integrations/{app-slug}`,
        competitorDomain: compDomain,
        pageCount: integrationUrls.length,
        commercialIntent: 'HIGH',
        variables: [
          { name: 'app-slug', exampleValues: slugsFrom(integrationUrls), description: 'Partner or product being connected, as it appears in their URLs' },
        ],
        sampleUrls: integrationUrls.slice(0, 3),
        counterStrategy: {
          recommendedUrlPattern: `https://${customerDomain}/integrations/{app-slug}`,
          targetH1Formula: `Connect {App Name} with {Your Brand}`,
          recommendedSchemaType: 'SoftwareApplication',
          contentDepthBenchmark: '800+ words + setup steps + FAQ',
          differentiatorAngle: `${compDomain} publishes ${integrationUrls.length} integration pages. Cover the same partners with concrete setup steps.`,
          sampleDeliverableTemplate: `<!-- Integration page scaffold: replace every [bracket] with your own facts -->\n<h1>Connect {App Name} with {Brand}</h1>\n<p>[What the integration does, in one sentence]</p>\n<ol class="setup-steps">\n  <li>[Step 1]</li>\n  <li>[Step 2]</li>\n  <li>[Step 3]</li>\n</ol>`,
        },
      });
    }

    if (templateUrls.length >= 2) {
      results.push({
        id: `prog_tmpl_${hex}`,
        patternName: 'Template & Asset Library',
        category: 'TEMPLATES',
        urlPattern: `https://${compDomain}/templates/{template-slug}`,
        competitorDomain: compDomain,
        pageCount: templateUrls.length,
        commercialIntent: 'MEDIUM',
        variables: [
          { name: 'template-slug', exampleValues: slugsFrom(templateUrls), description: 'Template or example, as it appears in their URLs' },
        ],
        sampleUrls: templateUrls.slice(0, 3),
        counterStrategy: {
          recommendedUrlPattern: `https://${customerDomain}/templates/{template-slug}`,
          targetH1Formula: `Free {Template Name} Template (${year})`,
          recommendedSchemaType: 'CreativeWork, FAQPage',
          contentDepthBenchmark: '1,000+ words + downloadable file + preview',
          differentiatorAngle: `${compDomain} publishes ${templateUrls.length} template pages. Offer comparable resources for the same use cases.`,
          sampleDeliverableTemplate: `<!-- Template page scaffold: replace every [bracket] with your own content -->\n<h1>{Template Name}</h1>\n<p>[Who it is for and what it helps them do]</p>`,
        },
      });
    }

    return results;
  }
}

/** Up to four distinct final path segments from real URLs, e.g. "hubspot". */
function slugsFrom(urls: string[]): string[] {
  const slugs = new Set<string>();
  for (const url of urls) {
    try {
      const last = new URL(url).pathname.split('/').filter(Boolean).pop();
      if (last) slugs.add(decodeURIComponent(last).toLowerCase());
    } catch {
      // not a URL; nothing to take from it
    }
    if (slugs.size >= 4) break;
  }
  return [...slugs];
}
