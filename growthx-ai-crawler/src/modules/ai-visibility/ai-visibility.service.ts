import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderAbstractionService } from './ai-provider-abstraction.service';
import { AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { ResponseAnalyzerService } from './response-analyzer.service';
import { MetricsEngineService } from './metrics-engine.service';

@Injectable()
export class AiVisibilityService {
  private readonly logger = new Logger(AiVisibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerAbstraction: AiProviderAbstractionService,
    private readonly analyzer: ResponseAnalyzerService,
    private readonly metrics: MetricsEngineService,
  ) {}

  async runScanForProject(projectId: string) {
    this.logger.log(`Starting AI Visibility scan for project ${projectId}`);
    
    // 1. Fetch active prompts
    const prompts = await this.prisma.aiVisibilityPrompt.findMany({
      where: { projectId, isActive: true },
    });
    
    if (prompts.length === 0) {
      this.logger.log(`No active prompts found for project ${projectId}`);
      return;
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
      for (const provider of providers) {
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
    } catch (e: any) {
      this.logger.error(`Scan ${scan.id} failed`, e.stack);
      await this.prisma.aiVisibilityScan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          errorMessage: e.message,
        },
      });
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
        measurableAssistants: [],
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

    // For byAssistant, we would aggregate responses per provider, simplified for now:
    const byAssistant = latestMetrics.scan.runs.map((r: any) => ({
      assistant: r.provider,
      checked: 10, // Mocking
      cited: 5, // Mocking
      citationSharePct: latestMetrics.visibilityScore, // Mocking for now, ideally calc per provider
    }));

    const measurableAssistants = latestMetrics.scan.runs.map((r: any) => r.provider);

    return {
      periodStart,
      periodEnd,
      summary: {
        checked: latestMetrics.funnelMetrics ? (latestMetrics.funnelMetrics as any).totalAnalyzed : 0,
        cited: latestMetrics.funnelMetrics ? (latestMetrics.funnelMetrics as any).mentioned : 0,
        citationSharePct: latestMetrics.visibilityScore,
        deltaPt: 0,
        previousCitationSharePct: latestMetrics.visibilityScore,
        averagePosition: latestMetrics.averagePosition || null,
        failedChecks: 0,
      },
      byAssistant,
      shareOfVoice,
      trend: [{ weekStart: periodStart, checked: 10, citationSharePct: latestMetrics.visibilityScore }],
      measurableAssistants,
      brandPerception,
      customerJourney,
    };
  }
}
