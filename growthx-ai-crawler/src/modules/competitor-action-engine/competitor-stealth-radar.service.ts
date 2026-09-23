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
  competitorDomain: string;
  title: string;
  detectedAt: string;
  targetUrl: string;
  impactScore: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  counterTactic: string;
  copyableDeliverable: {
    label: string;
    snippet: string;
  };

  // Backwards compatibility aliases
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  competitorUrl: string;
  headline: string;
  description: string;
  counterAction: RadarCounterAction;
}

export interface StealthRadarScoreboard {
  activeEventsCount: number;
  criticalVulnerabilities: number;
  backlinkOpportunities: number;
  aiCitationDeficits: number;
}

export interface StealthRadarResponse {
  totalEvents: number;
  highPriorityAlerts: number;
  brokenLinkHijacks: number;
  schemaVulnerabilities: number;
  aiPoachOpportunities: number;
  events: StealthRadarEvent[];

  // Backwards compatibility alias
  scoreboard: StealthRadarScoreboard;
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
        const title = `Broken Asset Hijack: ${compDomain}${path} (HTTP 404)`;
        const summary = `Competitor URL returned a verified 404 Not Found error during recent crawl. Any existing referring links and residual search traffic can be reclaimed.`;
        const tactic = `Deploy replacement guide on ${customerDomain} and reach out to reclaim referring backlinks.`;
        const snippet = `Subject: Broken link to ${compDomain}'s resource on your guide\n\nHi [Editor Name],\n\nI noticed your article links to ${compDomain}${path}, which is currently returning a 404 error.\n\nWe maintain an active, verified resource on this topic at https://${customerDomain}${path}. If helpful, you can update the link to point to this active resource for your readers.\n\nBest,\n[Your Name]`;

