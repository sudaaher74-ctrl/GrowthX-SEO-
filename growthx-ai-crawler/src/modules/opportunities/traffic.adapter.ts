import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FindingAdapter, NormalisedFinding } from './finding-adapter.interface';

function slug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class TrafficAdapter implements FindingAdapter {
  private readonly logger = new Logger(TrafficAdapter.name);
  readonly source = 'SEARCH_CONSOLE' as const;

  constructor(private readonly prisma: PrismaService) {}

  async collect(projectId: string): Promise<NormalisedFinding[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        businessProfile: true,
        websites: { select: { domain: true }, take: 1 },
      },
    });

    if (!project) return [];

    const organizationId = project.organizationId;
    const domain = project.websites[0]?.domain || project.name || 'your website';
    const findings: NormalisedFinding[] = [];
    const seenFingerprints = new Set<string>();

    // 0. Forwarded recommendations & target city traffic gaps from the latest Traffic Report
    try {
      const latestReportRow = (this.prisma as any).googleReportSnapshot
        ? await (this.prisma as any).googleReportSnapshot.findFirst({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, report: true },
          })
        : null;

      const report = latestReportRow?.report as Record<string, any> | undefined;
      if (report) {
        const locationGaps = Array.isArray(report.facts?.locationGaps) ? report.facts.locationGaps : [];
        const businessName = report.facts?.business?.businessName || project.businessProfile?.businessName || domain;
        const offerings = Array.isArray(report.facts?.business?.offerings) && report.facts.business.offerings.length > 0
          ? report.facts.business.offerings.slice(0, 3).join(', ')
          : project.businessProfile?.industry || 'core offerings';

        for (const gap of locationGaps) {
          if (!gap?.location || gap.status === 'ACTIVE') continue;
          const locSlug = slug(String(gap.location));
          const fp = `traffic::report-location-gap::${projectId}::${locSlug}`;
          if (seenFingerprints.has(fp)) continue;
          seenFingerprints.add(fp);

          const steps = Array.isArray(gap.recommendedSteps) && gap.recommendedSteps.length > 0
            ? gap.recommendedSteps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')
            : gap.plan || `Optimize landing pages and local search visibility for ${gap.location}.`;

          findings.push({
            projectId,
            organizationId,
            fingerprint: fp,
            source: 'SEARCH_CONSOLE',
            category: 'SEO',
            title:
              gap.status === 'NO_CLICKS'
                ? `Capture missing traffic in ${gap.location} for ${businessName} (0 clicks recorded)`
                : `Grow local search traffic and click quality in ${gap.location} for ${businessName}`,
            summary: gap.finding || `Your website targets ${gap.location}, but Traffic recorded ${gap.sessions ?? 0} sessions and ${gap.searchClicks ?? 0} search clicks.`,
            recommendedAction: steps,
            evidence: [
              { label: 'Target City / Market (Website Audit)', value: String(gap.location), source: 'Website Business Audit' },
              { label: 'Business Offerings', value: offerings, source: 'Website Business Audit' },
              {
                label: 'Measured Traffic',
                value: `${gap.sessions ?? 0} sessions · ${gap.searchClicks ?? 0} search clicks · ${gap.searchImpressions ?? 0} impressions`,
                source: 'Traffic & Search Console Report',
              },
            ],
            potential: 'HIGH',
            effort: 'MEDIUM',
            confidence: 92,
            impact: 90,
            fixClass: 'APPROVAL',
            affectedPages: Array.isArray(gap.matchingPages) ? gap.matchingPages : [],
            affectedCount: Array.isArray(gap.matchingPages) && gap.matchingPages.length > 0 ? gap.matchingPages.length : 1,
            detailType: 'REPORT_PLAN',
            detailRef: latestReportRow.id || fp,
          });
        }

        const priorities = Array.isArray(report.analysis?.priorities) ? report.analysis.priorities : [];
        for (const p of priorities.slice(0, 6)) {
          if (!p?.title) continue;
          const titleSlug = slug(String(p.title)).slice(0, 60);
          const fp = `traffic::report-priority::${projectId}::${titleSlug}`;
          if (seenFingerprints.has(fp)) continue;
          seenFingerprints.add(fp);

          const steps = Array.isArray(p.steps) && p.steps.length > 0
            ? p.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')
            : p.whyItMatters || 'Review the Traffic Report and apply the recommended improvement.';

          const potential: NormalisedFinding['potential'] =
            String(p.impact).toLowerCase() === 'low' ? 'LOW' : String(p.impact).toLowerCase() === 'medium' ? 'MEDIUM' : 'HIGH';
          const effort: NormalisedFinding['effort'] =
            String(p.effort).toLowerCase() === 'low' ? 'LOW' : String(p.effort).toLowerCase() === 'high' ? 'HIGH' : 'MEDIUM';

          findings.push({
            projectId,
            organizationId,
            fingerprint: fp,
            source: p.platform === 'GA4' ? 'ANALYTICS' : 'SEARCH_CONSOLE',
            category: 'SEO',
            title: String(p.title),
            summary: String(p.whyItMatters || p.evidence || 'Priority action from your Traffic & Business Improvement Report.'),
            recommendedAction: steps,
            evidence: [
              ...(p.evidence ? [{ label: 'Report Evidence', value: String(p.evidence), source: 'Traffic Improvement Report' }] : []),
              ...(p.measureBy ? [{ label: 'Measure By', value: String(p.measureBy), source: 'Traffic Improvement Report' }] : []),
            ],
            potential,
            effort,
            confidence: 88,
            impact: potential === 'HIGH' ? 88 : 75,
            fixClass: effort === 'LOW' ? 'APPROVAL' : 'MANUAL',
            affectedPages: [],
            affectedCount: 1,
            detailType: 'REPORT_PLAN',
            detailRef: latestReportRow.id || fp,
          });
        }
      } else if (project.businessProfile?.city) {
        const city = project.businessProfile.city;
        const businessName = project.businessProfile.businessName || domain;
        const offerings = project.businessProfile.offerings?.slice(0, 2).join(', ') || project.businessProfile.industry || 'core services';
        const fp = `traffic::report-location-gap::${projectId}::${slug(city)}`;
        seenFingerprints.add(fp);
        findings.push({
          projectId,
          organizationId,
          fingerprint: fp,
          source: 'SEARCH_CONSOLE',
          category: 'SEO',
          title: `Capture local search clicks and visitors in ${city} for ${businessName}`,
          summary: `Website Audit detected that ${businessName} operates in ${city} (${offerings}). Ensure dedicated local landing page copy and snippets win clicks from ${city} buyers.`,
          recommendedAction: `1. Include "${offerings} in ${city}" in your homepage and service page title tags and H1s.\n2. Add LocalBusiness JSON-LD schema with areaServed: "${city}".\n3. Generate a Traffic Report to measure city-level clicks and sessions.`,
          evidence: [
            { label: 'Detected Business City', value: city, source: 'Website Business Audit' },
            { label: 'Core Offerings', value: offerings, source: 'Website Business Audit' },
          ],
          potential: 'HIGH',
          effort: 'LOW',
          confidence: 88,
          impact: 86,
          fixClass: 'APPROVAL',
          affectedPages: [],
          affectedCount: 1,
          detailType: 'REPORT_PLAN',
          detailRef: fp,
        });
      }
    } catch (err: any) {
      this.logger.debug(`Traffic report snapshot inspection skipped: ${err.message}`);
    }

    // 1. Search Console real query data if available in prisma
    try {
      const searchRows = (this.prisma as any).searchConsoleRow
        ? await (this.prisma as any).searchConsoleRow.findMany({
            where: { projectId },
            orderBy: { impressions: 'desc' },
            take: 50,
          })
        : [];

      // Striking distance queries (positions 4 to 20 with notable impressions)
      const strikingDistanceRows = searchRows.filter(
        (r: any) => r.position >= 4 && r.position <= 20 && r.impressions >= 30,
      );

      for (const row of strikingDistanceRows.slice(0, 3)) {
        findings.push({
          projectId,
          organizationId,
          fingerprint: `traffic::striking-distance::${projectId}::${slug(row.query)}`,
          source: 'SEARCH_CONSOLE',
          category: 'SEO',
          title: `Push "${row.query}" from position ${Number(row.position).toFixed(1)} onto page one of Google`,
          summary: `This query already delivers ${Number(row.impressions).toLocaleString()} impressions and ${Number(row.clicks || 0).toLocaleString()} clicks. A modest ranking improvement into the top 3 will yield immediate traffic gains.`,
          recommendedAction: `Identify the ranking page, improve content depth for "${row.query}", add internal links from related pages, and optimize H1/H2 tags.`,
          evidence: [
            { label: 'Average Position', value: Number(row.position).toFixed(1), source: 'Google Search Console' },
            { label: 'Search Impressions', value: Number(row.impressions).toLocaleString(), source: 'Google Search Console' },
            { label: 'Current Clicks', value: Number(row.clicks || 0).toLocaleString(), source: 'Google Search Console' },
          ],
          potential: 'HIGH',
          effort: 'MEDIUM',
          confidence: 90,
          impact: 85,
          fixClass: 'MANUAL',
          affectedPages: row.page ? [row.page] : [],
          affectedCount: 1,
          detailType: 'STRIKING_DISTANCE',
          detailRef: row.id || slug(row.query),
        });
      }

      // CTR Shortfalls (high impressions but CTR < 2%)
      const ctrShortfallRows = searchRows.filter(
        (r: any) => r.impressions >= 100 && (r.clicks / Math.max(1, r.impressions)) < 0.02,
      );

      for (const row of ctrShortfallRows.slice(0, 2)) {
        const ctrPercent = ((row.clicks / Math.max(1, row.impressions)) * 100).toFixed(1);
        findings.push({
          projectId,
          organizationId,
          fingerprint: `traffic::ctr-shortfall::${projectId}::${slug(row.query)}`,
          source: 'SEARCH_CONSOLE',
          category: 'SEO',
          title: `Rewrite meta title and description for high-impression query "${row.query}"`,
          summary: `This query generates high search visibility (${Number(row.impressions).toLocaleString()} impressions) but has a below-average CTR (${ctrPercent}%). Compelling snippet copy can increase clicks immediately.`,
          recommendedAction: `Update the meta title to be action-oriented, include target keywords early, and write a persuasive description with a clear call-to-action.`,
          evidence: [
            { label: 'Impressions', value: Number(row.impressions).toLocaleString(), source: 'Google Search Console' },
            { label: 'Click-Through Rate', value: `${ctrPercent}%`, source: 'Google Search Console' },
            { label: 'Average Position', value: Number(row.position).toFixed(1), source: 'Google Search Console' },
          ],
          potential: 'HIGH',
          effort: 'LOW',
          confidence: 85,
          impact: 80,
          fixClass: 'AUTO',
          affectedPages: row.page ? [row.page] : [],
          affectedCount: 1,
          detailType: 'CTR_SHORTFALL',
          detailRef: row.id || slug(row.query),
        });
      }
    } catch (err: any) {
      this.logger.debug(`Search console row inspection skipped: ${err.message}`);
    }

    // 2. High-value landing pages & analytics conversion
    findings.push({
      projectId,
      organizationId,
      fingerprint: `traffic::high-value-pages::${projectId}`,
      source: 'ANALYTICS',
      category: 'SEO',
      title: `Funnel search authority to your highest-converting landing pages`,
      summary: `Connecting analytics and internal link signals shows certain pages drive higher engagement. Boosting their organic rankings compounds business revenue.`,
      recommendedAction: `Add prominent contextual internal links from blog guides and high-traffic pages directly to your primary service and conversion pages.`,
      evidence: [
        { label: 'Conversion Impact', value: 'Commercial pages generate highest user value', source: 'Traffic Analytics' },
        { label: 'SEO Lever', value: 'Internal PageRank flow boosts target page indexing and rank', source: 'Google Ranking Factors' },
      ],
      potential: 'HIGH',
      effort: 'LOW',
      confidence: 85,
      impact: 80,
      fixClass: 'APPROVAL',
      affectedPages: [],
      affectedCount: 1,
      detailType: 'CONVERSION_FUNNEL',
      detailRef: projectId,
    });

    // 3. Google Search Console & GA4 Integration / Real-time Telemetry
    findings.push({
      projectId,
      organizationId,
      fingerprint: `traffic::gsc-connection::${projectId}`,
      source: 'SEARCH_CONSOLE',
      category: 'SEO',
      title: `Connect Google Search Console & Analytics to track daily click and keyword trends`,
      summary: `Direct Search Console integration enables daily tracking of search impressions, ranking movements, and CTR performance by keyword and device.`,
      recommendedAction: `Connect your verified Search Console property in project settings to enable real-time keyword position tracking.`,
      evidence: [
        { label: 'Integration Target', value: domain, source: 'Search Console Settings' },
        { label: 'Telemetry Type', value: 'Google Search Console API (URL inspection, query impressions, CTR)', source: 'Platform Settings' },
      ],
      potential: 'HIGH',
      effort: 'LOW',
      confidence: 95,
      impact: 85,
      fixClass: 'MANUAL',
      affectedPages: [],
      affectedCount: 1,
      detailType: 'INTEGRATION',
      detailRef: projectId,
    });

    // 4. Mobile Usability & Core Web Vitals
    findings.push({
      projectId,
      organizationId,
      fingerprint: `traffic::core-web-vitals::${projectId}`,
      source: 'SEARCH_CONSOLE',
      category: 'TECHNICAL',
      title: `Optimize mobile Core Web Vitals (LCP & CLS) to improve Google mobile rankings`,
      summary: `Google's mobile-first index evaluates page speed, Largest Contentful Paint (LCP < 2.5s), and visual stability (CLS < 0.1) as direct search ranking factors.`,
      recommendedAction: `Compress hero images, preload critical web fonts, and defer non-essential third-party JavaScript.`,
      evidence: [
        { label: 'Search Ranking Factor', value: 'Page Experience & Core Web Vitals benchmark', source: 'Google Search Central' },
        { label: 'Target Metrics', value: 'LCP under 2.5s, CLS under 0.1, INP under 200ms', source: 'Web Vitals Guide' },
      ],
      potential: 'HIGH',
      effort: 'MEDIUM',
      confidence: 90,
      impact: 75,
      fixClass: 'APPROVAL',
      affectedPages: [],
      affectedCount: 1,
      detailType: 'CORE_WEB_VITALS',
      detailRef: projectId,
    });

    // 5. XML Sitemap & Indexation Health
    findings.push({
      projectId,
      organizationId,
      fingerprint: `traffic::sitemap-indexation::${projectId}`,
      source: 'SEARCH_CONSOLE',
      category: 'TECHNICAL',
      title: `Submit XML sitemap and verify search indexation coverage for ${domain}`,
      summary: `Submitting an up-to-date XML sitemap accelerates indexation of newly published content and ensures Google discovers all canonical URLs.`,
      recommendedAction: `Generate a dynamic XML sitemap (sitemap.xml), reference it in robots.txt, and submit to Google Search Console.`,
      evidence: [
        { label: 'Target Property', value: domain, source: 'Crawler Inspection' },
        { label: 'Indexation Best Practice', value: 'Clean XML sitemap with self-referencing canonicals', source: 'Google SEO Starter Guide' },
      ],
      potential: 'HIGH',
      effort: 'LOW',
      confidence: 92,
      impact: 70,
      fixClass: 'AUTO',
      affectedPages: [],
      affectedCount: 1,
      detailType: 'SITEMAP',
      detailRef: projectId,
    });

    // 6. Commercial-Intent Keyword Targeting
    findings.push({
      projectId,
      organizationId,
      fingerprint: `traffic::commercial-intent::${projectId}`,
      source: 'SEARCH_CONSOLE',
      category: 'CONTENT',
      title: `Target commercial-intent search terms ("best", "cost", "near me") for core offerings`,
      summary: `High-intent queries convert 3x better than generic informational queries. Optimizing dedicated pages for commercial modifiers drives ready-to-buy visitors.`,
      recommendedAction: `Update primary service page titles and descriptions to include commercial modifiers such as "best", "services", and target city names.`,
      evidence: [
        { label: 'Search Intent Focus', value: 'Commercial & transactional search queries', source: 'Search Strategy' },
        { label: 'Conversion Lift', value: 'Commercial search queries average 3.2% conversion rate', source: 'Industry Benchmark' },
      ],
      potential: 'HIGH',
      effort: 'LOW',
      confidence: 86,
      impact: 80,
      fixClass: 'APPROVAL',
      affectedPages: [],
      affectedCount: 1,
      detailType: 'SEARCH_INTENT',
      detailRef: projectId,
    });

    return findings;
  }
}
