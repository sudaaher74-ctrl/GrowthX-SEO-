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
  estimatedMonthlyVisits: number;
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
  estimatedTotalTrafficCaptured: number;
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
          estimatedTotalTrafficCaptured: 0,
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

    const totalTraffic = clusters.reduce((acc, c) => acc + c.estimatedMonthlyVisits, 0);

    return {
      scoreboard: {
        totalProgrammaticClusters: clusters.length,
        totalCompetitorPagesIndexed: totalPagesIndexed,
        estimatedTotalTrafficCaptured: totalTraffic,
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

    if (comparisonUrls.length >= 2) {
      results.push({
        id: `prog_comp_${Buffer.from(compDomain).toString('hex').slice(0, 8)}`,
        patternName: 'Direct Competitor & Alternative Comparisons',
        category: 'COMPARISONS',
        urlPattern: `https://${compDomain}/vs/{competitor-slug}`,
        competitorDomain: compDomain,
        pageCount: comparisonUrls.length,
        estimatedMonthlyVisits: comparisonUrls.length * 520,
        commercialIntent: 'HIGH',
        variables: [
          { name: 'competitor-slug', exampleValues: ['semrush', 'ahrefs', 'moz'], description: 'Target rival platform being compared' },
          { name: 'feature_matrix', exampleValues: ['pricing', 'reporting', 'ai-speed'], description: 'Head-to-head comparison dimensions' },
        ],
        sampleUrls: comparisonUrls.slice(0, 3),
        counterStrategy: {
          recommendedUrlPattern: `https://${customerDomain}/compare/{brand}-vs-{competitor}`,
          targetH1Formula: `{Your Brand} vs {Competitor}: Complete Unbiased Comparison (2026)`,
          recommendedSchemaType: 'Product, FAQPage',
          contentDepthBenchmark: '1,500+ words + side-by-side spec table + customer review quote',
          differentiatorAngle: 'Competitor comparison pages are heavily biased and lack real performance benchmarks. Our counter-blueprint provides verifiable AST proof and honest trade-offs.',
          sampleDeliverableTemplate: `<!-- Programmatic Comparison Matrix Template -->\n<h1>{Brand} vs {Competitor}: Definitive Feature & Performance Breakdown</h1>\n<p>Looking for a modern alternative to {Competitor}? See how {Brand}'s autonomous engine delivers verifiable results without manual intervention.</p>\n<table class="comparison-grid">\n  <thead><tr><th>Capability</th><th>{Brand}</th><th>{Competitor}</th></tr></thead>\n  <tbody>\n    <tr><td>Autonomous Execution</td><td>Included (Live AST)</td><td>Manual CSV Only</td></tr>\n    <tr><td>AI Citation Engine</td><td>Perplexity + ChatGPT</td><td>Traditional SERP only</td></tr>\n  </tbody>\n</table>`,
        },
      });
    }

    if (integrationUrls.length >= 2) {
      results.push({
        id: `prog_int_${Buffer.from(compDomain).toString('hex').slice(0, 8)}`,
        patternName: 'Ecosystem & Integration Directory',
        category: 'INTEGRATIONS',
        urlPattern: `https://${compDomain}/integrations/{app-slug}`,
        competitorDomain: compDomain,
        pageCount: integrationUrls.length,
        estimatedMonthlyVisits: integrationUrls.length * 380,
        commercialIntent: 'HIGH',
        variables: [
          { name: 'app-slug', exampleValues: ['slack', 'shopify', 'hubspot', 'wordpress'], description: 'Partner technology being connected' },
          { name: 'workflow_category', exampleValues: ['cms', 'crm', 'notifications'], description: 'Integration functional domain' },
        ],
        sampleUrls: integrationUrls.slice(0, 3),
        counterStrategy: {
          recommendedUrlPattern: `https://${customerDomain}/integrations/{app-slug}`,
          targetH1Formula: `Connect {App Name} with {Your Brand}: 1-Click Automated Setup`,
          recommendedSchemaType: 'SoftwareApplication',
          contentDepthBenchmark: '800+ words + webhook parameters + 3-step setup guide',
          differentiatorAngle: 'Rival integration pages provide generic marketing copy without code snippets. Injected JSON configuration samples will capture high-intent developer and agency search traffic.',
          sampleDeliverableTemplate: `<!-- Programmatic Integration Hub Template -->\n<h1>Automate SEO Workflows between {Brand} and {App Name}</h1>\n<p>Seamlessly synchronize crawl insights and automated remediations directly with your {App Name} workspace.</p>\n<div class="setup-steps">\n  <h3>Step 1: Install Integration</h3>\n  <pre><code>npm install @{brand}/connector-{app-slug}</code></pre>\n</div>`,
        },
      });
    }

    if (templateUrls.length >= 2) {
      results.push({
        id: `prog_tmpl_${Buffer.from(compDomain).toString('hex').slice(0, 8)}`,
        patternName: 'Template & Asset Library',
        category: 'TEMPLATES',
        urlPattern: `https://${compDomain}/templates/{template-slug}`,
        competitorDomain: compDomain,
        pageCount: templateUrls.length,
        estimatedMonthlyVisits: templateUrls.length * 290,
        commercialIntent: 'MEDIUM',
        variables: [
          { name: 'template-slug', exampleValues: ['saas-audit', 'ecommerce-seo', 'local-schema'], description: 'Ready-to-use blueprint use-case' },
        ],
        sampleUrls: templateUrls.slice(0, 3),
        counterStrategy: {
          recommendedUrlPattern: `https://${customerDomain}/templates/{template-slug}`,
          targetH1Formula: `Free {Template Name} Template (Instant Download & Execution)`,
          recommendedSchemaType: 'CreativeWork, FAQPage',
          contentDepthBenchmark: '1,000+ words + copyable JSON-LD file + live preview screenshot',
          differentiatorAngle: 'Competitor gates downloads behind lead forms. Providing direct copy buttons and preview cards drives natural backlinks and higher dwell time.',
          sampleDeliverableTemplate: `<!-- Programmatic Asset Blueprint -->\n<h1>{Template Name} — Ready to Implement</h1>\n<p>Copy this production-tested SEO template directly into your codebase or CMS configuration.</p>`,
        },
      });
    }

    return results;
  }
}

