import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FindingAdapter, NormalisedFinding } from '../opportunities/finding-adapter.interface';
import { IssueGroupService } from './issue-group.service';

@Injectable()
export class WebsiteAuditAdapter implements FindingAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly issueGroupService: IssueGroupService,
  ) {}

  async collect(projectId: string): Promise<NormalisedFinding[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) return [];

    const { groups } = await this.issueGroupService.groupsForProject(projectId, { status: 'OPEN' });

    return groups.map((group) => {
      const category: NormalisedFinding['category'] =
        group.category?.toUpperCase() === 'SEO' ? 'SEO' : 'TECHNICAL';

      const potential: NormalisedFinding['potential'] =
        group.severity === 'CRITICAL' || group.severity === 'HIGH'
          ? 'HIGH'
          : group.severity === 'MEDIUM'
            ? 'MEDIUM'
            : 'LOW';

      const effort: NormalisedFinding['effort'] =
        group.fixClass === 'AUTO' ? 'LOW' : group.fixClass === 'APPROVAL' ? 'MEDIUM' : 'HIGH';

      const confidence =
        group.confidence === 'CONFIRMED' ? 90 : group.confidence === 'LIKELY' ? 70 : 50;

      return {
        projectId,
        organizationId: project.organizationId,
        fingerprint: group.groupKey,
        source: this.source,
        category,
        title: group.title,
        summary: group.summary,
        recommendedAction: group.action,
        evidence: [
          {
            label: 'Affected pages',
            value: String(group.affectedCount),
            source: 'WEBSITE_CRAWLER',
          },
        ],
        potential,
        effort,
        confidence,
        impact: group.impact,
        fixClass: group.fixClass,
        affectedPages: group.sampleUrls,
        affectedCount: group.affectedCount,
        detailType: 'ISSUE_GROUP',
        detailRef: group.groupKey,
      };
    });
  }
}
