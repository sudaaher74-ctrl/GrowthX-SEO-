import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { IssueCountService } from './issue-count.service';
import { IssueGroupService } from './issue-group.service';

/**
 * The website audit's findings, counted once and grouped by problem.
 *
 * Every screen that shows how many things are wrong reads from here. The
 * dashboard, the audit and the Fix Engine each used to count for themselves,
 * which is how one crawl came to be reported as 100, 156 and 100 at once.
 */
@ApiTags('Issues')
@ApiBearerAuth()
@Controller('api/projects/:projectId/issues')
@UseGuards(JwtAuthGuard)
export class IssuesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counts: IssueCountService,
    private readonly groups: IssueGroupService,
  ) {}

  /**
   * The caller's organization must own the project.
   *
   * `Issue` carries no organizationId, so unlike the opportunity list these
   * queries cannot be scoped by it directly — and without this check any
   * signed-in user could read any client's findings by changing the id in the
   * URL. Checked once here, ahead of every endpoint, rather than trusted to each
   * service. Not found rather than forbidden, so a guessed id does not confirm
   * that the project exists.
   */
  private async assertOwned(organizationId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found in this organization.');
  }

  @Get('counts')
  @ApiOperation({ summary: 'The one definition of how many things are wrong' })
  async countsForProject(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('days') days?: string,
  ) {
    await this.assertOwned(req.organizationId, projectId);
    return this.counts.countsForProject(projectId, parseDays(days));
  }

  @Get('groups')
  @ApiOperation({ summary: 'Open findings grouped by problem, highest impact first' })
  async groupsForProject(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ) {
    await this.assertOwned(req.organizationId, projectId);
    return this.groups.groupsForProject(
      projectId,
      { status, source, severity, limit: limit ? parseInt(limit, 10) : undefined },
      parseDays(days),
    );
  }

  @Get('groups/:groupKey/pages')
  @ApiOperation({ summary: 'Every affected page of one group, paginated' })
  async pagesForGroup(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('groupKey') groupKey: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    await this.assertOwned(req.organizationId, projectId);
    return this.groups.pagesForGroup(
      projectId,
      groupKey,
      limit ? parseInt(limit, 10) : undefined,
      cursor,
    );
  }
}

function parseDays(days?: string): number {
  const n = days ? parseInt(days, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 28;
}
