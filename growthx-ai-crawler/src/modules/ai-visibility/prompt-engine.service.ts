import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService, AiTask, AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.service';

export const PROMPT_CATEGORIES_CONFIG = [
  { name: 'General Discovery', stage: 'DISCOVERY', targetCount: 4 },
  { name: 'Product/Service Discovery', stage: 'DISCOVERY', targetCount: 4 },
  { name: 'Local Search Intent', stage: 'CONSIDERATION', targetCount: 4 },
  { name: 'Competitor Comparison', stage: 'CONSIDERATION', targetCount: 4 },
  { name: 'Trust and Purchase Decisions', stage: 'RECOMMENDATION', targetCount: 4 },
] as const;

export type PromptCategoryName = typeof PROMPT_CATEGORIES_CONFIG[number]['name'];

@Injectable()
export class PromptEngineService {
  private readonly logger = new Logger(PromptEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouter: MultiAiRouterService,
  ) {}

  /**
   * Generates a neutral 20-prompt set (4 in each of 5 categories) using Gemini Flash-Lite.
   */
  async generatePromptsForProject(projectId: string, overwrite = false): Promise<{ count: number }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        websites: { where: { scope: 'own' } },
        competitors: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    // Check if stable active prompts already exist
    const existingCount = await this.prisma.aiVisibilityPrompt.count({
      where: { projectId, isActive: true },
    });

    if (existingCount >= 20 && !overwrite) {
      this.logger.log(`Project ${projectId} already has ${existingCount} active prompts. Keeping stable set.`);
      return { count: existingCount };
    }

    // Retrieve business profile context if available
    const profile = await this.prisma.projectBusinessProfile.findUnique({
      where: { projectId },
    });

    const ownWebsite = project.websites[0];
    const domain = ownWebsite?.domain || project.name;
    const industry = profile?.industry || 'Business Services';
    const city = profile?.city || '';
    const offerings = (profile?.offerings || []).join(', ');
    const competitorNames = project.competitors.map((c) => c.label || c.domain).join(', ');

    const promptContext = `
Business Type / Industry: ${industry}
City / Target Geography: ${city || 'Regional & National'}
Key Offerings / Services: ${offerings || domain}
Competitors: ${competitorNames || 'Other leading providers in the market'}
Website: ${domain}
`;

    const systemPrompt = `You are a neutral AI Search and Search Intent intelligence expert.
Generate 20 customer-oriented search discovery questions that prospective customers would ask conversational AI models (like ChatGPT, Perplexity, Gemini, Claude).
You must organize them into exactly 5 categories with 4 prompts each:
1. "General Discovery" (4 prompts): High-level industry discovery questions where a user explores options.
2. "Product/Service Discovery" (4 prompts): Questions about specific capabilities, features, packages, or services.
3. "Local Search Intent" (4 prompts): City or region-oriented discovery (e.g. in ${city || 'local markets'}).
4. "Competitor Comparison" (4 prompts): Unbiased comparison questions between solutions or top market brands (can mention competitors: ${competitorNames || 'top brands'}).
5. "Trust and Purchase Decisions" (4 prompts): Questions asking which providers are most reliable, trustworthy, verified, or best to buy from.

CRITICAL REQUIREMENT:
All prompts must be 100% NEUTRAL buyer queries.
NEVER insert the customer's brand name ("${project.name}") into generic discovery prompts, as doing so would bias the monitoring. The goal is to see if AI assistants independently discover, cite, and recommend "${project.name}".
`;

    try {
      const completion = await this.aiRouter.generate({
        prompt: `Generate the 20 neutral AI discovery questions for this business profile:\n${promptContext}`,
        systemInstruction: systemPrompt,
        task: AiTask.FAST,
        provider: AiProvider.GEMINI,
        model: 'gemini-2.5-flash-lite',
        organizationId: project.organizationId,
        projectId,
        jsonSchema: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    enum: [
                      'General Discovery',
                      'Product/Service Discovery',
                      'Local Search Intent',
                      'Competitor Comparison',
                      'Trust and Purchase Decisions',
                    ],
                  },
                  prompts: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['category', 'prompts'],
              },
            },
          },
          required: ['categories'],
        },
      });

      const parsed = JSON.parse(completion.text || '{}');
      const categories = parsed.categories || [];

      if (overwrite) {
        await this.prisma.aiVisibilityPrompt.updateMany({
          where: { projectId },
          data: { isActive: false },
        });
      }

      let createdCount = 0;

      for (const catConfig of PROMPT_CATEGORIES_CONFIG) {
        const found = categories.find((c: any) => c.category === catConfig.name);
        const questions: string[] = found?.prompts || [];

        for (const text of questions.slice(0, catConfig.targetCount)) {
          if (!text || text.trim().length === 0) continue;
          
          const newPrompt = await this.prisma.aiVisibilityPrompt.create({
            data: {
              projectId,
              text: text.trim(),
              category: catConfig.name,
              journeyStage: catConfig.stage,
              isActive: true,
            },
          });

          await this.prisma.aiVisibilityPromptVersion.create({
            data: {
              promptId: newPrompt.id,
              text: text.trim(),
              version: 1,
            },
          });

          createdCount++;
        }
      }

      this.logger.log(`Created ${createdCount} prompts across 5 categories for project ${projectId}`);
      return { count: createdCount };
    } catch (error: any) {
      this.logger.error(`Failed to generate 20 prompts for project ${projectId}: ${error.message}`, error.stack);
      throw new ServiceUnavailableException('AI visibility could not generate monitoring questions. The configured AI provider may be unavailable. Check its model configuration and try again; no visibility results were generated.');
    }
  }

  async updatePrompt(promptId: string, text: string): Promise<any> {
    const prompt = await this.prisma.aiVisibilityPrompt.findUnique({
      where: { id: promptId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });

    if (!prompt) {
      throw new NotFoundException(`Prompt ${promptId} not found`);
    }

    const nextVersion = (prompt.versions[0]?.version || 1) + 1;

    const updated = await this.prisma.aiVisibilityPrompt.update({
      where: { id: promptId },
      data: { text },
    });

    await this.prisma.aiVisibilityPromptVersion.create({
      data: {
        promptId,
        text,
        version: nextVersion,
      },
    });

    return updated;
  }

  async togglePrompt(promptId: string, isActive: boolean): Promise<any> {
    return this.prisma.aiVisibilityPrompt.update({
      where: { id: promptId },
      data: { isActive },
    });
  }

  async deletePrompt(promptId: string): Promise<any> {
    return this.prisma.aiVisibilityPrompt.delete({
      where: { id: promptId },
    });
  }
}

