import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AiVisibilityService } from './ai-visibility.service';
import { PromptEngineService } from './prompt-engine.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VisibilityWorkflowService } from './visibility-workflow.service';

@Controller(['api/projects/:projectId/ai-visibility', 'projects/:projectId/ai-visibility'])
@UseGuards(JwtAuthGuard)
export class AiVisibilityController {
  constructor(
    private readonly aiVisibilityService: AiVisibilityService,
    private readonly promptEngineService: PromptEngineService,
    private readonly prisma: PrismaService,
    private readonly workflow: VisibilityWorkflowService,
  ) {}

  @Get('journey')
  getJourney(@Param('projectId') projectId: string) {
    return this.workflow.read(projectId);
  }

  @Post('journey')
  prepareJourney(@Param('projectId') projectId: string) {
    return this.workflow.prepare(projectId);
  }

  @Post('journey/:journeyId/check')
  checkJourney(@Param('projectId') projectId: string, @Param('journeyId') journeyId: string, @Body('brief') brief?: unknown, @Body('planOnly') planOnly?: boolean) {
    return this.workflow.check(projectId, journeyId, brief, planOnly);
  }

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
    return this.aiVisibilityService.runScanForProject(projectId);
  }

  @Get('unified')
  async getUnifiedIntelligence(@Param('projectId') projectId: string) {
    return this.aiVisibilityService.getUnifiedIntelligence(projectId);
  }

  @Get('citations')
  async getCitations(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.aiVisibilityService.getCitationsIntelligence(projectId, Number(days) || 28);
  }

  @Get('root-cause')
  async getRootCause(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.aiVisibilityService.getRootCauseAnalysis(projectId, Number(days) || 28);
  }

  @Get('actions')
  async getActions(@Param('projectId') projectId: string) {
    return this.aiVisibilityService.getAiActions(projectId);
  }

  @Get('prompts')
  async listPrompts(@Param('projectId') projectId: string, @Query('days') days?: string) {
    const prompts = await this.prisma.aiVisibilityPrompt.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const latestScan = await this.prisma.aiVisibilityScan.findFirst({
      where: { projectId, status: { in: ['COMPLETED', 'PARTIAL'] }, createdAt: { gte: new Date(Date.now() - Math.min(90, Math.max(1, Number(days) || 28)) * 86400000) } },
      orderBy: { createdAt: 'desc' },
    });

    const responses = latestScan
      ? await this.prisma.aiVisibilityResponse.findMany({
          where: { scanRun: { scanId: latestScan.id } },
          include: { analysis: true, mentions: true, scanRun: true, citations: true },
        })
      : [];

    const responsesByPrompt = new Map<string, typeof responses>();
    for (const r of responses) {
      if (!responsesByPrompt.has(r.promptId)) {
        responsesByPrompt.set(r.promptId, []);
      }
      responsesByPrompt.get(r.promptId)!.push(r);
    }

    return prompts.map((p) => {
      const promptResponses = responsesByPrompt.get(p.id) || [];
      const latestChecks = promptResponses.map((r) => {
        const competitors = r.mentions
          .filter((m) => !m.isCustomer)
          .map((m) => m.brandName);

        return {
          assistant: r.scanRun?.provider || r.provider,
          checkedAt: r.createdAt.toISOString(),
          cited: Boolean(r.analysis?.brandMentioned),
          position: r.analysis?.brandPosition || null,
          citedUrl: r.citations[0]?.url ?? null,
          competitorsCited: competitors,
          error: r.errorMessage,
          model: r.model,
          answerExcerpt: r.rawResponse ? r.rawResponse.slice(0, 160) : null,
          fullAnswer: r.rawResponse,
        };
      });

      return {
        id: p.id,
        text: p.text,
        category: p.category,
        cluster: p.category,
        intent: p.journeyStage || null,
        estimatedVolume: null,
        isActive: p.isActive,
        latestChecks,
      };
    });
  }

  @Get('questions')
  async getQuestions(@Param('projectId') projectId: string) {
    return this.aiVisibilityService.getQuestionAnalysis(projectId);
  }

  @Get('questions/suggestions')
  async getQuestionSuggestions(@Param('projectId') projectId: string) {
    return this.aiVisibilityService.getQuestionSuggestions(projectId);
  }

  @Post('prompts')
  async addPrompts(
    @Param('projectId') projectId: string,
    @Body('prompts') prompts: { text: string; cluster?: string; category?: string }[],
  ) {
    if (!Array.isArray(prompts)) return { added: 0 };
    for (const p of prompts) {
      await this.prisma.aiVisibilityPrompt.create({
        data: {
          projectId,
          text: p.text,
          category: p.category || p.cluster || 'Custom',
        },
      });
    }
    return { added: prompts.length };
  }

  @Post('prompts/generate')
  async generatePrompts(
    @Param('projectId') projectId: string,
    @Body('overwrite') overwrite?: boolean,
  ) {
    return this.promptEngineService.generatePromptsForProject(projectId, Boolean(overwrite));
  }

  @Patch('prompts/:promptId')
  async updatePrompt(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Body() body: { isActive?: boolean; text?: string; category?: string },
  ) {
    const existing = await this.prisma.aiVisibilityPrompt.findFirst({
      where: { id: promptId, projectId },
    });
    if (!existing) throw new NotFoundException(`Prompt ${promptId} not found`);

    return this.prisma.aiVisibilityPrompt.update({
      where: { id: promptId },
      data: {
        ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
        ...(body.text ? { text: body.text } : {}),
        ...(body.category ? { category: body.category } : {}),
      },
    });
  }

  @Delete('prompts/:promptId')
  async deletePrompt(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
  ) {
    const existing = await this.prisma.aiVisibilityPrompt.findFirst({
      where: { id: promptId, projectId },
    });
    if (!existing) throw new NotFoundException(`Prompt ${promptId} not found`);

    await this.prisma.aiVisibilityPrompt.delete({
      where: { id: promptId },
    });

    return { success: true };
  }

  @Get('competitors')
  async listCompetitors(@Param('projectId') projectId: string) {
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: { website: { select: { id: true, crawlJobs: {
        orderBy: { createdAt: 'desc' }, take: 1,
        select: { status: true, errorMessage: true },
      } } } },
    });
    return Promise.all(competitors.map(async ({ website, ...competitor }) => {
      const latest = website?.crawlJobs[0];
      // A queued, failed or partial recrawl must not replace the last completed
      // measurements. Do not limit this lookup to the latest few attempts.
      const completed = website ? await this.prisma.crawlJob.findFirst({
        where: { websiteId: website.id, status: 'COMPLETED', finishedAt: { not: null } },
        orderBy: { finishedAt: 'desc' },
        select: { id: true, healthScore: true, finishedAt: true, _count: { select: { pages: true } } },
      }) : null;
      return { ...competitor,
        pagesCrawled: completed?._count.pages,
        healthScore: completed?.healthScore ?? null,
        crawlStatus: latest?.status,
        crawlError: latest?.status === 'FAILED' ? latest.errorMessage : null,
        lastAnalyzedAt: completed?.finishedAt ?? competitor.lastAnalyzedAt,
        rating: competitor.localRating,
        reviewCount: competitor.localReviewCount,
      };
    }));
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
      website: NonNullable<typeof ownWebsite> | NonNullable<(typeof competitors)[number]['website']> | null,
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
          .map((row) => ({ type: row.pageType, label: row.pageType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()), count: row._count._all }))
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