        events.push({
          id: `radar_vamp_${comp.id}_${Buffer.from(p.url).toString('hex').slice(0, 8)}`,
          type: 'BACKLINK_VAMPIRE',
          urgency: 'HIGH',
          severity: 'CRITICAL',
          competitorDomain: compDomain,
          targetUrl: p.url,
          competitorUrl: p.url,
          title,
          headline: title,
          summary,
          description: summary,
          detectedAt: this.formatTimeAgo(p.crawledAt),
          impactScore: 92,
          counterTactic: tactic,
          copyableDeliverable: {
            label: 'Deploy Replacement Resource & Claim Traffic',
            snippet,
          },
          counterAction: {
            label: 'Deploy Replacement Resource & Claim Traffic',
            deliverableType: 'OUTREACH_PITCH',
            codeSnippet: snippet,
            actionableSummary: tactic,
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
        const title = `Zero Structured Data on ${compDomain}${path}`;
        const summary = `Competitor page lacks any Schema.org JSON-LD structured data. Search engines and AI models cannot extract rich badges or structured answers from this page.`;
        const tactic = `Inject JSON-LD Product & FAQPage schemas to secure rich SERP results over competitor.`;
        const snippet = `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  "name": "${customerDomain} Offering",\n  "description": "Comprehensive, verified solution with rich attributes.",\n  "offers": {\n    "@type": "Offer",\n    "priceCurrency": "USD",\n    "availability": "https://schema.org/InStock"\n  }\n}\n</script>`;

        events.push({
          id: `radar_schema_${comp.id}_${Buffer.from(p.url).toString('hex').slice(0, 8)}`,
          type: 'SCHEMA_GAP',
          urgency: 'HIGH',
          severity: 'HIGH',
          competitorDomain: compDomain,
          targetUrl: p.url,
          competitorUrl: p.url,
          title,
          headline: title,
          summary,
          description: summary,
          detectedAt: this.formatTimeAgo(p.crawledAt),
          impactScore: 86,
          counterTactic: tactic,
          copyableDeliverable: {
            label: 'Deploy Validated Schema Entity',
            snippet,
          },
          counterAction: {
            label: 'Deploy Validated Schema Entity',
            deliverableType: 'JSON_LD',
            codeSnippet: snippet,
            actionableSummary: tactic,
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
        const title = `Thin Content Deficit: ${compDomain}${path} (${p.wordCount} words)`;
        const summary = `Competitor URL provides surface-level content (${p.wordCount} words), making it easily displaceable in Perplexity, Claude, and ChatGPT search citations with a deep comparison matrix.`;
        const tactic = `Deploy structured Markdown comparison table to capture LLM citations.`;
        const snippet = `| Capability | ${customerDomain} | ${compName} |\n| :--- | :--- | :--- |\n| Deep Technical Specifications | Verified & Documented | Surface Level (${p.wordCount} words) |\n| Latency & Performance | Sub-second Edge Cached | Legacy Hosting |\n| Code Remediations | Automated | None |`;

        events.push({
          id: `radar_ai_${comp.id}_${Buffer.from(p.url).toString('hex').slice(0, 8)}`,
          type: 'AI_CITATION_POACH',
          urgency: 'HIGH',
          severity: 'HIGH',
          competitorDomain: compDomain,
          targetUrl: p.url,
          competitorUrl: p.url,
          title,
          headline: title,
          summary,
          description: summary,
          detectedAt: this.formatTimeAgo(p.crawledAt),
          impactScore: 80,
          counterTactic: tactic,
          copyableDeliverable: {
            label: 'Inject Structured Comparison Matrix',
            snippet,
          },
          counterAction: {
            label: 'Inject Structured Comparison Matrix',
            deliverableType: 'CITATION_BAIT',
            codeSnippet: snippet,
            actionableSummary: tactic,
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
        const title = `Severe TTFB Latency: ${p.responseTimeMs}ms on ${compDomain}${path}`;
        const summary = `Competitor page suffers from slow server response (${p.responseTimeMs}ms), failing Core Web Vitals standards and impairing search crawl frequency.`;
        const tactic = `Outperform competitor's sluggish ${p.responseTimeMs}ms latency with edge-cached sub-800ms page.`;
        const snippet = `<!-- Edge Cached Counter Asset -->\n<link rel="preconnect" href="https://fonts.googleapis.com" />\n<meta http-equiv="x-dns-prefetch-control" content="on" />`;

        events.push({
          id: `radar_speed_${comp.id}_${Buffer.from(p.url).toString('hex').slice(0, 8)}`,
          type: 'SPEED_DEFECT',
          urgency: 'MEDIUM',
          severity: 'MEDIUM',
          competitorDomain: compDomain,
          targetUrl: p.url,
          competitorUrl: p.url,
          title,
          headline: title,
          summary,
          description: summary,
          detectedAt: this.formatTimeAgo(p.crawledAt),
          impactScore: 74,
          counterTactic: tactic,
          copyableDeliverable: {
            label: 'Deploy High-Speed Counter Resource',
            snippet,
          },
          counterAction: {
            label: 'Deploy High-Speed Counter Resource',
            deliverableType: 'HTML_SNIPPET',
            codeSnippet: snippet,
            actionableSummary: tactic,
          },
        });
      }
    }

    const totalEvents = events.length;
    const highPriorityAlerts = events.filter((e) => e.urgency === 'HIGH' || e.severity === 'CRITICAL').length;
    const brokenLinkHijacks = events.filter((e) => e.type === 'BACKLINK_VAMPIRE').length;
    const schemaVulnerabilities = events.filter((e) => e.type === 'SCHEMA_GAP').length;
    const aiPoachOpportunities = events.filter((e) => e.type === 'AI_CITATION_POACH').length;

    return {
      totalEvents,
      highPriorityAlerts,
      brokenLinkHijacks,
      schemaVulnerabilities,
      aiPoachOpportunities,
      events,
      scoreboard: {
        activeEventsCount: totalEvents,
        criticalVulnerabilities: highPriorityAlerts,
        backlinkOpportunities: brokenLinkHijacks,
        aiCitationDeficits: aiPoachOpportunities,
      },
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
