import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { FixType, PageContext, planFix, renderFromModel } from './fix-generator';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

export interface GeneratedFixPatch {
  fixType: FixType;
  targetUrl: string;
  originalValue?: string | null;
  proposedValue: string;
  codeSnippet: string;
  /** Whether a model wrote this or the deterministic fallback did. */
  source: 'model' | 'heuristic';
  model?: string;
}

@Injectable()
export class AutoFixService {
  private readonly logger = new Logger(AutoFixService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /**
   * Proposes a concrete patch for an issue, written from the customer's own
   * page content. Nothing is applied here — Module 16 requires approval first.
   *
   * If no model is reachable, a deterministic fallback derived from the page is
   * used instead. Both paths are grounded in the customer's page: a patch must
   * never carry our product name, an invented price, or a made-up claim.
   */
  async generateFixPatch(
    issueId: string,
    organizationId?: string,
    options?: { forceRefresh?: boolean },
  ): Promise<GeneratedFixPatch> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { page: true, aiRecommendation: true },
    });

    if (!issue || !issue.page) {
      throw new NotFoundException(`Issue or associated page not found for ID ${issueId}`);
    }

    const page: PageContext = {
      url: issue.affectedUrl,
      title: issue.page.title,
      metaDescription: issue.page.metaDescription,
      canonicalUrl: issue.page.canonicalUrl,
      h1: issue.page.h1,
      h2: issue.page.h2,
      wordCount: issue.page.wordCount,
    };

    const plan = planFix(issue.issueType, page, issue.recommendation);

    const cacheEnabled = !options?.forceRefresh && process.env.AI_CONTENT_HASH_CACHE !== 'false';
    if (cacheEnabled && plan.prompt) {
      // 1. Reuse existing model-generated patch already saved on this issue.
      const existingPatch = this.parseReusablePatch(
        issue.aiRecommendation?.recommendedFixPatch,
        plan.fixType,
        plan.originalValue,
      );
      if (existingPatch) return existingPatch;

      // 2. Tenant/project-scoped content-hash reuse across re-crawls of unchanged pages.
      const contentHash = issue.page.contentHash;
      if (issue.projectId && contentHash && this.prisma.aIRecommendation?.findFirst) {
        const prior = await this.prisma.aIRecommendation
          .findFirst({
            where: {
              issueId: { not: issue.id },
              generatedByModel: { not: null },
              NOT: { generatedByModel: 'rules-engine' },
              issue: {
                projectId: issue.projectId,
                issueType: issue.issueType,
                affectedUrl: issue.affectedUrl,
                page: { contentHash },
              },
            },
            orderBy: { updatedAt: 'desc' },
          })
          .catch(() => null);

        const reusedPatch = this.parseReusablePatch(
          prior?.recommendedFixPatch,
          plan.fixType,
          plan.originalValue,
        );
        if (reusedPatch) {
          await this.prisma.aIRecommendation.upsert({
            where: { issueId: issue.id },
            update: { recommendedFixPatch: JSON.stringify(reusedPatch, null, 2), status: 'PENDING_APPROVAL' },
            create: {
              issueId: issue.id,
              whyItMatters: issue.aiRecommendation?.whyItMatters || prior?.whyItMatters || 'Improves technical SEO health.',
              seoImpact: issue.aiRecommendation?.seoImpact || prior?.seoImpact || 'Positive ranking signal.',
              businessImpact: issue.aiRecommendation?.businessImpact || prior?.businessImpact || 'Higher traffic retention.',
              priorityScore: issue.aiRecommendation?.priorityScore || prior?.priorityScore || 75,
              recommendedFixPatch: JSON.stringify(reusedPatch, null, 2),
              expectedOutcome: issue.aiRecommendation?.expectedOutcome || prior?.expectedOutcome || 'Resolved audit issue.',
              generatedByModel: reusedPatch.model ?? prior?.generatedByModel ?? 'cached',
              status: 'PENDING_APPROVAL',
            },
          });
          this.logger.debug(
            `Reused tenant-scoped content-hash auto-fix patch for ${issue.issueType} on ${issue.affectedUrl} (0 LLM tokens).`,
          );
          return reusedPatch;
        }
      }
    }

    this.logger.log(`Generating ${plan.fixType} patch for ${issue.affectedUrl}...`);

    let rendered: { proposedValue: string; codeSnippet: string } | null = null;
    let source: 'model' | 'heuristic' = 'heuristic';
    let model: string | undefined;

    // Some fixes (canonical URLs, breadcrumbs) are derived, not written — an
    // empty prompt marks those and skips the model entirely.
    if (plan.prompt) {
      try {
        const completion = await this.router.generate({
          prompt: plan.prompt,
          systemInstruction:
            'You are a technical SEO editor writing production copy for a client site. ' +
            'Respond only with JSON matching the schema.',
          task: AiTask.REASONING,
          organizationId,
          projectId: issue.projectId ?? undefined,
          jsonSchema: plan.schema,
          cacheable: true,
        });

        if (!completion.refused && completion.text.trim()) {
          rendered = renderFromModel(plan, this.parseJson(completion.text), page);
          if (rendered) {
            source = 'model';
            model = completion.model;
          }
        }
      } catch (error: any) {
        this.logger.warn(`Model unavailable for ${plan.fixType} (${error.message}); using the derived fallback.`);
      }
    }

    if (!rendered) rendered = plan.heuristic();

    const patch: GeneratedFixPatch = {
      fixType: plan.fixType,
      targetUrl: issue.affectedUrl,
      originalValue: plan.originalValue,
      proposedValue: rendered.proposedValue,
      codeSnippet: rendered.codeSnippet,
      source,
      model,
    };

    await this.prisma.aIRecommendation.upsert({
      where: { issueId: issue.id },
      update: { recommendedFixPatch: JSON.stringify(patch, null, 2), status: 'PENDING_APPROVAL' },
      create: {
        issueId: issue.id,
        whyItMatters: issue.aiRecommendation?.whyItMatters || 'Improves technical SEO health.',
        seoImpact: issue.aiRecommendation?.seoImpact || 'Positive ranking signal.',
        businessImpact: issue.aiRecommendation?.businessImpact || 'Higher traffic retention.',
        priorityScore: issue.aiRecommendation?.priorityScore || 75,
        recommendedFixPatch: JSON.stringify(patch, null, 2),
        expectedOutcome: issue.aiRecommendation?.expectedOutcome || 'Resolved audit issue.',
        generatedByModel: model ?? 'rules-engine',
        status: 'PENDING_APPROVAL',
      },
    });

    return patch;
  }

  private parseReusablePatch(
    raw: string | null | undefined,
    expectedFixType: FixType,
    expectedOriginalValue: string | null | undefined,
  ): GeneratedFixPatch | null {
    if (!raw || !raw.trimStart().startsWith('{')) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<GeneratedFixPatch>;
      if (
        parsed.source === 'model' &&
        parsed.fixType === expectedFixType &&
        (parsed.originalValue ?? null) === (expectedOriginalValue ?? null) &&
        typeof parsed.proposedValue === 'string' &&
        parsed.proposedValue.trim() &&
        typeof parsed.codeSnippet === 'string' &&
        parsed.codeSnippet.trim() &&
        typeof parsed.targetUrl === 'string'
      ) {
        return parsed as GeneratedFixPatch;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Tolerates a model that wraps JSON in prose or a code fence. */
  /** Reads the model's JSON answer, repairing truncation or naming the failure. */
  private parseJson(text: string): Record<string, any> {
    return parseModelJson(text, 'Auto fix');
  }

  /**
   * User approves the AI recommendation.
   * Module 16: Every change requires user approval before execution.
   */
  async approveAndExecuteFix(issueId: string, approvedByUserId: string): Promise<{ success: boolean; message: string; patch: any }> {
    const rec = await this.prisma.aIRecommendation.findUnique({
      where: { issueId },
      include: { issue: true },
    });

    if (!rec) {
      throw new NotFoundException(`No AI recommendation found for issue ID ${issueId}`);
    }

    if (rec.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Recommendation is currently in status ${rec.status} and cannot be re-approved.`);
    }

    this.logger.log(`User ${approvedByUserId} APPROVED fix for issue ${issueId}. Executing automated workflow...`);

    // In a live integration, this would trigger an API call to CMS/GitHub PR or database update.
    // We record state change to 'APPROVED' and then 'APPLIED'.
    await this.prisma.aIRecommendation.update({
      where: { issueId },
      data: {
        status: 'APPLIED',
        approvedBy: approvedByUserId,
        appliedAt: new Date(),
      },
    });

    await this.prisma.issue.update({
      where: { id: issueId },
      data: { status: 'RESOLVED' },
    });

    let parsedPatch = {};
    try {
      parsedPatch = JSON.parse(rec.recommendedFixPatch);
    } catch {
      parsedPatch = { text: rec.recommendedFixPatch };
    }

    return {
      success: true,
      message: `Successfully approved and applied AI fix patch for issue on ${rec.issue.affectedUrl}. Issue marked RESOLVED.`,
      patch: parsedPatch,
    };
  }

  async rejectFix(issueId: string, rejectedByUserId: string): Promise<{ success: boolean; message: string }> {
    await this.prisma.aIRecommendation.update({
      where: { issueId },
      data: {
        status: 'REJECTED',
        approvedBy: rejectedByUserId,
      },
    });

    await this.prisma.issue.update({
      where: { id: issueId },
      data: { status: 'IGNORED' },
    });

    return { success: true, message: `Recommendation for issue ${issueId} rejected and marked IGNORED.` };
  }
}
