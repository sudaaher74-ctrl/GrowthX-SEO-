import { PlanType, Subscription, SubscriptionStatus, UsageMetric } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Feature } from './plans.catalog';
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
export declare class EntitlementsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /**
     * Resolves the plan an organization is actually entitled to right now.
     *
     * A subscription that has lapsed (halted, expired, or a failed charge) drops
     * the org to FREE rather than leaving paid features open, but a subscription
     * cancelled mid-cycle keeps working until the period the customer paid for
     * has actually elapsed.
     */
    resolvePlan(organizationId: string): Promise<{
        plan: PlanType;
        subscription: Subscription | null;
        active: boolean;
    }>;
    /**
     * The window usage is counted against. Follows the Razorpay billing cycle when
     * one exists so a customer who subscribes on the 20th is not reset on the 1st.
     */
    billingPeriod(subscription: Subscription | null, now?: Date): {
        periodStart: Date;
        periodEnd: Date;
    };
    getEntitlements(organizationId: string): Promise<ResolvedEntitlements>;
    hasFeature(organizationId: string, feature: Feature): Promise<boolean>;
    /** Throws a 403 carrying the cheapest plan that would unlock `feature`. */
    assertFeature(organizationId: string, feature: Feature): Promise<void>;
    checkQuota(organizationId: string, metric: UsageMetric, amount?: number): Promise<QuotaStatus & {
        allowed: boolean;
    }>;
    /** Throws a 403 describing the exhausted allowance. */
    assertQuota(organizationId: string, metric: UsageMetric, amount?: number): Promise<void>;
    /**
     * Records consumption *after* the work succeeded. Callers must not pre-charge:
     * a failed crawl or a failed LLM call should never cost the customer.
     */
    recordUsage(organizationId: string, metric: UsageMetric, amount?: number): Promise<void>;
    /** Enforces the per-plan website cap before a new site is registered. */
    assertCanAddSite(organizationId: string): Promise<void>;
    private upgradePayload;
    /** Next self-serve plan above `plan`, if any. */
    private nextPlanUp;
    private metricLabel;
    private featureLabel;
}
