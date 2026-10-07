import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';

export const DEFAULT_PROMPT_CATEGORIES = [
  'Discovery',
  'Recommendation',
  'Problem/Solution',
  'Comparison',
  'Purchase Intent',
  'Competitor Alternative',
  'Local Intent',
  'Product/Service Intent',
  'Trust/Authority',
  'Final Recommendation',
];

@Injectable()
export class PromptEngineService {
  private readonly logger = new Logger(PromptEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouter: MultiAiRouterService,
  ) {}

  async generatePromptsForProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: true },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Determine the website domain
    const ownWebsite = project.websites.find((w: any) => w.scope === 'own');
    const domain = ownWebsite?.domain || project.name;

    // Use AI Router to generate prompts based on the project data
    const systemPrompt = `You are an SEO expert. Generate 10 distinct, highly realistic search prompts that potential customers would ask an AI assistant about a business like ${project.name} (${domain}). 
Cover these categories: ${DEFAULT_PROMPT_CATEGORIES.join(', ')}.
Return exactly 10 questions as a JSON array of strings. Do not include any other text.`;

    try {
      const completion = await this.aiRouter.generate({
        prompt: `Generate questions for ${project.name}`,
        systemInstruction: systemPrompt,
        task: 'GENERAL' as any,
        organizationId: project.organizationId,
        jsonSchema: {
          type: 'array',
          items: { type: 'string' }
        },
      });

      const resultText = completion.text || '[]';
      const questions = JSON.parse(resultText) as string[];

      if (questions.length !== 10) {
        this.logger.warn(`Expected 10 questions, but got ${questions.length}`);
      }

      // Save to database
      for (let i = 0; i < Math.min(10, questions.length); i++) {
        const text = questions[i];
        const category = DEFAULT_PROMPT_CATEGORIES[i] || 'Discovery';
        let journeyStage = 'DISCOVERY';
        if (category.includes('Recommendation') || category.includes('Purchase') || category.includes('Final')) {
          journeyStage = 'RECOMMENDATION';
        } else if (category.includes('Comparison') || category.includes('Alternative')) {
          journeyStage = 'CONSIDERATION';
        }

        const newPrompt = await this.prisma.aiVisibilityPrompt.create({
          data: {
            projectId,
            text,
            category,
            journeyStage,
          },
        });

        // Save first version
        await this.prisma.aiVisibilityPromptVersion.create({
          data: {
            promptId: newPrompt.id,
            text,
            version: 1,
          },
        });
      }

      this.logger.log(`Successfully generated and saved prompts for project ${projectId}`);
    } catch (error) {
      this.logger.error('Failed to generate prompts', error);
      throw error;
    }
  }
}
