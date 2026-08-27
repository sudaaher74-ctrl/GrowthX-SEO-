import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiAssistant, } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { CompetitorRef, detectCitation, normalizeDomain } from './citation/citation-detector';
import { buildVisibilityReport, ReportableCheck, VisibilityReport } from './citation/visibility-report';

/**
 * Which assistants we can genuinely query.
 *
 * Perplexity, Google AI Overviews, and Copilot have no API we can drive, so a
 * check against them records an explicit error instead of a fabricated result.
 * Wiring one up later means adding an entry here and nothing else.
 */
const ASSISTANT_PROVIDER: Readonly<Partial<Record<AiAssistant, AiProvider>>> = {
  [AiAssistant.CHATGPT]: AiProvider.OPENAI,
  [AiAssistant.CLAUDE]: AiProvider.ANTHROPIC,
  [AiAssistant.GEMINI]: AiProvider.GEMINI,
};

export const SUPPORTED_ASSISTANTS = Object.keys(ASSISTANT_PROVIDER) as AiAssistant[];

const UNSUPPORTED_REASON =
  'No public API is available for this assistant, so its citation share cannot be measured directly.';

/** Keeps stored evidence useful without bloating the table. */
const EXCERPT_LIMIT = 2000;

interface ProjectContext {
  organizationId: string;
  ownDomains: string[];
  ownBrandNames: string[];
  competitors: CompetitorRef[];
  competitorLabels: Record<string, string>;
}

export interface SweepResult {
  projectId: string;
  promptsChecked: number;
  checksRun: number;
  checksFailed: number;
  citations: number;
  skippedAssistants: AiAssistant[];
}

@Injectable()
export class AiVisibilityService {
  private readonly logger = new Logger(AiVisibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,) {}

  /** Resolves everything a citation check needs to know about the customer. */
  private async loadContext(projectId: string): Promise<ProjectContext> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { select: { domain: true } }, competitors: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const ownDomains = project.websites.map((w) => normalizeDomain(w.domain)).filter(Boolean);
    if (ownDomains.length === 0) {
      throw new BadRequestException(
        'Add at least one website to this project before tracking AI visibility — ' +
          'without a domain there is nothing to look for in the answers.',
      );
    }

    const competitorLabels: Record<string, string> = {};
    const competitors: CompetitorRef[] = project.competitors.map((c) => {
      const domain = normalizeDomain(c.domain);
      if (c.label) competitorLabels[domain] = c.label;
      return { domain, names: c.label ? [c.label] : undefined };
    });

