import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService, AiTask, AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { SubscriptionQuotaService, SubscriptionTier } from '../organizations/subscription-quota.service';

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
    private readonly quotaService: SubscriptionQuotaService,
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

  /**
   * Suggests high-intent conversational buyer prompts from the project's real GSC queries (last 28 days).
   * Converts raw search queries (e.g. "best X in Panvel", "X vs Y", "X price") into natural buyer questions.
   */
  async suggestPromptsFromGsc(projectId: string, tier: SubscriptionTier = 'founder_free'): Promise<{
    connected: boolean;
    reason?: string;
    message?: string;
    queryCount: number;
    totalImpressions: number;
    totalClicks: number;
    suggestions: Array<{
      sourceQuery: string;
      suggestedPrompt: string;
      category: string;
      journeyStage: string;
      impressions: number;
      clicks: number;
      avgPosition: number | null;
      isAlreadyTracked: boolean;
    }>;
    quota: {
      current: number;
      limit: number;
      remaining: number;
    };
  }> {
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

    const limits = this.quotaService.getLimits(tier);
    const existingPrompts = await this.prisma.aiVisibilityPrompt.findMany({
      where: { projectId, isActive: true },
      select: { id: true, text: true, sourceQuery: true },
    });
    const existingTexts = new Set(existingPrompts.map((p) => p.text.toLowerCase().trim()));
    const quotaInfo = {
      current: existingPrompts.length,
      limit: limits.promptsQuota,
      remaining: Math.max(0, limits.promptsQuota - existingPrompts.length),
    };

    const since28Days = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const gscRows = await this.prisma.gscDailyMetric.groupBy({
      by: ['query'],
      where: {
        projectId,
        grain: 'QUERY',
        date: { gte: since28Days },
        query: { not: null },
      },
      _sum: { impressions: true, clicks: true },
      _avg: { position: true },
      orderBy: { _sum: { impressions: 'desc' } },
      take: 30,
    });

    if (!gscRows || gscRows.length === 0) {
      return {
        connected: false,
        reason: 'NO_GSC_DATA',
        message: 'No Google Search Console query metrics found for the last 28 days. Connect Google Search Console to auto-discover buyer prompts from your real search traffic.',
        queryCount: 0,
        totalImpressions: 0,
        totalClicks: 0,
        suggestions: [],
        quota: quotaInfo,
      };
    }

    const validQueries = gscRows.filter((r) => r.query && r.query.trim().length >= 3).slice(0, 20);

    if (validQueries.length === 0) {
      return {
        connected: true,
        reason: 'INSUFFICIENT_QUERIES',
        message: 'Google Search Console is connected, but recorded queries were anonymised or too short.',
        queryCount: 0,
        totalImpressions: 0,
        totalClicks: 0,
        suggestions: [],
        quota: quotaInfo,
      };
    }

    const ownWebsite = project.websites[0];
    const domain = ownWebsite?.domain || project.name;
    const competitorNames = project.competitors.map((c) => c.label || c.domain).join(', ');

    const queryListText = validQueries
      .map((q, idx) => `${idx + 1}. Query: "${q.query}" (Impressions: ${q._sum.impressions || 0}, Clicks: ${q._sum.clicks || 0})`)
      .join('\n');

    const systemPrompt = `You are a neutral AI Search and Search Intent intelligence expert.
Convert raw Google Search queries from actual visitors into natural, high-intent conversational buyer questions that users ask AI assistants (ChatGPT, Perplexity, Gemini, Claude).

Example conversions:
- "best digital marketing agency mumbai" -> "What is the best digital marketing agency in Mumbai for local businesses?"
- "iphone 16 vs pixel 9 price" -> "How does the iPhone 16 compare to the Pixel 9 in price and camera quality?"
- "root canal cost bandra" -> "What is the average cost of a root canal treatment in Bandra?"
- "web development company pune" -> "Which web development companies in Pune have the best track record for startups?"

CRITICAL REQUIREMENTS:
1. Every item must correspond directly to one of the provided visitor search queries.
2. Turn each search phrase into a clear, natural question that a customer would type into ChatGPT or Perplexity.
3. Assign each a category:
   - "General Discovery"
   - "Product/Service Discovery"
   - "Local Search Intent"
   - "Competitor Comparison"
   - "Trust and Purchase Decisions"
4. Assign journeyStage: "DISCOVERY", "CONSIDERATION", or "RECOMMENDATION".
5. Never invent fictional or hallucinated topics. Preserve the city, service, or comparison from the source query.
`;

    try {
      const completion = await this.aiRouter.generate({
        prompt: `Convert these actual search queries for website ${domain} (competitors: ${competitorNames || 'leading brands'}) into conversational buyer prompts:\n${queryListText}`,
        systemInstruction: systemPrompt,
        task: AiTask.FAST,
        provider: AiProvider.GEMINI,
        model: 'gemini-2.5-flash-lite',
        organizationId: project.organizationId,
        projectId,
        jsonSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sourceQuery: { type: 'string' },
                  suggestedPrompt: { type: 'string' },
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
                  journeyStage: {
                    type: 'string',
                    enum: ['DISCOVERY', 'CONSIDERATION', 'RECOMMENDATION'],
                  },
                },
                required: ['sourceQuery', 'suggestedPrompt', 'category', 'journeyStage'],
              },
            },
          },
          required: ['items'],
        },
      });

      const parsed = JSON.parse(completion.text || '{}');
      const items: Array<{
        sourceQuery: string;
        suggestedPrompt: string;
        category: string;
        journeyStage: string;
      }> = parsed.items || [];

      const queryMap = new Map<string, (typeof validQueries)[number]>();
      for (const q of validQueries) {
        if (q.query) queryMap.set(q.query.toLowerCase().trim(), q);
      }

      const suggestions = items
        .filter((item) => item.suggestedPrompt && item.suggestedPrompt.trim().length > 0)
        .map((item) => {
          const matchedGsc = queryMap.get(item.sourceQuery?.toLowerCase().trim()) ||
            validQueries.find((q) => q.query && item.sourceQuery && item.sourceQuery.toLowerCase().includes(q.query.toLowerCase()));

          const impressions = matchedGsc?._sum.impressions ?? 0;
          const clicks = matchedGsc?._sum.clicks ?? 0;
          const avgPosition = matchedGsc?._avg.position ? Number(matchedGsc._avg.position.toFixed(1)) : null;
          const isAlreadyTracked = existingTexts.has(item.suggestedPrompt.toLowerCase().trim());

          return {
            sourceQuery: item.sourceQuery || matchedGsc?.query || '',
            suggestedPrompt: item.suggestedPrompt.trim(),
            category: item.category || 'Product/Service Discovery',
            journeyStage: item.journeyStage || 'DISCOVERY',
            impressions,
            clicks,
            avgPosition,
            isAlreadyTracked,
          };
        });

      // Sort by impressions descending
      suggestions.sort((a, b) => b.impressions - a.impressions);

      const totalImpressions = validQueries.reduce((acc, q) => acc + (q._sum.impressions || 0), 0);
      const totalClicks = validQueries.reduce((acc, q) => acc + (q._sum.clicks || 0), 0);

      return {
        connected: true,
        queryCount: validQueries.length,
        totalImpressions,
        totalClicks,
        suggestions,
        quota: quotaInfo,
      };
    } catch (error: any) {
      this.logger.error(`Failed to convert GSC queries to prompts: ${error.message}`, error.stack);
      // Fallback: If AI provider is unavailable, format queries directly as natural questions without failing
      const fallbackSuggestions = validQueries.map((q) => {
        const rawQ = q.query!.trim();
        const question = rawQ.toLowerCase().startsWith('how') || rawQ.toLowerCase().startsWith('what') || rawQ.toLowerCase().startsWith('where') || rawQ.toLowerCase().startsWith('why')
          ? `${rawQ.charAt(0).toUpperCase() + rawQ.slice(1)}?`
          : `What are the best options for ${rawQ}?`;

        return {
          sourceQuery: rawQ,
          suggestedPrompt: question,
          category: 'General Discovery',
          journeyStage: 'DISCOVERY',
          impressions: q._sum.impressions || 0,
          clicks: q._sum.clicks || 0,
          avgPosition: q._avg.position ? Number(q._avg.position.toFixed(1)) : null,
          isAlreadyTracked: existingTexts.has(question.toLowerCase().trim()),
        };
      });

      return {
        connected: true,
        reason: 'FALLBACK_FORMATTING',
        queryCount: validQueries.length,
        totalImpressions: validQueries.reduce((acc, q) => acc + (q._sum.impressions || 0), 0),
        totalClicks: validQueries.reduce((acc, q) => acc + (q._sum.clicks || 0), 0),
        suggestions: fallbackSuggestions,
        quota: quotaInfo,
      };
    }
  }

  /**
   * Adds selected suggested prompts to active tracking, respecting plan quota limits.
   */
  async addPromptsFromSuggestions(
    projectId: string,
    prompts: Array<{
      text: string;
      category?: string;
      journeyStage?: string;
      sourceQuery?: string;
    }>,
    tier: SubscriptionTier = 'founder_free',
  ): Promise<{ added: number; prompts: any[] }> {
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return { added: 0, prompts: [] };
    }

    // Enforce plan quota
    await this.quotaService.assertPromptQuota(projectId, tier, prompts.length);

    const created = [];
    for (const item of prompts) {
      const text = item.text?.trim();
      if (!text) continue;

      // Check if already active
      const exists = await this.prisma.aiVisibilityPrompt.findFirst({
        where: { projectId, text, isActive: true },
      });
      if (exists) continue;

      const newPrompt = await this.prisma.aiVisibilityPrompt.create({
        data: {
          projectId,
          text,
          category: item.category || 'Product/Service Discovery',
          journeyStage: item.journeyStage || 'DISCOVERY',
          sourceQuery: item.sourceQuery?.trim() || null,
          isActive: true,
        },
      });

      await this.prisma.aiVisibilityPromptVersion.create({
        data: {
          promptId: newPrompt.id,
          text,
          version: 1,
        },
      });

      created.push(newPrompt);
    }

    this.logger.log(`Added ${created.length} prompts from GSC suggestions for project ${projectId}`);
    return { added: created.length, prompts: created };
  }

  /**
   * Generates natural language variants of a buyer prompt for the Indian market.
   * Supported: 'en' (English), 'hi' (Hindi / हिंदी), 'hinglish' (Hinglish), 'mr' (Marathi / मराठी).
   */
  async generateLanguageVariants(
    promptText: string,
    targetLanguages: string[],
    city?: string,
    projectId?: string,
  ): Promise<Array<{ language: string; text: string }>> {
    const validLanguages = targetLanguages
      .map((l) => l.toLowerCase().trim())
      .filter((l) => ['en', 'hi', 'hinglish', 'mr'].includes(l));

    if (validLanguages.length === 0) {
      return [{ language: 'en', text: promptText }];
    }

    const nonEnglish = validLanguages.filter((l) => l !== 'en');
    if (nonEnglish.length === 0) {
      return [{ language: 'en', text: promptText }];
    }

    const systemPrompt = `You are a regional Indian search intent and multilingual prompt engineer.
Adapt the following English buyer question into high-intent conversational questions for Indian users in the requested languages:
- 'hi': Natural Hindi written in Devanagari script (e.g. "मुंबई में सबसे अच्छी डिजिटल मार्केटिंग एजेंसी कौन सी है?")
- 'hinglish': Conversational Hinglish in Latin script as spoken and typed across India (e.g. "Mumbai mein best digital marketing agency kaun si hai?")
- 'mr': Natural Marathi in Devanagari script (e.g. "मुंबईमध्ये सर्वात चांगली डिजिटल मार्केटिंग एजन्सी कोणती आहे?")

CRITICAL RULES:
1. Preserve the exact buyer intent, industry context, and city (${city || 'local market'}).
2. Ensure colloquial authenticity — use phrasing actual Indian consumers type into ChatGPT, Gemini, or Perplexity.
3. Keep brand names or technical terms untranslated when commonly referenced that way.
`;

    try {
      const completion = await this.aiRouter.generate({
        prompt: `Convert this buyer question into the following languages [${nonEnglish.join(', ')}]:\n"${promptText}"`,
        systemInstruction: systemPrompt,
        task: AiTask.FAST,
        provider: AiProvider.GEMINI,
        model: 'gemini-2.5-flash-lite',
        projectId,
        jsonSchema: {
          type: 'object',
          properties: {
            variants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  language: { type: 'string', enum: ['hi', 'hinglish', 'mr'] },
                  text: { type: 'string' },
                },
                required: ['language', 'text'],
              },
            },
          },
          required: ['variants'],
        },
      });

      const parsed = JSON.parse(completion.text || '{}');
      const variants: Array<{ language: string; text: string }> = parsed.variants || [];

      const results = [{ language: 'en', text: promptText }];
      for (const lang of nonEnglish) {
        const found = variants.find((v) => v.language.toLowerCase() === lang.toLowerCase());
        if (found && found.text?.trim()) {
          results.push({ language: lang.toLowerCase(), text: found.text.trim() });
        }
      }
      return results;
    } catch (err: any) {
      this.logger.warn(`Failed to generate language variants for prompt "${promptText}": ${err.message}`);
      return [{ language: 'en', text: promptText }];
    }
  }
}

