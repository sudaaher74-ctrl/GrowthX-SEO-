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
