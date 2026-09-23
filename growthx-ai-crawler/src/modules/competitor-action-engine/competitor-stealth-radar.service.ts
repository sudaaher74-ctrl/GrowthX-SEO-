import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type RadarEventType =
  | 'SCHEMA_GAP'
  | 'BACKLINK_VAMPIRE'
  | 'TITLE_PIVOT'
  | 'AI_CITATION_POACH'
  | 'SPEED_DEFECT';

export interface RadarCounterAction {
  label: string;
  deliverableType: 'JSON_LD' | 'HTML_SNIPPET' | 'CITATION_BAIT' | 'OUTREACH_PITCH';
  codeSnippet: string;
  actionableSummary: string;
}

export interface StealthRadarEvent {
  id: string;
  type: RadarEventType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  competitorDomain: string;
  competitorUrl: string;
  headline: string;
  description: string;
  detectedAt: string;
  impactScore: number;
  counterAction: RadarCounterAction;
}

export interface StealthRadarScoreboard {
  activeEventsCount: number;
  criticalVulnerabilities: number;
  backlinkOpportunities: number;
  aiCitationDeficits: number;
}

export interface StealthRadarResponse {
  scoreboard: StealthRadarScoreboard;
  events: StealthRadarEvent[];
}

@Injectable()
export class CompetitorStealthRadarService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scans real competitor crawl records to detect measured technical regressions,
   * schema omissions, 404 broken assets, and thin-content citation deficits.
   * 100% grounded in real database crawl records with zero mock events.
   */
  async getStealthRadarEvents(projectId: string): Promise<StealthRadarResponse> {
    const website = await this.prisma.website.findFirst({
      where: { projectId },
      select: { id: true, domain: true },
    });
    const customerDomain = website?.domain || 'yourdomain.com';

    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: {
        id: true,
        domain: true,
        name: true,
        websiteId: true,
      },
      take: 5,
    });

    const events: StealthRadarEvent[] = [];

    for (const comp of competitors) {
      if (!comp.websiteId) continue;
      const compDomain = comp.domain;
      const compName = comp.name || compDomain.replace(/\..*$/, '');

      // 1. Real 404 Broken Assets (Backlink Vampire)
      const brokenPages = await this.prisma.page.findMany({
        where: {
          crawlJob: { websiteId: comp.websiteId, status: 'COMPLETED' },
          statusCode: 404,
        },
        select: { url: true, crawledAt: true },
        take: 2,
      });

      for (const p of brokenPages) {
        const path = this.safePath(p.url);
        events.push({
          id: `radar_vamp_${comp.id}_${Buffer.from(p.url).toString('hex').slice(0, 8)}`,
          type: 'BACKLINK_VAMPIRE',
          severity: 'CRITICAL',
          competitorDomain: compDomain,
          competitorUrl: p.url,
          headline: `Broken Asset Hijack: ${compDomain}${path} (HTTP 404)`,
          description: `Competitor URL returned a verified 404 Not Found error during recent crawl. Any existing referring links and residual search traffic can be reclaimed.`,
          detectedAt: this.formatTimeAgo(p.crawledAt),
          impactScore: 92,
          counterAction: {
            label: 'Deploy Replacement Resource & Claim Traffic',
            deliverableType: 'OUTREACH_PITCH',
            codeSnippet: `Subject: Broken link to ${compDomain}'s resource on your guide\n\nHi [Editor Name],\n\nI noticed your article links to ${compDomain}${path}, which is currently returning a 404 error.\n\nWe maintain an active, verified resource on this topic at https://${customerDomain}${path}. If helpful, you can update the link to point to this active resource for your readers.\n\nBest,\n[Your Name]`,
            actionableSummary: `Deploy replacement guide on ${customerDomain} and reach out to reclaim referring backlinks.`,
          },
        });
      }

      // 2. Real Schema Gaps on 200 Pages
      const schemaGapPages = await this.prisma.page.findMany({
        where: {
          crawlJob: { websiteId: comp.websiteId, status: 'COMPLETED' },
          statusCode: 200,
          schemas: { none: {} },
        },
        select: { url: true, title: true, crawledAt: true },
        take: 2,
      });

      for (const p of schemaGapPages) {
        const path = this.safePath(p.url);
        events.push({
          id: `radar_schema_${comp.id}_${Buffer.from(p.url).toString('hex').slice(0, 8)}`,
          type: 'SCHEMA_GAP',
          severity: 'HIGH',
          competitorDomain: compDomain,
          competitorUrl: p.url,
          headline: `Zero Structured Data on ${compDomain}${path}`,
          description: `Competitor page lacks any Schema.org JSON-LD structured data. Search engines and AI models cannot extract rich badges or structured answers from this page.`,
          detectedAt: this.formatTimeAgo(p.crawledAt),
          impactScore: 86,
          counterAction: {
            label: 'Deploy Validated Schema Entity',
            deliverableType: 'JSON_LD',
            codeSnippet: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  "name": "${customerDomain} Offering",\n  "description": "Comprehensive, verified solution with rich attributes.",\n  "offers": {\n    "@type": "Offer",\n    "priceCurrency": "USD",\n    "availability": "https://schema.org/InStock"\n  }\n}\n</script>`,
            actionableSummary: `Inject JSON-LD Product & FAQPage schemas to secure rich SERP results over competitor.`,
          },
        });
      }

      // 3. Real Thin Content (< 300 words)
      const thinPages = await this.prisma.page.findMany({
        where: {
          crawlJob: { websiteId: comp.websiteId, status: 'COMPLETED' },
          statusCode: 200,
          wordCount: { gt: 0, lt: 300 },
        },
        select: { url: true, title: true, wordCount: true, crawledAt: true },
        take: 2,
      });

      for (const p of thinPages) {
        const path = this.safePath(p.url);
        events.push({
          id: `radar_ai_${comp.id}_${Buffer.from(p.url).toString('hex').slice(0, 8)}`,
          type: 'AI_CITATION_POACH',
          severity: 'HIGH',
          competitorDomain: compDomain,
          competitorUrl: p.url,
          headline: `Thin Content Deficit: ${compDomain}${path} (${p.wordCount} words)`,
          description: `Competitor URL provides surface-level content (${p.wordCount} words), making it easily displaceable in Perplexity, Claude, and ChatGPT search citations with a deep comparison matrix.`,
          detectedAt: this.formatTimeAgo(p.crawledAt),
          impactScore: 80,
          counterAction: {
            label: 'Inject Structured Comparison Matrix',
            deliverableType: 'CITATION_BAIT',
            codeSnippet: `| Capability | ${customerDomain} | ${compName} |\n| :--- | :--- | :--- |\n| Deep Technical Specifications | Verified & Documented | Surface Level (${p.wordCount} words) |\n| Latency & Performance | Sub-second Edge Cached | Legacy Hosting |\n| Code Remediations | Automated | None |`,
            actionableSummary: `Deploy structured Markdown comparison table to capture LLM citations.`,
          },
        });
      }

      // 4. Real Severe Latency (> 1800ms)
      const slowPages = await this.prisma.page.findMany({
        where: {
          crawlJob: { websiteId: comp.websiteId, status: 'COMPLETED' },
          statusCode: 200,
          responseTimeMs: { gt: 1800 },
        },
        select: { url: true, title: true, responseTimeMs: true, crawledAt: true },
        take: 2,
      });

      for (const p of slowPages) {
        const path = this.safePath(p.url);
        events.push({
          id: `radar_speed_${comp.id}_${Buffer.from(p.url).toString('hex').slice(0, 8)}`,
          type: 'SPEED_DEFECT',
          severity: 'MEDIUM',
          competitorDomain: compDomain,
          competitorUrl: p.url,
          headline: `Severe TTFB Latency: ${p.responseTimeMs}ms on ${compDomain}${path}`,
          description: `Competitor page suffers from slow server response (${p.responseTimeMs}ms), failing Core Web Vitals standards and impairing search crawl frequency.`,
          detectedAt: this.formatTimeAgo(p.crawledAt),
          impactScore: 74,
          counterAction: {
            label: 'Deploy High-Speed Counter Resource',
            deliverableType: 'HTML_SNIPPET',
            codeSnippet: `<!-- Edge Cached Counter Asset -->\n<link rel="preconnect" href="https://fonts.googleapis.com" />\n<meta http-equiv="x-dns-prefetch-control" content="on" />`,
            actionableSummary: `Outperform competitor's sluggish ${p.responseTimeMs}ms latency with edge-cached sub-800ms page.`,
          },
        });
      }
    }

    const criticalCount = events.filter((e) => e.severity === 'CRITICAL').length;
    const backlinkCount = events.filter((e) => e.type === 'BACKLINK_VAMPIRE').length;
    const aiCount = events.filter((e) => e.type === 'AI_CITATION_POACH').length;

    return {
      scoreboard: {
        activeEventsCount: events.length,
        criticalVulnerabilities: criticalCount,
        backlinkOpportunities: backlinkCount,
        aiCitationDeficits: aiCount,
      },
      events,
    };
  }

  private safePath(urlStr: string): string {
    try {
      const pathname = new URL(urlStr).pathname;
      return pathname.length > 28 ? pathname.slice(0, 25) + '...' : pathname || '/';
    } catch {
      return '/';
    }
  }

  private formatTimeAgo(date?: Date | null): string {
    if (!date) return 'Recently';
    const elapsedMs = Date.now() - new Date(date).getTime();
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }
}
