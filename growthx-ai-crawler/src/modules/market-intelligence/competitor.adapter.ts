import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FindingAdapter, NormalisedFinding } from '../opportunities/finding-adapter.interface';

function slug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CompetitorAdapter implements FindingAdapter {
  readonly source = 'COMPETITOR' as const;

  constructor(private readonly prisma: PrismaService) {}

  async collect(projectId: string): Promise<NormalisedFinding[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) return [];

    const [findings, gaps] = await Promise.all([
      this.prisma.competitorFinding.findMany({
        where: { projectId },
        orderBy: { observedAt: 'desc' },
      }),
      this.prisma.contentGap.findMany({
        where: { projectId, status: 'OPEN' },
        orderBy: { opportunityScore: 'desc' },
      }),
    ]);

    const results: NormalisedFinding[] = [];

    for (const finding of findings) {
      const summarySlug = slug(finding.summary);
      const fingerprint = `${projectId}::COMPETITOR::${finding.category}::${summarySlug}`;

      const confidence =
        finding.confidence === 'HIGH' ? 90 : finding.confidence === 'MEDIUM' ? 70 : 50;

      results.push({
        projectId,
        organizationId: project.organizationId,
        fingerprint,
        source: this.source,
        category: 'COMPETITOR',
        title: finding.summary,
        summary: finding.detail,
        recommendedAction: 'Analyze competitor strategy and close market gap.',
        evidence: [
          { label: 'Platform', value: finding.sourcePlatform, source: 'COMPETITOR_ANALYSIS' },
          ...(finding.sourceUrl
            ? [{ label: 'Source URL', value: finding.sourceUrl, source: 'COMPETITOR' }]
            : []),
          ...(finding.metricName && finding.metricValue != null
            ? [
                {
                  label: finding.metricName,
                  value: `${finding.metricValue} (vs customer: ${finding.customerValue ?? 'N/A'})`,
                  source: 'COMPETITOR_METRIC',
                },
              ]
            : []),
        ],
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence,
        impact: 60,
        fixClass: 'MANUAL',
        affectedPages: [],
        affectedCount: 1,
        detailType: 'COMPETITOR_FINDING',
        detailRef: finding.id,
      });
    }

    for (const gap of gaps) {
      const titleSlug = slug(gap.title);
      const fingerprint = `${projectId}::COMPETITOR::CONTENT_GAP::${titleSlug}`;

      const effort: NormalisedFinding['effort'] =
        gap.effortLevel === 'LOW' ? 'LOW' : gap.effortLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';

      const potential: NormalisedFinding['potential'] =
        gap.competitionLevel === 'LOW' ? 'HIGH' : 'MEDIUM';

      const confidence = gap.confidenceScore ?? 75;
      const impact = Math.min(100, Math.max(0, gap.opportunityScore ?? 60));

      results.push({
        projectId,
        organizationId: project.organizationId,
        fingerprint,
        source: this.source,
        category: 'CONTENT',
        title: `Content Gap: ${gap.title}`,
        summary: gap.description,
        recommendedAction:
          gap.recommendedAction || 'Create content targeting identified competitor keywords.',
        evidence: [
          { label: 'Gap Type', value: gap.gapType, source: 'MARKET_INTELLIGENCE' },
          ...(gap.relatedKeywords.length
            ? [{ label: 'Keywords', value: gap.relatedKeywords.slice(0, 5).join(', '), source: 'COMPETITOR' }]
            : []),
        ],
        potential,
        effort,
        confidence,
        impact,
        fixClass: 'APPROVAL',
        affectedPages: [],
        affectedCount: 1,
        detailType: 'CONTENT_GAP',
        detailRef: gap.id,
      });
    }

    return results;
  }
}
