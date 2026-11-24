import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OWN_SCOPE, claimScope } from '../crawler/website-scope';

export type SubscriptionTier = 'founder_free' | 'starter' | 'growth' | 'agency';

export interface PlanLimits {
  websites: number;
  crawlPages: number;
  aiCyclesMonthly: number;
  competitors: number;
  promptsQuota: number;
}

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  founder_free: { websites: 1, crawlPages: 5000, aiCyclesMonthly: 2, competitors: 5, promptsQuota: 10 },
  starter: { websites: 1, crawlPages: 5000, aiCyclesMonthly: 2, competitors: 5, promptsQuota: 10 },
  growth: { websites: 5, crawlPages: 25000, aiCyclesMonthly: 10, competitors: 15, promptsQuota: 25 },
  agency: { websites: 20, crawlPages: 100000, aiCyclesMonthly: 50, competitors: 50, promptsQuota: 100 },
};

@Injectable()
export class SubscriptionQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeTier(raw: unknown): SubscriptionTier {
    const normalized = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
    if (normalized === 'growth') return 'growth';
    if (normalized === 'agency') return 'agency';
    if (normalized === 'starter') return 'starter';
    return 'founder_free';
  }

  /**
   * Resolves the subscription tier exclusively from the server-owned
   * Organization record in PostgreSQL. Client-supplied headers such as
   * `x-subscription-tier` are never trusted.
   */
  async resolveTierForOrganization(organizationId: string | null | undefined): Promise<SubscriptionTier> {
    if (!organizationId || !this.prisma?.organization?.findUnique) {
      return 'founder_free';
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionTier: true },
    });
    return this.normalizeTier(org?.subscriptionTier);
  }

  /**
   * Resolves the subscription tier for a project from its owning
   * Organization record in PostgreSQL.
   */
  async resolveTierForProject(projectId: string | null | undefined): Promise<SubscriptionTier> {
    if (!projectId || !this.prisma?.project?.findUnique) {
      return 'founder_free';
    }
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organization: { select: { subscriptionTier: true } } },
    });
    return this.normalizeTier(project?.organization?.subscriptionTier);
  }

  getLimits(tier: SubscriptionTier): PlanLimits {
    return PLAN_LIMITS[tier] || PLAN_LIMITS.founder_free;
  }

  /**
   * Enforces website quota when registering a new own website, claiming a domain,
   * or creating a project. Counts both verified own sites and unverified claims
   * owned by the organization.
   */
  async assertWebsiteQuota(organizationId: string, tier: SubscriptionTier, checkingDomain?: string) {
    if (!organizationId) return;
    const limits = this.getLimits(tier);
    const orgScopes = [OWN_SCOPE, claimScope(organizationId)];

    // If checking a specific domain, see if it is already registered or claimed by this org
    if (checkingDomain) {
      const existing = await this.prisma.website.findFirst({
        where: {
          domain: checkingDomain,
          scope: { in: orgScopes },
          project: { organizationId },
        },
        select: { id: true },
      });
      if (existing) return; // Updating / re-registering existing site does not consume an additional quota slot
    }

    const currentCount = await this.prisma.website.count({
      where: {
        scope: { in: orgScopes },
        project: { organizationId },
      },
    });

    if (currentCount >= limits.websites) {
      throw new HttpException(
        {
          error: 'QUOTA_EXCEEDED',
          metric: 'websites',
          current: currentCount,
          limit: limits.websites,
          tier,
          message: `Website limit reached (${currentCount}/${limits.websites} sites on your plan). Upgrade your subscription to monitor more websites.`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  /**
   * Clamps the crawl page ceiling to what the organization's subscription tier allows.
   */
  clampCrawlPageLimit(requestedLimit: number | undefined, tier: SubscriptionTier): number {
    const limits = this.getLimits(tier);
    if (!requestedLimit || requestedLimit <= 0) {
      return limits.crawlPages;
    }
    return Math.min(requestedLimit, limits.crawlPages);
  }

  /**
   * Enforces competitor tracking quota for a project.
   */
  async assertCompetitorQuota(projectId: string, tier: SubscriptionTier) {
    const limits = this.getLimits(tier);
    const existing = await this.prisma.competitorDomain.count({ where: { projectId } });

    if (existing >= limits.competitors) {
      throw new HttpException(
        {
          error: 'QUOTA_EXCEEDED',
          metric: 'competitors',
          current: existing,
          limit: limits.competitors,
          tier,
          message: `Competitor tracking limit reached (${existing}/${limits.competitors} rivals on your plan). Upgrade your subscription to track more competitors.`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  /**
   * Enforces monthly AI Visibility audit cycles for a project.
   */
  async assertAiVisibilityQuota(projectId: string, tier: SubscriptionTier) {
    const limits = this.getLimits(tier);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const cyclesUsed = await this.prisma.aiVisibilityJourney.count({
      where: {
        projectId,
        createdAt: { gte: thirtyDaysAgo },
        status: { in: ['COMPLETED', 'RUNNING'] },
      },
    });

    if (cyclesUsed >= limits.aiCyclesMonthly) {
      throw new HttpException(
        {
          error: 'QUOTA_EXCEEDED',
          metric: 'aiCycles',
          current: cyclesUsed,
          limit: limits.aiCyclesMonthly,
          tier,
          message: `Monthly AI Visibility cycle limit reached (${cyclesUsed}/${limits.aiCyclesMonthly} cycles used this month). Upgrade your subscription for more monthly audit cycles.`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  /**
   * Enforces prompt quota when adding tracked prompts to a project.
   */
  async assertPromptQuota(projectId: string, tier: SubscriptionTier, additionalCount = 1) {
    const limits = this.getLimits(tier);
    const current = await this.prisma.aiVisibilityPrompt.count({
      where: { projectId, isActive: true },
    });

    if (current + additionalCount > limits.promptsQuota) {
      throw new HttpException(
        {
          error: 'QUOTA_EXCEEDED',
          metric: 'promptsQuota',
          current,
          requested: additionalCount,
          limit: limits.promptsQuota,
          tier,
          message: `Tracked prompt limit reached (${current}/${limits.promptsQuota} active prompts on your plan). Upgrade your subscription to track more buyer prompts.`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }
}

