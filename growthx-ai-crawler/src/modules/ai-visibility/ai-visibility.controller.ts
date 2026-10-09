import { Controller, Get, Post, Body, Param, Query, Delete, UseGuards } from '@nestjs/common';
import { AiVisibilityService } from './ai-visibility.service';
import { PromptEngineService } from './prompt-engine.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller(['api/projects/:projectId/ai-visibility', 'projects/:projectId/ai-visibility'])
@UseGuards(JwtAuthGuard)
export class AiVisibilityController {
  constructor(
    private readonly aiVisibilityService: AiVisibilityService,
    private readonly promptEngineService: PromptEngineService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getVisibilityReport(
    @Param('projectId') projectId: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 28;
    return this.aiVisibilityService.getReport(projectId, daysNum);
  }

  @Post('sweep')
  async runSweep(@Param('projectId') projectId: string) {
    // Fire and forget or await
    this.aiVisibilityService.runScanForProject(projectId);
    return { success: true, message: 'Scan started' };
  }

  @Get('prompts')
  async listPrompts(@Param('projectId') projectId: string) {
    const prompts = await this.prisma.aiVisibilityPrompt.findMany({
      where: { projectId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    // Frontend expects TrackedPromptRow[]
    return prompts.map(p => ({
      id: p.id,
      text: p.text,
      category: p.category,
      citations: 0,
      sharePct: 0,
      trend: [],
    }));
  }

  @Post('prompts')
  async addPrompts(
    @Param('projectId') projectId: string,
    @Body('prompts') prompts: { text: string; cluster?: string }[],
  ) {
    for (const p of prompts) {
      await this.prisma.aiVisibilityPrompt.create({
        data: {
          projectId,
          text: p.text,
          category: p.cluster || 'Custom',
        },
      });
    }
    return { added: prompts.length };
  }

  @Get('competitors')
  async listCompetitors(@Param('projectId') projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { competitors: true },
    });
    return project?.competitors || [];
  }

  /**
   * Website coverage for the Battleground panel. This path is called by the
   * frontend directly; returning real crawl data here avoids a 404 and keeps
   * unmeasured pages distinct from a site that has no pages.
   */
  @Get('competitors/websites')
  async listCompetitorWebsites(@Param('projectId') projectId: string) {
    const [project, ownWebsite, competitors] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      }),
      this.prisma.website.findFirst({
        where: { projectId },
        select: { id: true, domain: true, crawlJobs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { _count: { select: { pages: true } } },
        } },
      }),
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { id: true, domain: true, name: true, label: true, localRating: true, localReviewCount: true,
          website: { select: { id: true, domain: true, crawlJobs: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { _count: { select: { pages: true } } },
          } } },
        },
      }),
    ]);

    const toSite = async (
      role: 'you' | 'competitor',
      competitorId: string | null,
      domain: string,
      name: string,
      website: { id: string; domain: string; crawlJobs: Array<any> } | null,
      rating: number | null = null,
      reviewCount: number | null = null,
    ) => {
      const jobs = website?.crawlJobs ?? [];
      const latest = jobs[0] ?? null;
      const completed = jobs.find((job) => job.status === 'COMPLETED') ?? null;
      const active = latest?.status === 'RUNNING' || latest?.status === 'PENDING';
      const pageTypes = completed
        ? await this.prisma.page.groupBy({
            by: ['pageType'],
            where: { crawlJobId: completed.id },
            _count: { _all: true },
          })
        : [];
      const pagesRead = completed?._count.pages ?? null;

      return {
        role,
        competitorId,
        domain: website?.domain ?? domain,
        name,
        status: active
          ? latest.status === 'RUNNING' ? 'READING' : 'QUEUED'
          : latest?.status === 'FAILED' && !completed ? 'FAILED'
          : completed ? (latest?.status === 'FAILED' ? 'FAILED' : 'READ')
          : 'WAITING',
        pagesRead,
        // Not-opened counts require the crawl frontier; leave them unknown when
        // the historical frontier has been pruned instead of reporting a guess.
        notOpened: null,
        pagesSoFar: active ? latest.pagesCrawled : null,
        notOpenedSoFar: active ? Math.max(0, latest.pagesDiscovered - latest.pagesCrawled) : null,
        readingStartedAt: active ? latest.startedAt?.toISOString() ?? null : null,
        lastReadAt: completed?.finishedAt?.toISOString() ?? null,
        error: latest?.status === 'FAILED' ? latest.errorMessage : null,
        healthScore: completed?.healthScore ?? null,
        rating,
        reviewCount,
        pageTypes: pageTypes
          .map((row) => ({ type: row.pageType, label: row.pageType.replace(/_/g, ' ').toLowerCase().replace(/\\b\\w/g, (letter) => letter.toUpperCase()), count: row._count._all }))
          .sort((a, b) => b.count - a.count),
      };
    };

    const sites = [];
    if (ownWebsite) {
      sites.push(await toSite('you', null, ownWebsite.domain, project?.name ?? ownWebsite.domain, ownWebsite));
    }
    for (const competitor of competitors) {
      sites.push(await toSite(
        'competitor',
        competitor.id,
        competitor.website?.domain ?? competitor.domain,
        competitor.name || competitor.label || competitor.domain,
        competitor.website,
        competitor.localRating,
        competitor.localReviewCount,
      ));
    }
    return { sites };
  }

  @Post('competitors')
  async addCompetitor(
    @Param('projectId') projectId: string,
    @Body('domain') domain: string,
    @Body('label') label?: string,
  ) {
    const competitor = await this.prisma.competitorDomain.create({
      data: {
        projectId,
        domain,
        label: label || domain,
      },
    });
    return competitor;
  }
}
