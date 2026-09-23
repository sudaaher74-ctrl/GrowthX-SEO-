import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ProgrammaticVariable {
  name: string;
  exampleValues: string[];
  description: string;
}

export interface ProgrammaticBlueprint {
  counterPattern: string;
  targetArchitecture: string;
  recommendedSchemaType: string;
  semanticH2Outlines: string[];
  differentiationAngle: string;
  sampleCopyablePrompt: string;
  targetSlugExample: string;
}

export interface ProgrammaticCluster {
  patternId: string;
  formula: string;
  patternType: 'COMPARISON' | 'INTEGRATION' | 'DIRECTORY_LOCATION' | 'GLOSSARY' | 'CALCULATOR' | 'PRODUCT_VS' | 'GENERIC';
  competitorDomain: string;
  sampleUrls: string[];
  totalDetectedPages: number;
  extractedVariables: string[];
  sampleVariables: Record<string, string[]>;
  estimatedMonthlyVisits: number;
  counterBlueprint: ProgrammaticBlueprint;

  // Backwards compatibility aliases
  id: string;
  patternName: string;
  category: 'INTEGRATIONS' | 'COMPARISONS' | 'TEMPLATES' | 'GLOSSARY' | 'LOCATIONS' | 'TOOLS' | 'CATEGORY_HUBS';
  urlPattern: string;
  pageCount: number;
  commercialIntent: 'HIGH' | 'MEDIUM' | 'TRANSACTIONAL';
  variables: ProgrammaticVariable[];
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
  totalPatternsDetected: number;
  totalProgrammaticPages: number;
  estimatedTrafficCaptured: number;
  dominantFormulaType: string;
  highPriorityCounterAttacks: number;

  // Backwards compatibility aliases
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
          totalPatternsDetected: 0,
          totalProgrammaticPages: 0,
          estimatedTrafficCaptured: 0,
          dominantFormulaType: 'None',
          highPriorityCounterAttacks: 0,
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
        totalPatternsDetected: clusters.length,
        totalProgrammaticPages: totalPagesIndexed,
        estimatedTrafficCaptured: totalTraffic,
        dominantFormulaType: clusters[0]?.patternType || 'None',
        highPriorityCounterAttacks: clusters.length,
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
      const compId = `prog_comp_${Buffer.from(compDomain).toString('hex').slice(0, 8)}`;
      const formula = `https://${compDomain}/vs/{competitor-slug}`;
      const blueprint: ProgrammaticBlueprint = {
        counterPattern: `https://${customerDomain}/compare/{brand}-vs-{competitor}`,
        targetArchitecture: `/compare/{brand}-vs-{competitor}`,
        recommendedSchemaType: 'Product, FAQPage',
        semanticH2Outlines: [
          `Direct Comparison: {Your Brand} vs {Competitor}`,
          `Performance & Core Web Vitals Benchmark`,
          `Live Autonomous Execution vs Manual Spreadsheets`,
          `Pricing Model & Total Cost of Ownership`,
          `Migration Guide: Moving to {Your Brand} in 5 Minutes`,
        ],
        differentiationAngle: 'Competitor comparison pages are heavily biased and lack real performance benchmarks. Our counter-blueprint provides verifiable AST proof and honest trade-offs.',
        sampleCopyablePrompt: `Generate a high-converting, deeply technical comparison page between {Your Brand} and {Competitor}. Focus on concrete architectural differences, real benchmark speed metrics, and honest trade-offs. Avoid generic marketing hype. Include a structured HTML comparison table and JSON-LD FAQ schema.`,
        targetSlugExample: `/compare/growthx-vs-${compDomain.replace(/\..*$/, '')}`,
      };

