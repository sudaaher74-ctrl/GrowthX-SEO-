import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FindingAdapter, NormalisedFinding } from '../opportunities/finding-adapter.interface';

@Injectable()
export class GbpAdapter implements FindingAdapter {
  readonly source = 'LOCAL' as const;

  constructor(private readonly prisma: PrismaService) {}

  async collect(projectId: string): Promise<NormalisedFinding[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) return [];

    const proposals = await this.prisma.gbpFixProposal.findMany({
      where: {
        projectId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
    });

    // Check for primary location if one exists
    const primaryLocation = await this.prisma.localLocation.findFirst({
      where: { projectId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const locationId = primaryLocation?.id ?? 'primary';

    return proposals.map((proposal) => {
      // Fingerprint pattern: ${projectId}::GBP::${field}::${locationId}
      const fingerprint = `${projectId}::GBP::${proposal.field}::${locationId}`;

      return {
        projectId,
        organizationId: project.organizationId,
        fingerprint,
        source: this.source,
        category: 'LOCAL',
        title: `Optimise Google Business Profile: ${proposal.field}`,
        summary: proposal.rationale || `Recommended update for GBP ${proposal.field}.`,
        recommendedAction: `Update ${proposal.field} to: ${proposal.proposedValue}`,
        evidence: [
          { label: 'Target Field', value: proposal.field, source: 'GBP' },
          { label: 'Current Value', value: proposal.currentValue ?? 'Not configured', source: 'GBP' },
          { label: 'Proposed Value', value: proposal.proposedValue, source: 'GBP_AI_ANALYSIS' },
        ],
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 85,
        impact: 65,
        fixClass: 'APPROVAL',
        affectedPages: [],
        affectedCount: 1,
        detailType: 'GBP_PROPOSAL',
        detailRef: proposal.id,
      };
    });
  }
}
