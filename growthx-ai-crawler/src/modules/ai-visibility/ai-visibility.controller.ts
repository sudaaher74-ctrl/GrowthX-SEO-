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

@Controller('projects/:projectId/ai-visibility')
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
    // Run asynchronously to allow fast HTTP response while scan runs
    this.aiVisibilityService.runScanForProject(projectId).catch((err) => {
      // Handled internally in runScanForProject with status: 'FAILED'
    });
    return { success: true, message: 'Scan started' };
  }

  @Get('unified')
  async getUnifiedIntelligence(@Param('projectId') projectId: string) {
    return this.aiVisibilityService.getUnifiedIntelligence(projectId);
  }

  @Get('citations')
  async getCitations(@Param('projectId') projectId: string) {
    return this.aiVisibilityService.getCitationsIntelligence(projectId);
  }

  @Get('root-cause')
  async getRootCause(@Param('projectId') projectId: string) {
    return this.aiVisibilityService.getRootCauseAnalysis(projectId);
  }

  @Get('actions')
  async getActions(@Param('projectId') projectId: string) {
    return this.aiVisibilityService.getAiActions(projectId);
  }

  @Get('prompts')
  async listPrompts(@Param('projectId') projectId: string) {
    const prompts = await this.prisma.aiVisibilityPrompt.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const latestScan = await this.prisma.aiVisibilityScan.findFirst({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });

    const responses = latestScan
      ? await this.prisma.aiVisibilityResponse.findMany({
          where: { scanRun: { scanId: latestScan.id } },
          include: { analysis: true, mentions: true, scanRun: true },
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
          citedUrl: null,
          competitorsCited: competitors,
          error: r.errorMessage,
          model: r.model,
          answerExcerpt: r.rawResponse ? r.rawResponse.slice(0, 160) : null,
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
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { competitors: true },
    });
    return project?.competitors || [];
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
