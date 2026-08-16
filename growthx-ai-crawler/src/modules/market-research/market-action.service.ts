import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ContentPieceKind,
  ContentPieceStatus,
  MarketAction,
  MarketActionStatus,
  MarketActionType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OutcomeMeasurementService } from './outcome-measurement.service';

/**
 * The approval half of the closed loop.
 *
 * Research proposes; a person decides; only then does work exist anywhere else
 * in GrowthX. Conversion is deliberately a separate step from approval so that
 * "yes, this is a good idea" and "create the work item" are distinct events in
 * the audit trail.
 */
@Injectable()
export class MarketActionService {
  private readonly logger = new Logger(MarketActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outcomes: OutcomeMeasurementService,
  ) {}

  /** The queue: proposed actions for this project, newest first. */
  async list(organizationId: string, projectId: string, status?: MarketActionStatus) {
    return this.prisma.marketAction.findMany({
      where: { organizationId, projectId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        run: { select: { id: true, question: true, sources: { orderBy: { sourceKey: 'asc' } } } },
        opportunity: true,
      },
    });
  }

  /** Opportunities (citation gaps) surfaced for this project. */
  async listOpportunities(organizationId: string, projectId: string) {
    return this.prisma.marketOpportunity.findMany({
      where: { organizationId, projectId },
      orderBy: [{ impact: 'asc' }, { createdAt: 'desc' }],
      include: { run: { select: { id: true, question: true } } },
    });
  }

  private async load(organizationId: string, projectId: string, actionId: string): Promise<MarketAction> {
    const action = await this.prisma.marketAction.findFirst({
      where: { id: actionId, organizationId, projectId },
    });
    if (!action) throw new NotFoundException('Action not found for this project.');
    return action;
  }

  async approve(organizationId: string, projectId: string, actionId: string, userId: string) {
    const action = await this.load(organizationId, projectId, actionId);
    if (action.status !== MarketActionStatus.PROPOSED) {
      throw new BadRequestException(`Only a PROPOSED action can be approved; this one is ${action.status}.`);
    }

    return this.prisma.marketAction.update({
      where: { id: actionId },
      data: { status: MarketActionStatus.APPROVED, approvedByUserId: userId, approvedAt: new Date() },
    });
  }

  async reject(organizationId: string, projectId: string, actionId: string) {
    const action = await this.load(organizationId, projectId, actionId);
    if (action.status === MarketActionStatus.CONVERTED) {
      throw new BadRequestException('This action has already been converted into work.');
    }

    return this.prisma.marketAction.update({
      where: { id: actionId },
      data: { status: MarketActionStatus.REJECTED },
    });
  }

  /**
   * Creates the real GrowthX record for an approved action.
   *
   * Approval is a precondition, not an implication: an action that was never
   * approved cannot be converted, which is what stops research output reaching
   * a customer's site without a person having agreed to it.
   */
  async convert(organizationId: string, projectId: string, actionId: string) {
    const action = await this.load(organizationId, projectId, actionId);

    if (action.status === MarketActionStatus.CONVERTED) {
      throw new BadRequestException('This action has already been converted.');
    }
    if (action.status !== MarketActionStatus.APPROVED) {
      throw new BadRequestException('Approve this action before converting it into work.');
    }

    const convertedToId = await this.createWorkItem(projectId, action);

    const updated = await this.prisma.marketAction.update({
      where: { id: actionId },
      data: { status: MarketActionStatus.CONVERTED, convertedToId },
    });

    // Baseline is captured here, at the moment real work exists. Measuring
    // later against a baseline taken at approval would attribute movement to a
    // period when nothing had actually shipped.
    await this.outcomes.captureBaseline(organizationId, projectId, actionId);

    this.logger.log(`Action ${actionId} (${action.type}) converted into ${convertedToId} for project ${projectId}.`);
    return updated;
  }

  /**
   * Routes each action type to the workflow that already owns it.
   *
   * Nothing here publishes. A content brief becomes a DRAFTED piece behind the
   * content agent's existing review gate; a tracked prompt starts being
   * measured; a competitor joins the watchlist.
   */
  private async createWorkItem(projectId: string, action: MarketAction): Promise<string> {
    switch (action.type) {
      case MarketActionType.CONTENT_BRIEF:
      case MarketActionType.PAGE_REFRESH: {
        const kind =
          action.type === MarketActionType.CONTENT_BRIEF
            ? ContentPieceKind.BRIEF
            : ContentPieceKind.LANDING_PAGE_OUTLINE;
        const piece = await this.prisma.contentPiece.create({
          data: {
            projectId,
            kind,
            // PLANNED, not DRAFTED: the agent still has to write it, and that
            // draft then goes through its own review before anything ships.
            status: ContentPieceStatus.PLANNED,
            title: action.title,
            slug: await this.uniqueSlug(projectId, action.title),
            format: kind,
            rationale: action.description,
          },
        });
        return piece.id;
      }

      case MarketActionType.TRACK_PROMPT: {
        const text = action.title.slice(0, 300);
        const existing = await this.prisma.trackedPrompt.findFirst({ where: { projectId, text } });
        if (existing) return existing.id;
        const prompt = await this.prisma.trackedPrompt.create({
          data: { projectId, text, isActive: true },
        });
        return prompt.id;
      }

      case MarketActionType.COMPETITOR_WATCH: {
        const domain = extractDomain(action.title) ?? extractDomain(action.description);
        if (!domain) {
          throw new BadRequestException(
            'No competitor domain could be read from this action. Edit it to name the domain, then convert.',
          );
        }
        const competitor = await this.prisma.competitorDomain.upsert({
          where: { projectId_domain: { projectId, domain } },
          create: { projectId, domain, label: action.title.slice(0, 120) },
          update: {},
        });
        await this.prisma.marketWatch.upsert({
          where: { projectId_kind_value: { projectId, kind: 'COMPETITOR', value: domain } },
          create: { organizationId: action.organizationId, projectId, kind: 'COMPETITOR', value: domain },
          update: { isActive: true },
        });
        return competitor.id;
      }

      case MarketActionType.OUTREACH_OPPORTUNITY: {
        const campaign = await this.prisma.outreachCampaign.create({
          data: { projectId, name: action.title.slice(0, 200), status: 'ACTIVE' },
        });
        return campaign.id;
      }

      case MarketActionType.TECHNICAL_TASK: {
        // Issues belong to a crawl job, so a technical task is recorded as a
        // topic watch until the SEO auditor moves onto the evidence spine and
        // can own agent-raised issues directly.
        const watch = await this.prisma.marketWatch.upsert({
          where: { projectId_kind_value: { projectId, kind: 'TOPIC', value: action.title.slice(0, 200) } },
          create: {
            organizationId: action.organizationId,
            projectId,
            kind: 'TOPIC',
            value: action.title.slice(0, 200),
          },
          update: { isActive: true },
        });
        return watch.id;
      }

      default:
        throw new BadRequestException(`No conversion is defined for action type ${action.type}.`);
    }
  }

  private async uniqueSlug(projectId: string, title: string): Promise<string> {
    const base =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'action';

    for (let attempt = 0; attempt < 25; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const existing = await this.prisma.contentPiece.findUnique({
        where: { projectId_slug: { projectId, slug } },
        select: { id: true },
      });
      if (!existing) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}

/** Pulls a bare domain out of free text, ignoring protocol and path. */
export function extractDomain(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i);
  return match ? match[1].toLowerCase().replace(/^www\./, '') : null;
}
