import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Reading and acting on the unified opportunity list.
 *
 * Separate from detection: this only touches stored rows, so the Opportunity
 * Center loads from one indexed query rather than re-deriving everything on
 * each request.
 */
@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    projectId: string,
    options: { category?: string; source?: string; status?: string; limit?: number } = {},
  ) {
    const where = {
      projectId,
      organizationId,
      // Dismissed rows are kept — they are how a re-detection knows not to
      // resurface something — but they are not the list by default.
      status: options.status ?? 'OPEN',
      ...(options.category ? { category: options.category } : {}),
      ...(options.source ? { source: options.source } : {}),
    };

    const [opportunities, byCategory, total] = await Promise.all([
      this.prisma.growthOpportunity.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { confidence: 'desc' }],
        take: Math.min(options.limit ?? 100, 300),
      }),
      // The filter counts, from the same predicate minus the category, so the
      // tabs show real numbers rather than the length of the filtered list.
      this.prisma.growthOpportunity.groupBy({
        by: ['category'],
        where: { projectId, organizationId, status: options.status ?? 'OPEN' },
        _count: { _all: true },
      }),
      this.prisma.growthOpportunity.count({
        where: { projectId, organizationId, status: options.status ?? 'OPEN' },
      }),
    ]);

    return {
      total,
      byCategory: Object.fromEntries(byCategory.map((row) => [row.category, row._count._all])),
      opportunities,
    };
  }

  /** Marks a finding as handled or not worth doing. */
  async setStatus(organizationId: string, projectId: string, id: string, status: 'OPEN' | 'ACTIONED' | 'DISMISSED') {
    const existing = await this.prisma.growthOpportunity.findFirst({
      where: { id, projectId, organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Opportunity not found for this project.');

    return this.prisma.growthOpportunity.update({
      where: { id },
      data: { status, dismissedAt: status === 'DISMISSED' ? new Date() : null },
    });
  }
}
