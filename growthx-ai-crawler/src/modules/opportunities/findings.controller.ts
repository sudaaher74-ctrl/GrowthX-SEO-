import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FindingLifecycle, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { FindingSyncService } from './finding-sync.service';
import { LifecycleService } from './lifecycle.service';

@ApiTags('Findings')
@ApiBearerAuth()
@Controller(['api/projects/:projectId/findings', 'projects/:projectId/findings'])
@UseGuards(JwtAuthGuard)
export class FindingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: FindingSyncService,
    private readonly lifecycleService: LifecycleService,
  ) {}

  private async assertProjectAccess(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found in this organization');
    }
  }

  /**
   * Unified ranked finding queue.
   * Default ordering: impact DESC, detectedAt ASC (older findings win ties).
   */
  @Get()
  @ApiOperation({ summary: 'List unified findings with counts and cursor pagination' })
  async list(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('lifecycle') lifecycle?: FindingLifecycle,
    @Query('source') source?: string,
    @Query('fixClass') fixClass?: string,
    @Query('category') category?: string,
    @Query('limit') limitParam?: string,
    @Query('cursor') cursor?: string,
  ) {
    await this.assertProjectAccess(req.organizationId, projectId);

    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 200);

    const where: Prisma.GrowthOpportunityWhereInput = {
      projectId,
      ...(lifecycle ? { lifecycle } : status ? { status } : { status: 'OPEN' }),
      ...(source ? { source: source.toUpperCase() } : {}),
      ...(fixClass ? { fixClass: fixClass.toUpperCase() } : {}),
      ...(category ? { category: category.toUpperCase() } : {}),
    };

    const countWhere: Prisma.GrowthOpportunityWhereInput = {
      projectId,
      ...(lifecycle ? { lifecycle } : status ? { status } : { status: 'OPEN' }),
    };

    const [itemsPlusOne, sourceGroups, fixClassGroups, total] = await Promise.all([
      this.prisma.growthOpportunity.findMany({
        where,
        orderBy: [{ impact: 'desc' }, { detectedAt: 'asc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.growthOpportunity.groupBy({
        by: ['source'],
        where: countWhere,
        _count: { _all: true },
      }),
      this.prisma.growthOpportunity.groupBy({
        by: ['fixClass'],
        where: countWhere,
        _count: { _all: true },
      }),
      this.prisma.growthOpportunity.count({ where }),
    ]);

    const hasNext = itemsPlusOne.length > limit;
    const items = hasNext ? itemsPlusOne.slice(0, limit) : itemsPlusOne;
    const nextCursor = hasNext && items.length > 0 ? items[items.length - 1].id : null;

    const bySource: Record<string, number> = {};
    for (const sg of sourceGroups) {
      bySource[sg.source] = sg._count._all;
    }

    const byFixClass: Record<string, number> = {};
    for (const fc of fixClassGroups) {
      byFixClass[fc.fixClass] = fc._count._all;
    }

    return {
      items,
      nextCursor,
      counts: {
        bySource,
        byFixClass,
        total,
      },
    };
  }

  /**
   * Re-syncs findings across all detectors into GrowthOpportunity.
   */
  @Post('sync')
  @ApiOperation({ summary: 'Reconcile findings from all detector sources' })
  async sync(@Req() req: any, @Param('projectId') projectId: string) {
    await this.assertProjectAccess(req.organizationId, projectId);
    return this.syncService.syncProject(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single finding by ID' })
  async getOne(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    await this.assertProjectAccess(req.organizationId, projectId);

    const finding = await this.prisma.growthOpportunity.findFirst({
      where: { id, projectId },
    });

    if (!finding) {
      throw new NotFoundException(`Finding ${id} not found`);
    }

    return finding;
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Transition finding lifecycle state' })
  async transition(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { to: FindingLifecycle; reason?: string; snoozeUntil?: string },
  ) {
    await this.assertProjectAccess(req.organizationId, projectId);

    return this.lifecycleService.transition(
      id,
      body.to,
      { type: 'USER', id: req.user?.id },
      {
        reason: body.reason,
        snoozeUntil: body.snoozeUntil ? new Date(body.snoozeUntil) : undefined,
      },
    );
  }
}