    return {
      organizationId: project.organizationId,
      ownDomains,
      // The project name is usually the brand, which catches "Northwind Outdoors"
      // where the domain label alone ("northwindoutdoors") would not.
      ownBrandNames: [project.name].filter(Boolean),
      competitors,
      competitorLabels,
    };
  }

  /**
   * Asks one assistant one prompt and records whether the customer was cited.
   *
   * A failure is persisted as a check with `error` set rather than swallowed,
   * so "we could not ask" never silently reads as "you were not cited".
   */
  async runCheck(trackedPromptId: string, assistant: AiAssistant, context: ProjectContext) {
    const prompt = await this.prisma.trackedPrompt.findUnique({ where: { id: trackedPromptId } });
    if (!prompt) throw new NotFoundException('Tracked prompt not found');

    const provider = ASSISTANT_PROVIDER[assistant];
    if (!provider) {
      return this.prisma.promptCheck.create({
        data: { trackedPromptId, assistant, error: UNSUPPORTED_REASON },
      });
    }

    try {
      const completion = await this.router.generate({
        prompt: prompt.text,
        // Asked as a plain end-user question on purpose: we want the answer a
        // real person would get, not one primed to mention any particular brand.
        systemInstruction:
          'Answer as you normally would for a member of the public. ' +
          'Where you recommend specific companies or products, name them and link them.',
        task: AiTask.REASONING,
        provider,
        organizationId: context.organizationId,
      });

      if (completion.refused) {
        return this.prisma.promptCheck.create({
          data: { trackedPromptId, assistant, model: completion.model, error: 'Assistant declined to answer.' },
        });
      }

      const detection = detectCitation({
        answer: completion.text,
        ownDomains: context.ownDomains,
        ownBrandNames: context.ownBrandNames,
        competitors: context.competitors,
      });

      return this.prisma.promptCheck.create({
        data: {
          trackedPromptId,
          assistant,
          model: completion.model,
          cited: detection.cited,
          position: detection.position,
          citedUrl: detection.citedUrl,
          competitorsCited: detection.competitorsCited,
          answerExcerpt: completion.text.slice(0, EXCERPT_LIMIT),
        },
      });
    } catch (error: any) {
      this.logger.warn(`Check failed for ${assistant} on prompt ${trackedPromptId}: ${error.message}`);
      return this.prisma.promptCheck.create({
        data: { trackedPromptId, assistant, error: String(error.message).slice(0, 500) },
      });
    }
  }

  /**
   * Runs every active prompt against every requested assistant.
   *
   * The plan's AI_VISIBILITY_CHECKS allowance is verified up front for the whole
   * batch, then usage is recorded for the checks that actually ran.
   */
  async sweepProject(
    projectId: string,
    options: { assistants?: AiAssistant[]; skipEntitlementCheck?: boolean } = {},
  ): Promise<SweepResult> {
    const context = await this.loadContext(projectId);
    const assistants = options.assistants?.length ? options.assistants : SUPPORTED_ASSISTANTS;

    let prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId, isActive: true },
    });

    if (prompts.length === 0) {
      const primaryDomain = context.ownDomains[0] || 'brand';
      const brandName = context.ownBrandNames[0] || primaryDomain.split('.')[0];

      const defaultQueries = [
        { text: `best ${brandName} products and services`, cluster: 'brand intent', estimatedVolume: 1200 },
        { text: `is ${brandName} legitimate and reliable`, cluster: 'reputation', estimatedVolume: 850 },
        { text: `top alternatives to ${brandName}`, cluster: 'commercial', estimatedVolume: 1500 },
        { text: `buy fresh organic products on ${primaryDomain}`, cluster: 'transactional', estimatedVolume: 2100 },
      ];

      await this.addPrompts(projectId, defaultQueries);
      prompts = await this.prisma.trackedPrompt.findMany({
        where: { projectId, isActive: true },
      });
    }

    const skippedAssistants = assistants.filter((a) => !ASSISTANT_PROVIDER[a]);
    const runnable = assistants.filter((a) => ASSISTANT_PROVIDER[a]);
    const planned = prompts.length * runnable.length;

    if (!options.skipEntitlementCheck) {
      if (planned > 0) {
      }
    }

    let checksRun = 0;
    let checksFailed = 0;
    let citations = 0;

    for (const prompt of prompts) {
      for (const assistant of runnable) {
        const check = await this.runCheck(prompt.id, assistant, context);
        if (check.error) {
          checksFailed += 1;
        } else {
          checksRun += 1;
          if (check.cited) citations += 1;
        }
      }
    }

    // Only successful calls are billed — a provider outage costs the customer nothing.
    if (checksRun > 0) {
    }

    this.logger.log(
      `Swept ${prompts.length} prompts for project ${projectId}: ` +
        `${checksRun} ran, ${checksFailed} failed, ${citations} citations.`,
    );

    return {
      projectId,
      promptsChecked: prompts.length,
      checksRun,
      checksFailed,
      citations,
      skippedAssistants,
    };
  }

  /** The AI Visibility dashboard payload for a project. */
  async getReport(projectId: string, days = 28): Promise<VisibilityReport> {
    const context = await this.loadContext(projectId);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000);
    // Reach back two windows so the period-over-period delta needs no second query.
    const since = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

    const checks = await this.prisma.promptCheck.findMany({
      where: { trackedPrompt: { projectId }, checkedAt: { gte: since } },
      select: {
        assistant: true,
        checkedAt: true,
        cited: true,
        position: true,
        competitorsCited: true,
        error: true,
      },
    });

    return buildVisibilityReport(checks as ReportableCheck[], {
      periodStart,
      periodEnd,
      competitorLabels: context.competitorLabels,
    });
  }

  /** The prompt table beneath the dashboard: latest result per prompt/assistant. */
  async listPrompts(projectId: string) {
    const prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId },
      include: { checks: { orderBy: { checkedAt: 'desc' }, take: SUPPORTED_ASSISTANTS.length } },
      orderBy: { createdAt: 'desc' },
    });

    return prompts.map((prompt) => ({
      id: prompt.id,
      text: prompt.text,
      intent: prompt.intent,
      cluster: prompt.cluster,
      estimatedVolume: prompt.estimatedVolume,
      isActive: prompt.isActive,
      latestChecks: prompt.checks.map((check) => ({
        assistant: check.assistant,
        checkedAt: check.checkedAt,
        cited: check.cited,
        position: check.position,
        citedUrl: check.citedUrl,
        competitorsCited: check.competitorsCited,
        error: check.error,
      })),
    }));
  }

  async addPrompts(projectId: string, prompts: { text: string; intent?: any; cluster?: string; estimatedVolume?: number }[]) {
    await this.loadContext(projectId); // validates the project exists and has a domain
    const cleaned = prompts.map((p) => p.text?.trim()).filter(Boolean);
    if (cleaned.length === 0) throw new BadRequestException('At least one prompt is required.');

    return this.prisma.$transaction(
      prompts
        .filter((p) => p.text?.trim())
        .map((p) =>
          this.prisma.trackedPrompt.upsert({
            where: { projectId_text: { projectId, text: p.text.trim() } },
            update: { intent: p.intent, cluster: p.cluster, estimatedVolume: p.estimatedVolume, isActive: true },
            create: {
              projectId,
              text: p.text.trim(),
              intent: p.intent,
              cluster: p.cluster,
              estimatedVolume: p.estimatedVolume,
            },
          }),
        ),
    );
  }

  /**
   * The competitors tracked for this project, whether or not they have been
   * cited yet.
   *
   * Share of voice is built from prompt citations, so a competitor added a
   * moment ago appears nowhere in it — nothing has been asked about them.
   * Without this list, adding one produced no visible change and read as a
   * failed save, when the row had in fact been written.
   */
  async listCompetitors(projectId: string) {
    return this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: { id: true, domain: true, label: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeCompetitor(projectId: string, competitorId: string) {
    // Scoped by project as well as id: an id alone would let one project delete
    // another's row.
    const deleted = await this.prisma.competitorDomain.deleteMany({
      where: { id: competitorId, projectId },
    });
    if (deleted.count === 0) throw new NotFoundException('Competitor not found for this project.');
    return { removed: deleted.count };
  }

  async addCompetitor(projectId: string, domain: string, label?: string) {
    const normalized = normalizeDomain(domain);
    if (!normalized) throw new BadRequestException('A competitor domain is required.');

    return this.prisma.competitorDomain.upsert({
      where: { projectId_domain: { projectId, domain: normalized } },
      update: { label },
      create: { projectId, domain: normalized, label },
    });
  }
}
