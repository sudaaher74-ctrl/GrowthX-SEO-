"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EntitlementsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntitlementsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma.service");
const plans_catalog_1 = require("./plans.catalog");
/** Statuses under which we keep serving the paid plan. */
const SERVING_STATUSES = new Set([
    client_1.SubscriptionStatus.ACTIVE,
    client_1.SubscriptionStatus.AUTHENTICATED,
]);
let EntitlementsService = EntitlementsService_1 = class EntitlementsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(EntitlementsService_1.name);
    }
    /**
     * Resolves the plan an organization is actually entitled to right now.
     *
     * A subscription that has lapsed (halted, expired, or a failed charge) drops
     * the org to FREE rather than leaving paid features open, but a subscription
     * cancelled mid-cycle keeps working until the period the customer paid for
     * has actually elapsed.
     */
    async resolvePlan(organizationId) {
        const subscription = await this.prisma.subscription.findUnique({ where: { organizationId } });
        if (!subscription) {
            return { plan: client_1.PlanType.FREE, subscription: null, active: false };
        }
        if (SERVING_STATUSES.has(subscription.status)) {
            return { plan: subscription.plan, subscription, active: true };
        }
        const paidThrough = subscription.currentPeriodEnd;
        const inPaidGrace = subscription.status === client_1.SubscriptionStatus.CANCELLED && paidThrough !== null && paidThrough > new Date();
        if (inPaidGrace) {
            return { plan: subscription.plan, subscription, active: true };
        }
        return { plan: client_1.PlanType.FREE, subscription, active: false };
    }
    /**
     * The window usage is counted against. Follows the Razorpay billing cycle when
     * one exists so a customer who subscribes on the 20th is not reset on the 1st.
     */
    billingPeriod(subscription, now = new Date()) {
        const { currentPeriodStart, currentPeriodEnd } = subscription ?? {};
        if (currentPeriodStart && currentPeriodEnd && currentPeriodStart <= now && now < currentPeriodEnd) {
            return { periodStart: currentPeriodStart, periodEnd: currentPeriodEnd };
        }
        return {
            periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
            periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
        };
    }
    async getEntitlements(organizationId) {
        const { plan, subscription, active } = await this.resolvePlan(organizationId);
        const definition = (0, plans_catalog_1.getPlan)(plan);
        const { periodStart, periodEnd } = this.billingPeriod(subscription);
        const records = await this.prisma.usageRecord.findMany({
            where: { organizationId, periodStart },
        });
        const usedByMetric = new Map(records.map((r) => [r.metric, r.used]));
        const quotas = Object.values(client_1.UsageMetric).map((metric) => {
            const limit = (0, plans_catalog_1.quotaFor)(plan, metric);
            const used = usedByMetric.get(metric) ?? 0;
            return { metric, limit, used, remaining: limit === null ? null : Math.max(0, limit - used) };
        });
        return {
            organizationId,
            plan,
            planName: definition.name,
            status: subscription?.status ?? client_1.SubscriptionStatus.EXPIRED,
            subscriptionActive: active,
            features: [...definition.features],
            maxSites: definition.maxSites,
            maxSeats: definition.maxSeats,
            periodStart,
            periodEnd,
            quotas,
        };
    }
    async hasFeature(organizationId, feature) {
        const { plan } = await this.resolvePlan(organizationId);
        return (0, plans_catalog_1.planHasFeature)(plan, feature);
    }
    /** Throws a 403 carrying the cheapest plan that would unlock `feature`. */
    async assertFeature(organizationId, feature) {
        const { plan } = await this.resolvePlan(organizationId);
        if ((0, plans_catalog_1.planHasFeature)(plan, feature))
            return;
        throw new common_1.ForbiddenException(this.upgradePayload(plan, feature));
    }
    async checkQuota(organizationId, metric, amount = 1) {
        const { plan, subscription } = await this.resolvePlan(organizationId);
        const limit = (0, plans_catalog_1.quotaFor)(plan, metric);
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
    async assertQuota(organizationId, metric, amount = 1) {
        const status = await this.checkQuota(organizationId, metric, amount);
        if (status.allowed)
            return;
        const { plan } = await this.resolvePlan(organizationId);
        const definition = (0, plans_catalog_1.getPlan)(plan);
        const upgrade = this.nextPlanUp(plan);
        throw new common_1.ForbiddenException({
            error: 'QUOTA_EXCEEDED',
            metric,
            message: `Your ${definition.name} plan allows ${status.limit} ${this.metricLabel(metric)} per billing period and ${status.used} have been used.`,
            currentPlan: plan,
            limit: status.limit,
            used: status.used,
            upgradeTo: upgrade
                ? { plan: upgrade.plan, name: upgrade.name, price: (0, plans_catalog_1.formatInr)(upgrade.amountPaise), limit: (0, plans_catalog_1.quotaFor)(upgrade.plan, metric) }
                : null,
        });
    }
    /**
     * Records consumption *after* the work succeeded. Callers must not pre-charge:
     * a failed crawl or a failed LLM call should never cost the customer.
     */
    async recordUsage(organizationId, metric, amount = 1) {
        if (amount <= 0)
            return;
        const { subscription } = await this.resolvePlan(organizationId);
        const { periodStart, periodEnd } = this.billingPeriod(subscription);
        await this.prisma.usageRecord.upsert({
            where: { organizationId_metric_periodStart: { organizationId, metric, periodStart } },
            update: { used: { increment: amount } },
            create: { organizationId, metric, periodStart, periodEnd, used: amount },
        });
    }
    /** Enforces the per-plan website cap before a new site is registered. */
    async assertCanAddSite(organizationId) {
        const { plan } = await this.resolvePlan(organizationId);
        const definition = (0, plans_catalog_1.getPlan)(plan);
        if (definition.maxSites === null)
            return;
        const current = await this.prisma.website.count({
            where: { project: { organizationId } },
        });
        if (current < definition.maxSites)
            return;
        const upgrade = this.nextPlanUp(plan);
        throw new common_1.ForbiddenException({
            error: 'SITE_LIMIT_REACHED',
            message: `The ${definition.name} plan covers ${definition.maxSites} website${definition.maxSites === 1 ? '' : 's'}.`,
            currentPlan: plan,
            limit: definition.maxSites,
            used: current,
            upgradeTo: upgrade ? { plan: upgrade.plan, name: upgrade.name, price: (0, plans_catalog_1.formatInr)(upgrade.amountPaise), limit: upgrade.maxSites } : null,
        });
    }
    upgradePayload(currentPlan, feature) {
        const required = (0, plans_catalog_1.cheapestPlanWith)(feature);
        return {
            error: 'FEATURE_NOT_IN_PLAN',
            feature,
            message: required
                ? `${this.featureLabel(feature)} is available on the ${required.name} plan (${(0, plans_catalog_1.formatInr)(required.amountPaise)}/month).`
                : `${this.featureLabel(feature)} is not available on your plan. Contact sales.`,
            currentPlan,
            upgradeTo: required ? { plan: required.plan, name: required.name, price: (0, plans_catalog_1.formatInr)(required.amountPaise) } : null,
        };
    }
    /** Next self-serve plan above `plan`, if any. */
    nextPlanUp(plan) {
        if (plan === client_1.PlanType.FREE)
            return (0, plans_catalog_1.getPlan)(client_1.PlanType.STARTER);
        if (plan === client_1.PlanType.STARTER)
            return (0, plans_catalog_1.getPlan)(client_1.PlanType.GROWTH);
        if (plan === client_1.PlanType.GROWTH)
            return (0, plans_catalog_1.getPlan)(client_1.PlanType.PRO);
        return null;
    }
    metricLabel(metric) {
        switch (metric) {
            case client_1.UsageMetric.CRAWL_PAGES:
                return 'crawled pages';
            case client_1.UsageMetric.AI_ANALYSES:
                return 'AI issue analyses';
            case client_1.UsageMetric.AUTO_FIXES:
                return 'automated fixes';
            case client_1.UsageMetric.AI_VISIBILITY_CHECKS:
                return 'AI visibility prompt checks';
            case client_1.UsageMetric.STRATEGY_REPORTS:
                return 'strategy reports';
        }
    }
    featureLabel(feature) {
        switch (feature) {
            case plans_catalog_1.Feature.MODEL_CLAUDE:
                return 'Claude analysis';
            case plans_catalog_1.Feature.MODEL_GPT:
                return 'GPT analysis';
            case plans_catalog_1.Feature.MODEL_GEMINI:
                return 'Gemini analysis';
            case plans_catalog_1.Feature.AUTO_FIX_PATCH:
                return 'Automated fix generation';
            case plans_catalog_1.Feature.AUTO_FIX_DEPLOY:
                return 'Shipping fixes as pull requests';
            case plans_catalog_1.Feature.AI_VISIBILITY:
                return 'AI assistant visibility tracking';
            case plans_catalog_1.Feature.COMPETITOR_TRACKING:
                return 'Competitor tracking';
            case plans_catalog_1.Feature.MARKET_STRATEGY:
                return 'Market and social media strategy';
            case plans_catalog_1.Feature.WHITE_LABEL_REPORTS:
                return 'White-label reporting';
            case plans_catalog_1.Feature.SCHEDULED_CRAWLS:
                return 'Scheduled crawls';
            case plans_catalog_1.Feature.API_ACCESS:
                return 'API access';
            case plans_catalog_1.Feature.AI_RECOMMENDATIONS:
                return 'AI recommendations';
            case plans_catalog_1.Feature.CRAWL:
                return 'Website crawling';
        }
    }
};
exports.EntitlementsService = EntitlementsService;
exports.EntitlementsService = EntitlementsService = EntitlementsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EntitlementsService);
//# sourceMappingURL=entitlements.service.js.map