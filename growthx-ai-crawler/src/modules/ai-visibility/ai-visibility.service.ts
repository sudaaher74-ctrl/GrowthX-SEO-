import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  Inject,
  forwardRef,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderAbstractionService } from './ai-provider-abstraction.service';
import { AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { ResponseAnalyzerService } from './response-analyzer.service';
import { MetricsEngineService } from './metrics-engine.service';
import { questionAnalysis, questionSuggestions } from './question-analysis';
import { PromptEngineService } from './prompt-engine.service';
import { FindingSyncService } from '../opportunities/finding-sync.service';

export interface MonitoredModelConfig {
  key: string;
  label: string;
  provider: AiProvider;
  model: string;
}

@Injectable()
export class AiVisibilityService {
  private readonly logger = new Logger(AiVisibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerAbstraction: AiProviderAbstractionService,
    private readonly analyzer: ResponseAnalyzerService,
    private readonly metrics: MetricsEngineService,
    private readonly promptEngine: PromptEngineService,
    @Optional()
    @Inject(forwardRef(() => FindingSyncService))
    private readonly findingSync?: FindingSyncService,
  ) {}

  getQuestionAnalysis(projectId: string) {
    return questionAnalysis(this.prisma, projectId);
  }

  getQuestionSuggestions(projectId: string) {
    return questionSuggestions(this.prisma, projectId);
  }

  /**
   * The 5 production-monitored AI model families.
   * Configurable via env variables with verified fallbacks.
   */
  getMonitoredModels(): MonitoredModelConfig[] {
    return [
      {
        key: 'gemini',
        label: 'Gemini',
        provider: AiProvider.GEMINI,
        model: process.env.AI_VISIBILITY_MODEL_GEMINI || 'gemini-2.5-flash-lite',
      },
      {
        key: 'gpt',
        label: 'GPT',
        provider: AiProvider.OPENROUTER,
        model: process.env.AI_VISIBILITY_MODEL_GPT || 'openai/gpt-4.1-mini',
      },
      {
        key: 'claude',
        label: 'Claude',
        provider: AiProvider.OPENROUTER,
        model: process.env.AI_VISIBILITY_MODEL_CLAUDE || 'anthropic/claude-sonnet-4.6',
      },
      {
        key: 'perplexity',
        label: 'Perplexity',
        provider: AiProvider.PERPLEXITY,
        model: process.env.AI_VISIBILITY_MODEL_PERPLEXITY || 'sonar',
      },
      {
        key: 'grok',
        label: 'Grok',
        provider: AiProvider.OPENROUTER,
        model: process.env.AI_VISIBILITY_MODEL_GROK || 'x-ai/grok-4.3',
      },
    ];
  }

  /**
   * Calculates the 3-cycle cycleId:
   * Cycle 1: 1st - 10th
   * Cycle 2: 11th - 20th
   * Cycle 3: 21st - end of month
   */
  getCycleId(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = date.getDate();
    const cycleNum = day <= 10 ? 1 : day <= 20 ? 2 : 3;
    return `${y}-${m}-cycle-${cycleNum}`;
  }

  async runScanForProject(projectId: string) {
    this.logger.log(`Starting AI Visibility scan for project ${projectId}`);

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

    // 1. Fetch active prompts or auto-generate if none exist
    let prompts = await this.prisma.aiVisibilityPrompt.findMany({
      where: { projectId, isActive: true },
    });

    if (prompts.length === 0) {
      this.logger.log(`No active prompts found for project ${projectId}. Generating 20 neutral prompts.`);
      await this.promptEngine.generatePromptsForProject(projectId, false);
      prompts = await this.prisma.aiVisibilityPrompt.findMany({
        where: { projectId, isActive: true },
      });
    }

    if (prompts.length === 0) {
      this.logger.warn(`Still no prompts found for project ${projectId} after generation.`);
      throw new BadRequestException('Add at least one buyer question in the Questions tab before running AI Visibility.');
    }

    // 2. Fetch configured models / settings
    const settings = await this.prisma.aiVisibilitySettings.findUnique({
      where: { projectId },
    });

    const allModels = this.getMonitoredModels();
    let targetModels = allModels;

    if (settings?.enabledModels && settings.enabledModels.length > 0) {
      const enabledSet = new Set(settings.enabledModels.map((m) => m.toLowerCase()));
      const filtered = allModels.filter(
        (m) =>
          enabledSet.has(m.key.toLowerCase()) ||
          enabledSet.has(m.label.toLowerCase()) ||
          enabledSet.has(m.provider.toLowerCase()),
      );
      if (filtered.length > 0) {
        targetModels = filtered;
      }
    }

    const configured = this.providerAbstraction.configuredProviders();
    const enabledModels = targetModels.filter((m) => configured.includes(m.provider));
    const requestedProviders = (settings?.enabledModels || [])
      .map((p) => p.toUpperCase())
      .filter((p): p is AiProvider => Object.values(AiProvider).includes(p as AiProvider));
    const modelSkipped = targetModels.map((m) => m.provider).filter((p) => !configured.includes(p));
    const providerSkipped = requestedProviders.filter((p) => !configured.includes(p));
    const skippedAssistants = [...new Set([...modelSkipped, ...providerSkipped])];

    if (enabledModels.length === 0) {
      throw new ServiceUnavailableException("No selected AI assistant is configured. Enable Gemini or update this project's AI visibility settings.");
    }

    const cycleId = this.getCycleId();

    // 3. Create a scan record
    const scan = await this.prisma.aiVisibilityScan.create({
      data: {
        projectId,
        cycleId,
        status: 'RUNNING',
      },
    });

    let totalCost = 0;
    let completedCount = 0;

    try {
      // 4. Execute prompts against the monitored models
      for (const config of enabledModels) {
        const scanRun = await this.prisma.aiVisibilityScanRun.create({
          data: {
            scanId: scan.id,
            provider: config.provider,
            model: config.model,
            status: 'RUNNING',
          },
        });

        for (const prompt of prompts) {
          this.logger.debug(`Running prompt ${prompt.id} on ${config.label} (${config.model})`);

          const result = await this.providerAbstraction.runPrompt(
            prompt.text,
            config.provider,
            project.organizationId,
            projectId,
            config.model,
          );

          await this.prisma.aiVisibilityResponse.create({
            data: {
              scanRunId: scanRun.id,
              promptId: prompt.id,
              provider: config.provider,
              model: result.model || config.model,
              promptText: prompt.text,
              promptVersion: 1,
              rawResponse: result.text,
              latencyMs: result.latencyMs,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              totalTokens: result.inputTokens + result.outputTokens,
              estimatedCost: result.costUsd || 0,
              errorMessage: result.error || null,
            },
          });

          if (result.costUsd) {
            totalCost += result.costUsd;
          }
          if (!result.error && result.text) {
            completedCount++;
          }
        }

        await this.prisma.aiVisibilityScanRun.update({
          where: { id: scanRun.id },
          data: { status: 'COMPLETED' },
        });
      }

      // 5. Transition scan to analyzing
      await this.prisma.aiVisibilityScan.update({
        where: { id: scan.id },
        data: { status: 'ANALYZING' },
      });

      // 6. Analyze Responses with ResponseAnalyzerService
      await this.analyzer.analyzePendingResponses(scan.id);

      // 7. Calculate Metrics with MetricsEngineService
      await this.metrics.calculateScanMetrics(scan.id, projectId);

      // 8. Reconcile findings into GrowthOpportunity via FindingSyncService
      if (this.findingSync) {
        try {
          const syncResult = await this.findingSync.syncProject(projectId);
          this.logger.log(
            `Opportunities synced for project ${projectId}: ${syncResult.created} created, ${syncResult.updated} updated`,
          );
        } catch (syncErr: any) {
          this.logger.error(`FindingSync failed for project ${projectId}: ${syncErr.message}`);
        }
      }

      // 9. Mark scan completed
      await this.prisma.aiVisibilityScan.update({
        where: { id: scan.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      this.logger.log(`Scan ${scan.id} completed. Total cost: $${totalCost.toFixed(4)}. Responses: ${completedCount}`);

      const responses = await this.prisma.aiVisibilityResponse.findMany({
        where: { scanRun: { scanId: scan.id } },
        include: { analysis: true },
      });

      return {
        checksRun: responses.filter((r) => !r.errorMessage && r.analysis).length,
        checksFailed: responses.filter((r) => r.errorMessage || !r.analysis).length,
        citations: responses.filter((r) => !r.errorMessage && r.analysis?.brandMentioned).length,
        skippedAssistants,
      };
    } catch (e: any) {
      this.logger.error(`Scan ${scan.id} failed`, e.stack);
      await this.prisma.aiVisibilityScan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          errorMessage: e.message,
        },
      });
      if (e instanceof BadRequestException || e instanceof ServiceUnavailableException || e instanceof NotFoundException) {
        throw e;
      }
      throw new ServiceUnavailableException('AI Visibility could not finish. Please try again or check the AI provider configuration.');
    }
  }

  async getReport(projectId: string, days: number) {
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const periodEnd = new Date().toISOString();

    const latestMetrics = await this.prisma.aiVisibilityMetrics.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { scan: { include: { runs: true } } },
    });

    if (!latestMetrics) {
      return {
        periodStart,
        periodEnd,
        summary: {
          checked: 0,
          cited: 0,
          citationSharePct: 0,
          deltaPt: null,
          previousCitationSharePct: null,
          averagePosition: null,
          failedChecks: 0,
        },
        byAssistant: [] as any[],
        shareOfVoice: [] as any[],
        trend: [] as any[],
        measurableAssistants: this.providerAbstraction.configuredProviders(),
        brandPerception: { positive: 0, neutral: 0, negative: 0, total: 0 },
        customerJourney: {
          discovery: { checked: 0, cited: 0, citationSharePct: 0 },
          recommendation: { checked: 0, cited: 0, citationSharePct: 0 },
        },
      };
    }

    const responses = await this.prisma.aiVisibilityResponse.findMany({
      where: { scanRun: { scanId: latestMetrics.scanId } },
      include: { prompt: true, analysis: true, scanRun: true },
    });

    let positive = 0;
    let neutral = 0;
    let negative = 0;
    let total = 0;
    let discChecked = 0;
    let discCited = 0;
    let recChecked = 0;
    let recCited = 0;
    let failedChecks = 0;
    let validChecked = 0;
    let validCited = 0;

    for (const r of responses) {
      if (r.errorMessage || !r.rawResponse) {
        failedChecks++;
        continue;
      }

      validChecked++;
      if (r.analysis?.brandMentioned) {
        validCited++;
      }

      if (r.analysis) {
        if (r.analysis.sentiment === 'POSITIVE') positive++;
        else if (r.analysis.sentiment === 'NEGATIVE') negative++;
        else neutral++;
        total++;
      }

      const p = r.prompt;
      if (p) {
        const isMentioned = r.analysis?.brandMentioned || false;
        const cat = (p.category || '').toUpperCase();
        const stage = p.journeyStage;
        if (stage === 'DISCOVERY' || cat.includes('DISCOVERY') || cat.includes('GENERAL') || cat.includes('PRODUCT')) {
          discChecked++;
          if (isMentioned) discCited++;
        } else if (stage === 'RECOMMENDATION' || cat.includes('RECOMMENDATION') || cat.includes('TRUST') || cat.includes('DECISION')) {
          recChecked++;
          if (isMentioned) recCited++;
        }
      }
    }

    const brandPerception = { positive, neutral, negative, total };
    const customerJourney = {
      discovery: {
        checked: discChecked,
        cited: discCited,
        citationSharePct: discChecked > 0 ? Math.round((discCited / discChecked) * 100) : 0,
      },
      recommendation: {
        checked: recChecked,
        cited: recCited,
        citationSharePct: recChecked > 0 ? Math.round((recCited / recChecked) * 100) : 0,
      },
    };

    // Calculate real byAssistant breakdown from responses per scan run
    const byAssistant = latestMetrics.scan.runs.map((r: any) => {
      const runResponses = responses.filter((resp) => resp.scanRunId === r.id);
      const valid = runResponses.filter((resp) => !resp.errorMessage && resp.rawResponse);
      const checked = valid.length;
      const cited = valid.filter((resp) => resp.analysis?.brandMentioned).length;
      const citationSharePct = checked > 0 ? Math.round((cited / checked) * 100) : 0;

      return {
        assistant: r.provider,
        model: r.model,
        checked,
        cited,
        citationSharePct,
      };
    });

    const measurableAssistants = [
      ...new Set([
        ...this.providerAbstraction.configuredProviders(),
        ...latestMetrics.scan.runs.map((r: any) => r.provider),
      ]),
    ];

    // Read historical scans for real trend and deltaPt
    const historicalMetrics = await this.prisma.aiVisibilityMetrics.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    let deltaPt: number | null = null;
    let previousCitationSharePct: number | null = null;

    if (historicalMetrics.length >= 2) {
      previousCitationSharePct = Math.round(historicalMetrics[1].visibilityScore);
      deltaPt = Math.round(latestMetrics.visibilityScore - historicalMetrics[1].visibilityScore);
    }

    const trend = [...historicalMetrics].reverse().map((m) => {
      const funnel = (m.funnelMetrics as any) || {};
      return {
        weekStart: m.createdAt.toISOString(),
        checked: funnel.totalAnalyzed ?? 0,
        citationSharePct: Math.round(m.visibilityScore),
      };
    });

    // Ensure shareOfVoice matches { domain: string | null; label: string; mentions: number; sharePct: number }[]
    const shareOfVoiceRaw = Array.isArray(latestMetrics.shareOfVoice) ? latestMetrics.shareOfVoice : [];
    const shareOfVoice = shareOfVoiceRaw.map((s: any) => ({
      domain: s.domain ?? null,
      label: s.label || (s.domain ? s.domain : 'Your Brand'),
      sharePct: Math.round(s.sharePct || 0),
      mentions: s.mentions || 0,
    }));

    return {
      periodStart,
      periodEnd,
      summary: {
        checked: validChecked,
        cited: validCited,
        citationSharePct: Math.round(latestMetrics.visibilityScore),
        deltaPt,
        previousCitationSharePct,
        averagePosition: latestMetrics.averagePosition ? Number(latestMetrics.averagePosition.toFixed(1)) : null,
        failedChecks,
      },
      byAssistant,
      shareOfVoice,
      trend,
      measurableAssistants,
      brandPerception,
      customerJourney,
    };
  }

  async getUnifiedIntelligence(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        businessProfile: true,
        websites: { where: { scope: 'own' } },
        competitors: true,
      },
    });

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    // Latest audit crawl
    const latestCrawl = await this.prisma.crawlJob.findFirst({
      where: { website: { projectId } },
      orderBy: { createdAt: 'desc' },
    });

    // Count issues from audit
    const openIssuesCount = await this.prisma.issue.count({
      where: { projectId, status: 'OPEN' },
    });

    // Search Console integration state
    const integration = await this.prisma.integrationConfig.findUnique({
      where: { projectId },
    });

    // Active prompts count
    const activePromptsCount = await this.prisma.aiVisibilityPrompt.count({
      where: { projectId, isActive: true },
    });

    // Latest scan metrics
    const latestMetrics = await this.prisma.aiVisibilityMetrics.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // Opportunities count
    const opportunitiesCount = await this.prisma.growthOpportunity.count({
      where: { projectId, status: 'OPEN' },
    });

    return {
      domain: project.websites[0]?.domain || project.name,
      brandName: project.businessProfile?.businessName || project.name,
      industry: project.businessProfile?.industry || 'Business Services',
      city: project.businessProfile?.city || null,
      crawlStatus: {
        lastCrawlAt: latestCrawl?.finishedAt?.toISOString() || null,
        status: latestCrawl?.status || 'IDLE',
        openIssuesCount,
        healthScore: latestCrawl?.healthScore ?? null,
      },
      searchConsole: {
        connected: Boolean(integration?.gscConnected),
      },
      competitorCount: project.competitors.length,
      activePromptsCount,
      visibilityScore: latestMetrics ? Math.round(latestMetrics.visibilityScore) : null,
      cycleId: this.getCycleId(),
      opportunitiesCount,
    };
  }

  async getCitationsIntelligence(projectId: string) {
    const latestScan = await this.prisma.aiVisibilityScan.findFirst({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestScan) {
      return { totalCitations: 0, citationsByDomain: [] };
    }

    const citations = await this.prisma.aiVisibilityCitation.findMany({
      where: { response: { scanRun: { scanId: latestScan.id } } },
      include: { response: { include: { mentions: true } } },
    });

    const domainMap = new Map<string, { domain: string; count: number; ownCited: boolean }>();
    for (const c of citations) {
      const d = c.domain.toLowerCase();
      const existing = domainMap.get(d) || { domain: d, count: 0, ownCited: false };
      existing.count++;
      if (c.brandMentioned) existing.ownCited = true;
      domainMap.set(d, existing);
    }

    const sortedDomains = Array.from(domainMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      totalCitations: citations.length,
      citationsByDomain: sortedDomains,
    };
  }

  async getRootCauseAnalysis(projectId: string) {
    const latestScan = await this.prisma.aiVisibilityScan.findFirst({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestScan) {
      return { rivalsWinning: [], missedPrompts: [] };
    }

    const responses = await this.prisma.aiVisibilityResponse.findMany({
      where: { scanRun: { scanId: latestScan.id } },
      include: { prompt: true, mentions: true, analysis: true },
    });

    const rivalWinCounts = new Map<string, number>();
    const missedPrompts: Array<{ prompt: string; category: string; winner: string }> = [];

    for (const r of responses) {
      const customerMentioned = r.mentions.some((m) => m.isCustomer && (m.recommended || m.shortlisted));
      const competitorMentioned = r.mentions.find((m) => !m.isCustomer && (m.recommended || m.shortlisted));

      if (!customerMentioned && competitorMentioned) {
        const rival = competitorMentioned.brandName;
        rivalWinCounts.set(rival, (rivalWinCounts.get(rival) || 0) + 1);
        if (missedPrompts.length < 15) {
          missedPrompts.push({
            prompt: r.prompt?.text || r.promptText,
            category: r.prompt?.category || 'General',
            winner: rival,
          });
        }
      }
    }

    const rivalsWinning = Array.from(rivalWinCounts.entries())
      .map(([brand, wins]) => ({ brand, wins }))
      .sort((a, b) => b.wins - a.wins);

    return {
      rivalsWinning,
      missedPrompts,
    };
  }

  async getAiActions(projectId: string) {
    const opportunities = await this.prisma.growthOpportunity.findMany({
      where: {
        projectId,
        OR: [
          { source: 'MARKET' },
          { category: 'COMPETITOR' },
        ],
      },
      orderBy: { priority: 'desc' },
      take: 20,
    });

    return opportunities;
  }
}
