import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderAbstractionService } from './ai-provider-abstraction.service';
import { AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { ResponseAnalyzerService } from './response-analyzer.service';
import { MetricsEngineService } from './metrics-engine.service';
import { questionAnalysis, questionSuggestions } from './question-analysis';

@Injectable()
export class AiVisibilityService {
  private readonly logger = new Logger(AiVisibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerAbstraction: AiProviderAbstractionService,
    private readonly analyzer: ResponseAnalyzerService,
    private readonly metrics: MetricsEngineService,
  ) {}

  getQuestionAnalysis(projectId: string) {
    return questionAnalysis(this.prisma, projectId);
  }

  getQuestionSuggestions(projectId: string) {
    return questionSuggestions(this.prisma, projectId);
  }

  async runScanForProject(projectId: string) {
    this.logger.log(`Starting AI Visibility scan for project ${projectId}`);
    
    // 1. Fetch active prompts
    const prompts = await this.prisma.aiVisibilityPrompt.findMany({
      where: { projectId, isActive: true },
    });
    
    if (prompts.length === 0) {
      this.logger.log(`No active prompts found for project ${projectId}`);
      throw new BadRequestException('Add at least one buyer question in the Questions tab before running AI Visibility.');
    }

    // 2. Fetch configured providers
    const settings = await this.prisma.aiVisibilitySettings.findUnique({
      where: { projectId },
    });
    
    let providersStr = settings?.enabledModels || [];
    if (providersStr.length === 0) {
      // Default to GEMINI if none configured
      providersStr = [AiProvider.GEMINI];
    }
    
    // Convert string array to valid AiProvider enums
    const providers = providersStr
      .filter((p): p is AiProvider => Object.values(AiProvider).includes(p as AiProvider));

    const configured = this.providerAbstraction.configuredProviders();
    const skippedAssistants = providers.filter(p => !configured.includes(p));
    const enabledProviders = providers.filter(p => configured.includes(p));
    if (enabledProviders.length === 0) {
      throw new ServiceUnavailableException('No selected AI assistant is configured. Enable Gemini or update this project\'s AI visibility settings.');
    }

    // 3. Create a scan record
    const scan = await this.prisma.aiVisibilityScan.create({
      data: {
        projectId,
        cycleId: new Date().toISOString(),
        status: 'RUNNING',
      },
    });

    let totalCost = 0;
    let completedCount = 0;

    try {
      // 4. Execute prompts against providers
      for (const provider of enabledProviders) {
        // Create scan run for this provider
        const scanRun = await this.prisma.aiVisibilityScanRun.create({
          data: {
            scanId: scan.id,
            provider,
            model: 'unknown',
            status: 'RUNNING',
          },
        });

        for (const prompt of prompts) {
          this.logger.debug(`Running prompt ${prompt.id} on ${provider}`);
          
          const result = await this.providerAbstraction.runPrompt(
            prompt.text,
            provider,
            undefined, // organizationId
            projectId
          );

          await this.prisma.aiVisibilityResponse.create({
            data: {
              scanRunId: scanRun.id,
              promptId: prompt.id,
              provider,
              model: result.model,
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
          if (!result.error) {
            completedCount++;
          }
        }
        
        await this.prisma.aiVisibilityScanRun.update({
          where: { id: scanRun.id },
          data: { status: 'COMPLETED' },
        });
      }

      // 5. Complete scan
      await this.prisma.aiVisibilityScan.update({
        where: { id: scan.id },
        data: {
          status: 'ANALYZING',
        },
      });
      
      // 6. Analyze Responses
      await this.analyzer.analyzePendingResponses(scan.id);
      
      // 7. Calculate Metrics
      await this.metrics.calculateScanMetrics(scan.id, projectId);

      // 8. Finish
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
        checksRun: responses.filter(r => !r.errorMessage && r.analysis).length,
        checksFailed: responses.filter(r => r.errorMessage || !r.analysis).length,
        citations: responses.filter(r => !r.errorMessage && r.analysis?.brandMentioned).length,
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
      throw new ServiceUnavailableException('AI Visibility could not finish. Please try again or check the AI provider configuration.');
    }
  }

  // Orchestrates scans, calculates metrics, handles cycles

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
        summary: { checked: 0, cited: 0, citationSharePct: 0, deltaPt: null, previousCitationSharePct: null, averagePosition: null, failedChecks: 0 },
        byAssistant: [] as any[],
        shareOfVoice: [] as any[],
        trend: [] as any[],
        measurableAssistants: this.providerAbstraction.configuredProviders(),
        brandPerception: { positive: 0, neutral: 0, negative: 0, total: 0 },
        customerJourney: {
          discovery: { checked: 0, cited: 0, citationSharePct: 0 },
          recommendation: { checked: 0, cited: 0, citationSharePct: 0 }
        }
      };
    }

    const responses = await this.prisma.aiVisibilityResponse.findMany({
      where: { scanRun: { scanId: latestMetrics.scanId } },
      include: { prompt: true, analysis: true },
    });

    let positive = 0; let neutral = 0; let negative = 0; let total = 0;
    let discChecked = 0; let discCited = 0; 
    let recChecked = 0; let recCited = 0;

    for (const r of responses) {
      if (r.analysis) {
        if (r.analysis.sentiment === 'POSITIVE') positive++;
        else if (r.analysis.sentiment === 'NEGATIVE') negative++;
        else neutral++;
        total++;
      }

      const p = r.prompt;
      if (p) {
        const isMentioned = r.analysis?.brandMentioned || false;
        if (p.journeyStage === 'DISCOVERY' || p.category?.toUpperCase() === 'DISCOVERY') {
           discChecked++;
           if (isMentioned) discCited++;
        } else if (p.journeyStage === 'RECOMMENDATION' || p.category?.toUpperCase() === 'RECOMMENDATION') {
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
      }
    };

    const shareOfVoiceRaw = Array.isArray(latestMetrics.shareOfVoice) ? latestMetrics.shareOfVoice : [];
    const shareOfVoice = shareOfVoiceRaw.map((s: any) => ({
      domain: s.domain,
      label: s.domain,
      sharePct: s.sharePct,
      mentions: s.mentions,
    }));

    const successful = responses.filter(r => !r.errorMessage && r.analysis);
    const checked = successful.length;
    const cited = successful.filter(r => r.analysis?.brandMentioned).length;
    const citationSharePct = checked > 0 ? (cited / checked) * 100 : 0;
    const byAssistant = latestMetrics.scan.runs.map((run: any) => {
      const measured = successful.filter(r => r.scanRunId === run.id);
      const mentioned = measured.filter(r => r.analysis?.brandMentioned).length;
      return {
        assistant: run.provider,
        checked: measured.length,
        cited: mentioned,
        citationSharePct: measured.length > 0 ? (mentioned / measured.length) * 100 : 0,
      };
    });

    const measurableAssistants = [...new Set([...this.providerAbstraction.configuredProviders(), ...latestMetrics.scan.runs.map((r: any) => r.provider)])];

    return {
      periodStart,
      periodEnd,
      summary: {
        checked,
        cited,
        citationSharePct,
        deltaPt: 0,
        previousCitationSharePct: null,
        averagePosition: latestMetrics.averagePosition || null,
        failedChecks: responses.length - checked,
      },
      byAssistant,
      shareOfVoice,
      trend: [{ weekStart: latestMetrics.createdAt.toISOString(), checked, citationSharePct }],
      measurableAssistants,
      brandPerception,
      customerJourney,
    };
  }
}
