import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PlanType, Subscription, SubscriptionStatus, UsageMetric } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  Feature,
  PlanDefinition,
  cheapestPlanWith,
  formatInr,
  getPlan,
  planHasFeature,
  quotaFor,
} from './plans.catalog';

export interface QuotaStatus {
  metric: UsageMetric;
  /** `null` means unlimited on this plan. */
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface ResolvedEntitlements {
  organizationId: string;
  plan: PlanType;
  planName: string;
  status: SubscriptionStatus;
  /** False when the org has fallen back to FREE because billing lapsed. */
  subscriptionActive: boolean;
  features: Feature[];
  maxSites: number | null;
  maxSeats: number | null;
  periodStart: Date;
  periodEnd: Date;
  quotas: QuotaStatus[];
}

/** Statuses under which we keep serving the paid plan. */
const SERVING_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.AUTHENTICATED,
]);

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Whether the billing bypass is on.
   *
   * Refuses in production regardless of the flag: an env var set by accident on
   * the live service would hand every feature to every customer, which is
   * exactly the failure this replaced.
   */
  private devBypassEnabled(): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    return process.env.BILLING_DEV_BYPASS === 'true';
  }

  /**
   * Resolves the plan an organization is actually entitled to right now.
   *
   * A subscription that has lapsed (halted, expired, or a failed charge) drops
   * the org to FREE rather than leaving paid features open, but a subscription
   * cancelled mid-cycle keeps working until the period the customer paid for
   * has actually elapsed.
   */
  async resolvePlan(organizationId: string): Promise<{ plan: PlanType; subscription: Subscription | null; active: boolean }> {
    const subscription = await this.prisma.subscription.findUnique({ where: { organizationId } });

    // A hardcoded `devBypass = true` used to sit here and return ENTERPRISE for
    // every organization, subscribed or not. It made every plan gate in the
    // product a no-op — including the ones added since — so nobody was ever
    // billed for anything and the entitlement tests failed for a year.
    //
    // The escape hatch is now opt-in, refuses to work in production, and is off
    // unless someone deliberately sets it.
    if (this.devBypassEnabled()) {
      this.logger.warn(
        `BILLING_DEV_BYPASS is on: granting ENTERPRISE to ${organizationId} regardless of subscription.`,
      );
      return { plan: PlanType.ENTERPRISE, subscription, active: true };
    }

    if (!subscription) {
      return { plan: PlanType.FREE, subscription: null, active: false };
    }

    if (SERVING_STATUSES.has(subscription.status)) {
      return { plan: subscription.plan, subscription, active: true };
    }

    const paidThrough = subscription.currentPeriodEnd;
    const inPaidGrace =
      subscription.status === SubscriptionStatus.CANCELLED && paidThrough !== null && paidThrough > new Date();

    if (inPaidGrace) {
      return { plan: subscription.plan, subscription, active: true };
    }

    return { plan: PlanType.FREE, subscription, active: false };
  }

  /**
   * The window usage is counted against. Follows the Razorpay billing cycle when
   * one exists so a customer who subscribes on the 20th is not reset on the 1st.
   */
  billingPeriod(subscription: Subscription | null, now = new Date()): { periodStart: Date; periodEnd: Date } {
    const { currentPeriodStart, currentPeriodEnd } = subscription ?? {};
    if (currentPeriodStart && currentPeriodEnd && currentPeriodStart <= now && now < currentPeriodEnd) {
      return { periodStart: currentPeriodStart, periodEnd: currentPeriodEnd };
    }
    return {
      periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
  }

  async getEntitlements(organizationId: string): Promise<ResolvedEntitlements> {
    const { plan, subscription, active } = await this.resolvePlan(organizationId);
    const definition = getPlan(plan);
    const { periodStart, periodEnd } = this.billingPeriod(subscription);

    const records = await this.prisma.usageRecord.findMany({
      where: { organizationId, periodStart },
    });
    const usedByMetric = new Map(records.map((r) => [r.metric, r.used]));

    const quotas: QuotaStatus[] = Object.values(UsageMetric).map((metric) => {
      const limit = quotaFor(plan, metric);
      const used = usedByMetric.get(metric) ?? 0;
      return { metric, limit, used, remaining: limit === null ? null : Math.max(0, limit - used) };
    });

    return {
      organizationId,
      plan,
      planName: definition.name,
      status: subscription?.status ?? SubscriptionStatus.EXPIRED,
      subscriptionActive: active,
      features: [...definition.features],
      maxSites: definition.maxSites,
      maxSeats: definition.maxSeats,
      periodStart,
      periodEnd,
      quotas,
    };
  }

  async hasFeature(organizationId: string, feature: Feature): Promise<boolean> {
    const { plan } = await this.resolvePlan(organizationId);
    return planHasFeature(plan, feature);
  }

  /** Throws a 403 carrying the cheapest plan that would unlock `feature`. */
  async assertFeature(organizationId: string, feature: Feature): Promise<void> {
    const { plan } = await this.resolvePlan(organizationId);
    if (planHasFeature(plan, feature)) return;

    throw new ForbiddenException(this.upgradePayload(plan, feature));
  }

  async checkQuota(organizationId: string, metric: UsageMetric, amount = 1): Promise<QuotaStatus & { allowed: boolean }> {
    const { plan, subscription } = await this.resolvePlan(organizationId);
    const limit = quotaFor(plan, metric);
    const { periodStart } = this.billingPeriod(subscription);

    if (limit === null) {
      return { metric, limit: null, used: 0, remaining: null, allowed: true };
    }

    const record = await this.prisma.usageRecord.findUnique({
      where: { organizationId_metric_periodStart: { organizationId, metric, periodStart } },
    });
    const used = record?.used ?? 0;

    return {
      metric,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      allowed: used + amount <= limit,
    };
  }

  /** Throws a 403 describing the exhausted allowance. */
  async assertQuota(organizationId: string, metric: UsageMetric, amount = 1): Promise<void> {
    const status = await this.checkQuota(organizationId, metric, amount);
    if (status.allowed) return;

    const { plan } = await this.resolvePlan(organizationId);
    const definition = getPlan(plan);
    const upgrade = this.nextPlanUp(plan);

    throw new ForbiddenException({
      error: 'QUOTA_EXCEEDED',
      metric,
      message: `Your ${definition.name} plan allows ${status.limit} ${this.metricLabel(metric)} per billing period and ${status.used} have been used.`,
      currentPlan: plan,
      limit: status.limit,
      used: status.used,
      upgradeTo: upgrade
        ? { plan: upgrade.plan, name: upgrade.name, price: formatInr(upgrade.amountPaise), limit: quotaFor(upgrade.plan, metric) }
        : null,
    });
  }

  /**
   * Records consumption *after* the work succeeded. Callers must not pre-charge:
   * a failed crawl or a failed LLM call should never cost the customer.
   */
  async recordUsage(organizationId: string, metric: UsageMetric, amount = 1): Promise<void> {
    if (amount <= 0) return;

    const { subscription } = await this.resolvePlan(organizationId);
    const { periodStart, periodEnd } = this.billingPeriod(subscription);

    await this.prisma.usageRecord.upsert({
      where: { organizationId_metric_periodStart: { organizationId, metric, periodStart } },
      update: { used: { increment: amount } },
      create: { organizationId, metric, periodStart, periodEnd, used: amount },
    });
  }

  /** Enforces the per-plan website cap before a new site is registered. */
  async assertCanAddSite(organizationId: string): Promise<void> {
    const { plan } = await this.resolvePlan(organizationId);
    const definition = getPlan(plan);
    if (definition.maxSites === null) return;

    const current = await this.prisma.website.count({
      where: { project: { organizationId } },
    });

    if (current < definition.maxSites) return;

    const upgrade = this.nextPlanUp(plan);
    throw new ForbiddenException({
      error: 'SITE_LIMIT_REACHED',
      message: `The ${definition.name} plan covers ${definition.maxSites} website${definition.maxSites === 1 ? '' : 's'}.`,
      currentPlan: plan,
      limit: definition.maxSites,
      used: current,
      upgradeTo: upgrade ? { plan: upgrade.plan, name: upgrade.name, price: formatInr(upgrade.amountPaise), limit: upgrade.maxSites } : null,
    });
  }

  private upgradePayload(currentPlan: PlanType, feature: Feature) {
    const required = cheapestPlanWith(feature);
    return {
      error: 'FEATURE_NOT_IN_PLAN',
      feature,
      message: required
        ? `${this.featureLabel(feature)} is available on the ${required.name} plan (${formatInr(required.amountPaise)}/month).`
        : `${this.featureLabel(feature)} is not available on your plan. Contact sales.`,
      currentPlan,
      upgradeTo: required ? { plan: required.plan, name: required.name, price: formatInr(required.amountPaise) } : null,
    };
  }

  /** Next self-serve plan above `plan`, if any. */
  private nextPlanUp(plan: PlanType): PlanDefinition | null {
    if (plan === PlanType.FREE) return getPlan(PlanType.STARTER);
    if (plan === PlanType.STARTER) return getPlan(PlanType.GROWTH);
    if (plan === PlanType.GROWTH) return getPlan(PlanType.PRO);
    return null;
  }

  private metricLabel(metric: UsageMetric): string {
    switch (metric) {
      case UsageMetric.CRAWL_PAGES:
        return 'crawled pages';
      case UsageMetric.AI_ANALYSES:
        return 'AI issue analyses';
      case UsageMetric.AUTO_FIXES:
        return 'automated fixes';
      case UsageMetric.AI_VISIBILITY_CHECKS:
        return 'AI visibility prompt checks';
      case UsageMetric.STRATEGY_REPORTS:
        return 'strategy reports';
    }
  }

  private featureLabel(feature: Feature): string {
    switch (feature) {
      case Feature.MODEL_CLAUDE:
        return 'Claude analysis';
      case Feature.MODEL_GPT:
        return 'GPT analysis';
      case Feature.MODEL_GEMINI:
        return 'Gemini analysis';
      case Feature.MODEL_GROQ:
        return 'Groq Llama analysis';
      case Feature.MODEL_OPENROUTER:
        return 'OpenRouter analysis';
      case Feature.AUTO_FIX_PATCH:
        return 'Automated fix generation';
      case Feature.AUTO_FIX_DEPLOY:
        return 'Shipping fixes as pull requests';
      case Feature.AI_VISIBILITY:
        return 'AI assistant visibility tracking';
      case Feature.COMPETITOR_TRACKING:
        return 'Competitor tracking';
      case Feature.MARKET_STRATEGY:
        return 'Market and social media strategy';
      case Feature.WHITE_LABEL_REPORTS:
        return 'White-label reporting';
      case Feature.SCHEDULED_CRAWLS:
        return 'Scheduled crawls';
      case Feature.API_ACCESS:
        return 'API access';
      case Feature.AI_RECOMMENDATIONS:
        return 'AI recommendations';
      case Feature.CRAWL:
        return 'Website crawling';
    }
  }
}