      results.push({
        patternId: compId,
        id: compId,
        formula,
        urlPattern: formula,
        patternName: 'Direct Competitor & Alternative Comparisons',
        patternType: 'COMPARISON',
        category: 'COMPARISONS',
        competitorDomain: compDomain,
        totalDetectedPages: comparisonUrls.length,
        pageCount: comparisonUrls.length,
        estimatedMonthlyVisits: comparisonUrls.length * 520,
        commercialIntent: 'HIGH',
        extractedVariables: ['competitor-slug', 'feature_matrix'],
        sampleVariables: {
          'competitor-slug': ['semrush', 'ahrefs', 'moz'],
          feature_matrix: ['pricing', 'reporting', 'ai-speed'],
        },
        variables: [
          { name: 'competitor-slug', exampleValues: ['semrush', 'ahrefs', 'moz'], description: 'Target rival platform being compared' },
          { name: 'feature_matrix', exampleValues: ['pricing', 'reporting', 'ai-speed'], description: 'Head-to-head comparison dimensions' },
        ],
        sampleUrls: comparisonUrls.slice(0, 3),
        counterBlueprint: blueprint,
        counterStrategy: {
          recommendedUrlPattern: blueprint.counterPattern,
          targetH1Formula: `{Your Brand} vs {Competitor}: Complete Unbiased Comparison (2026)`,
          recommendedSchemaType: blueprint.recommendedSchemaType,
          contentDepthBenchmark: '1,500+ words + side-by-side spec table + customer review quote',
          differentiatorAngle: blueprint.differentiationAngle,
          sampleDeliverableTemplate: `<!-- Programmatic Comparison Matrix Template -->\n<h1>{Brand} vs {Competitor}: Definitive Feature & Performance Breakdown</h1>\n<p>Looking for a modern alternative to {Competitor}? See how {Brand}'s autonomous engine delivers verifiable results without manual intervention.</p>\n<table class="comparison-grid">\n  <thead><tr><th>Capability</th><th>{Brand}</th><th>{Competitor}</th></tr></thead>\n  <tbody>\n    <tr><td>Autonomous Execution</td><td>Included (Live AST)</td><td>Manual CSV Only</td></tr>\n    <tr><td>AI Citation Engine</td><td>Perplexity + ChatGPT</td><td>Traditional SERP only</td></tr>\n  </tbody>\n</table>`,
        },
      });
    }

    if (integrationUrls.length >= 2) {
      const intId = `prog_int_${Buffer.from(compDomain).toString('hex').slice(0, 8)}`;
      const formula = `https://${compDomain}/integrations/{app-slug}`;
      const blueprint: ProgrammaticBlueprint = {
        counterPattern: `https://${customerDomain}/integrations/{app-slug}`,
        targetArchitecture: `/integrations/{app-slug}`,
        recommendedSchemaType: 'SoftwareApplication',
        semanticH2Outlines: [
          `Connecting {App Name} with {Your Brand}`,
          `Automated Data Sync & Webhook Architecture`,
          `Step-by-Step API Key Setup`,
          `Supported Triggers, Actions & Field Mappings`,
        ],
        differentiationAngle: 'Rival integration pages provide generic marketing copy without code snippets. Injected JSON configuration samples will capture high-intent developer and agency search traffic.',
        sampleCopyablePrompt: `Generate an integration directory page connecting {Your Brand} with {App Name}. Provide real webhook payloads, 1-click configuration steps, and production JSON snippets.`,
        targetSlugExample: `/integrations/slack`,
      };

      results.push({
        patternId: intId,
        id: intId,
        formula,
        urlPattern: formula,
        patternName: 'Ecosystem & Integration Directory',
        patternType: 'INTEGRATION',
        category: 'INTEGRATIONS',
        competitorDomain: compDomain,
        totalDetectedPages: integrationUrls.length,
        pageCount: integrationUrls.length,
        estimatedMonthlyVisits: integrationUrls.length * 380,
        commercialIntent: 'HIGH',
        extractedVariables: ['app-slug', 'workflow_category'],
        sampleVariables: {
          'app-slug': ['slack', 'shopify', 'hubspot', 'wordpress'],
          workflow_category: ['cms', 'crm', 'notifications'],
        },
        variables: [
          { name: 'app-slug', exampleValues: ['slack', 'shopify', 'hubspot', 'wordpress'], description: 'Partner technology being connected' },
          { name: 'workflow_category', exampleValues: ['cms', 'crm', 'notifications'], description: 'Integration functional domain' },
        ],
        sampleUrls: integrationUrls.slice(0, 3),
        counterBlueprint: blueprint,
        counterStrategy: {
          recommendedUrlPattern: blueprint.counterPattern,
          targetH1Formula: `Connect {App Name} with {Your Brand}: 1-Click Automated Setup`,
          recommendedSchemaType: blueprint.recommendedSchemaType,
          contentDepthBenchmark: '800+ words + webhook parameters + 3-step setup guide',
          differentiatorAngle: blueprint.differentiationAngle,
          sampleDeliverableTemplate: `<!-- Programmatic Integration Hub Template -->\n<h1>Automate SEO Workflows between {Brand} and {App Name}</h1>\n<p>Seamlessly synchronize crawl insights and automated remediations directly with your {App Name} workspace.</p>\n<div class="setup-steps">\n  <h3>Step 1: Install Integration</h3>\n  <pre><code>npm install @{brand}/connector-{app-slug}</code></pre>\n</div>`,
        },
      });
    }

    if (templateUrls.length >= 2) {
      const tmplId = `prog_tmpl_${Buffer.from(compDomain).toString('hex').slice(0, 8)}`;
      const formula = `https://${compDomain}/templates/{template-slug}`;
      const blueprint: ProgrammaticBlueprint = {
        counterPattern: `https://${customerDomain}/templates/{template-slug}`,
        targetArchitecture: `/templates/{template-slug}`,
        recommendedSchemaType: 'CreativeWork, FAQPage',
        semanticH2Outlines: [
          `Free {Template Name} Framework & Schema Blueprint`,
          `How to Implement in Your Codebase in 60 Seconds`,
          `Production Verification & Schema Testing Results`,
        ],
        differentiationAngle: 'Competitor gates downloads behind lead forms. Providing direct copy buttons and preview cards drives natural backlinks and higher dwell time.',
        sampleCopyablePrompt: `Generate a free downloadable SEO template for {Template Name}. Include full JSON-LD schema, interactive copy snippet, and implementation checklist.`,
        targetSlugExample: `/templates/saas-audit-schema`,
      };

      results.push({
        patternId: tmplId,
        id: tmplId,
        formula,
        urlPattern: formula,
        patternName: 'Template & Asset Library',
        patternType: 'GENERIC',
        category: 'TEMPLATES',
        competitorDomain: compDomain,
        totalDetectedPages: templateUrls.length,
        pageCount: templateUrls.length,
        estimatedMonthlyVisits: templateUrls.length * 290,
        commercialIntent: 'MEDIUM',
        extractedVariables: ['template-slug'],
        sampleVariables: {
          'template-slug': ['saas-audit', 'ecommerce-seo', 'local-schema'],
        },
        variables: [
          { name: 'template-slug', exampleValues: ['saas-audit', 'ecommerce-seo', 'local-schema'], description: 'Ready-to-use blueprint use-case' },
        ],
        sampleUrls: templateUrls.slice(0, 3),
        counterBlueprint: blueprint,
        counterStrategy: {
          recommendedUrlPattern: blueprint.counterPattern,
          targetH1Formula: `Free {Template Name} Template (Instant Download & Execution)`,
          recommendedSchemaType: blueprint.recommendedSchemaType,
          contentDepthBenchmark: '1,000+ words + copyable JSON-LD file + live preview screenshot',
          differentiatorAngle: blueprint.differentiationAngle,
          sampleDeliverableTemplate: `<!-- Programmatic Asset Blueprint -->\n<h1>{Template Name} — Ready to Implement</h1>\n<p>Copy this production-tested SEO template directly into your codebase or CMS configuration.</p>`,
        },
      });
    }

    if (locationUrls.length >= 2) {
      const locId = `prog_loc_${Buffer.from(compDomain).toString('hex').slice(0, 8)}`;
      const formula = `https://${compDomain}/locations/{city-slug}`;
      const blueprint: ProgrammaticBlueprint = {
        counterPattern: `https://${customerDomain}/locations/{city-slug}`,
        targetArchitecture: `/locations/{city-slug}`,
        recommendedSchemaType: 'LocalBusiness, FAQPage',
        semanticH2Outlines: [
          `Top-Rated Services in {City}`,
          `Local Client Success Stories & Case Studies`,
          `Hyper-Local Coverage & Regional Service Areas`,
        ],
        differentiationAngle: 'Competitor uses shallow spun geo-content. Our counter architecture integrates verified local NAP coordinates and validated LocalBusiness Schema.',
        sampleCopyablePrompt: `Generate a hyper-local landing page for {City}. Include local landmarks, localized schema markup, and geo-targeted service FAQs.`,
        targetSlugExample: `/locations/austin`,
      };

      results.push({
        patternId: locId,
        id: locId,
        formula,
        urlPattern: formula,
        patternName: 'Geographic & City Directory Hub',
        patternType: 'DIRECTORY_LOCATION',
        category: 'LOCATIONS',
        competitorDomain: compDomain,
        totalDetectedPages: locationUrls.length,
        pageCount: locationUrls.length,
        estimatedMonthlyVisits: locationUrls.length * 310,
        commercialIntent: 'HIGH',
        extractedVariables: ['city-slug'],
        sampleVariables: {
          'city-slug': ['new-york', 'san-francisco', 'austin', 'london'],
        },
        variables: [
          { name: 'city-slug', exampleValues: ['new-york', 'san-francisco', 'austin', 'london'], description: 'Target geographic metropolitan region' },
        ],
        sampleUrls: locationUrls.slice(0, 3),
        counterBlueprint: blueprint,
        counterStrategy: {
          recommendedUrlPattern: blueprint.counterPattern,
          targetH1Formula: `Professional SEO Solutions in {City} — GrowthX Verified`,
          recommendedSchemaType: blueprint.recommendedSchemaType,
          contentDepthBenchmark: '1,200+ words + map embed + localized service schema',
          differentiatorAngle: blueprint.differentiationAngle,
          sampleDeliverableTemplate: `<!-- Localized Geo Hub Template -->\n<h1>Local SEO & Organic Growth in {City}</h1>`,
        },
      });
    }

    if (toolUrls.length >= 2) {
      const toolId = `prog_tool_${Buffer.from(compDomain).toString('hex').slice(0, 8)}`;
      const formula = `https://${compDomain}/tools/{tool-slug}`;
      const blueprint: ProgrammaticBlueprint = {
        counterPattern: `https://${customerDomain}/tools/{tool-slug}`,
        targetArchitecture: `/tools/{tool-slug}`,
        recommendedSchemaType: 'WebApplication, FAQPage',
        semanticH2Outlines: [
          `Free {Tool Name} Online Utility`,
          `How the Calculation Algorithm Works`,
          `Frequently Asked Questions & Use Cases`,
        ],
        differentiationAngle: 'Competitor gates simple calculation utilities behind email forms. Our counter-page offers zero-friction execution with higher Core Web Vitals performance.',
        sampleCopyablePrompt: `Generate an interactive web tool page for {Tool Name}. Provide real-time calculation logic, embedded utility controls, and WebApplication schema.`,
        targetSlugExample: `/tools/roi-calculator`,
      };

      results.push({
        patternId: toolId,
        id: toolId,
        formula,
        urlPattern: formula,
        patternName: 'Interactive Calculator & Tool Engine',
        patternType: 'CALCULATOR',
        category: 'TOOLS',
        competitorDomain: compDomain,
        totalDetectedPages: toolUrls.length,
        pageCount: toolUrls.length,
        estimatedMonthlyVisits: toolUrls.length * 640,
        commercialIntent: 'HIGH',
        extractedVariables: ['tool-slug'],
        sampleVariables: {
          'tool-slug': ['audit-checker', 'roi-calculator', 'serp-simulator'],
        },
        variables: [
          { name: 'tool-slug', exampleValues: ['audit-checker', 'roi-calculator', 'serp-simulator'], description: 'Specific interactive SEO tool or widget' },
        ],
        sampleUrls: toolUrls.slice(0, 3),
        counterBlueprint: blueprint,
        counterStrategy: {
          recommendedUrlPattern: blueprint.counterPattern,
          targetH1Formula: `Free {Tool Name} Calculator & Diagnostic Tool`,
          recommendedSchemaType: blueprint.recommendedSchemaType,
          contentDepthBenchmark: '900+ words + client-side interactive JS widget',
          differentiatorAngle: blueprint.differentiationAngle,
          sampleDeliverableTemplate: `<!-- Interactive Utility Blueprint -->\n<h1>Instant {Tool Name} Generator</h1>`,
        },
      });
    }

    return results;
  }
}
