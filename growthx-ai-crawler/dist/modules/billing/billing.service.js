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
var BillingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma.service");
const razorpay_service_1 = require("./razorpay.service");
const plans_catalog_1 = require("./plans.catalog");
/** Razorpay subscription state -> our enum. */
const STATUS_MAP = {
    created: client_1.SubscriptionStatus.CREATED,
    authenticated: client_1.SubscriptionStatus.AUTHENTICATED,
    active: client_1.SubscriptionStatus.ACTIVE,
    pending: client_1.SubscriptionStatus.PENDING,
    halted: client_1.SubscriptionStatus.HALTED,
    cancelled: client_1.SubscriptionStatus.CANCELLED,
    completed: client_1.SubscriptionStatus.COMPLETED,
    expired: client_1.SubscriptionStatus.EXPIRED,
};
let BillingService = BillingService_1 = class BillingService {
    constructor(prisma, razorpay) {
        this.prisma = prisma;
        this.razorpay = razorpay;
        this.logger = new common_1.Logger(BillingService_1.name);
    }
    /** Public pricing table for the frontend. */
    listPlans() {
        return plans_catalog_1.SELF_SERVE_PLANS.map((planType) => {
            const definition = plans_catalog_1.PLAN_CATALOG[planType];
            return {
                plan: definition.plan,
                name: definition.name,
                tagline: definition.tagline,
                amountPaise: definition.amountPaise,
                price: (0, plans_catalog_1.formatInr)(definition.amountPaise),
                currency: definition.currency,
                interval: definition.interval,
                maxSites: definition.maxSites,
                maxSeats: definition.maxSeats,
                features: [...definition.features],
                quotas: definition.quotas,
            };
        });
    }
    async getSubscription(organizationId) {
        return this.prisma.subscription.findUnique({ where: { organizationId } });
    }
    /**
     * Starts a Razorpay subscription and returns the checkout parameters the
     * browser needs. The plan is *not* granted here — entitlement only follows
     * the `subscription.activated` / `subscription.charged` webhook, so a customer
     * who abandons checkout is never billed-in-name-only.
     */
    async startCheckout(params) {
        if (!plans_catalog_1.SELF_SERVE_PLANS.includes(params.plan)) {
            throw new common_1.BadRequestException(`${params.plan} is not available for self-serve checkout.`);
        }
        const organization = await this.prisma.organization.findUnique({ where: { id: params.organizationId } });
        if (!organization)
            throw new common_1.NotFoundException('Organization not found');
        const existing = await this.getSubscription(params.organizationId);
        if (existing?.status === client_1.SubscriptionStatus.ACTIVE && existing.plan === params.plan) {
            throw new common_1.BadRequestException(`This organization is already on the ${(0, plans_catalog_1.getPlan)(params.plan).name} plan.`);
        }
        const customerId = existing?.razorpayCustomerId ??
            (await this.razorpay.createCustomer({
                email: params.email,
                name: params.name ?? organization.name,
                organizationId: params.organizationId,
            }));
        const created = await this.razorpay.createSubscription({
            planType: params.plan,
            customerId,
            organizationId: params.organizationId,
        });
        const definition = (0, plans_catalog_1.getPlan)(params.plan);
        // Record the pending subscription so the webhook can find it by id. The
        // status stays un-served until Razorpay confirms the first charge.
        await this.prisma.subscription.upsert({
            where: { organizationId: params.organizationId },
            update: {
                plan: params.plan,
                status: this.mapStatus(created.status),
                razorpayCustomerId: customerId,
                razorpaySubscriptionId: created.id,
                razorpayPlanId: created.plan_id,
                amountPaise: definition.amountPaise,
                currency: definition.currency,
                cancelAtPeriodEnd: false,
                cancelledAt: null,
            },
            create: {
                organizationId: params.organizationId,
                plan: params.plan,
                status: this.mapStatus(created.status),
                razorpayCustomerId: customerId,
                razorpaySubscriptionId: created.id,
                razorpayPlanId: created.plan_id,
                amountPaise: definition.amountPaise,
                currency: definition.currency,
            },
        });
        return {
            subscriptionId: created.id,
            razorpayKeyId: this.razorpay.publicKeyId,
            shortUrl: created.short_url ?? null,
            plan: params.plan,
            planName: definition.name,
            amountPaise: definition.amountPaise,
            price: (0, plans_catalog_1.formatInr)(definition.amountPaise),
            currency: definition.currency,
        };
    }
    async cancel(organizationId, atCycleEnd = true) {
        const subscription = await this.getSubscription(organizationId);
        if (!subscription?.razorpaySubscriptionId) {
            throw new common_1.NotFoundException('No active subscription to cancel.');
        }
        const cancelled = await this.razorpay.cancelSubscription(subscription.razorpaySubscriptionId, atCycleEnd);
        return this.prisma.subscription.update({
            where: { organizationId },
            data: {
                status: this.mapStatus(cancelled.status),
                cancelAtPeriodEnd: atCycleEnd,
                cancelledAt: atCycleEnd ? null : new Date(),
            },
        });
    }
    /**
     * Applies a verified webhook. Idempotent: the delivery id is recorded first
     * and a repeat delivery is dropped, so Razorpay's retries cannot roll the
     * billing period forward twice.
     */
    async handleWebhook(params) {
        const existing = await this.prisma.webhookEvent.findUnique({
            where: { provider_eventId: { provider: 'razorpay', eventId: params.eventId } },
        });
        if (existing?.processedAt) {
            return { handled: false, reason: 'duplicate' };
        }
        await this.prisma.webhookEvent.upsert({
            where: { provider_eventId: { provider: 'razorpay', eventId: params.eventId } },
            update: { eventType: params.eventType, payload: params.payload },
            create: { provider: 'razorpay', eventId: params.eventId, eventType: params.eventType, payload: params.payload },
        });
        try {
            const entity = params.payload?.payload?.subscription?.entity;
            if (!entity?.id) {
                await this.markProcessed(params.eventId);
                return { handled: false, reason: 'no subscription entity' };
            }
            await this.applySubscriptionState(entity);
            await this.markProcessed(params.eventId);
            return { handled: true };
        }
        catch (error) {
            this.logger.error(`Failed to process webhook ${params.eventId}: ${error.message}`);
            await this.prisma.webhookEvent.update({
                where: { provider_eventId: { provider: 'razorpay', eventId: params.eventId } },
                data: { error: String(error.message).slice(0, 1000) },
            });
            throw error;
        }
    }
    /** Writes Razorpay's view of a subscription into our table. */
    async applySubscriptionState(entity) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { razorpaySubscriptionId: entity.id },
        });
        const organizationId = subscription?.organizationId ?? entity.notes?.organizationId;
        if (!organizationId) {
            this.logger.warn(`Razorpay subscription ${entity.id} has no organization we can attribute it to.`);
            return;
        }
        const plan = this.planFromNotes(entity) ?? subscription?.plan ?? client_1.PlanType.FREE;
        const definition = (0, plans_catalog_1.getPlan)(plan);
        const status = this.mapStatus(entity.status);
        const data = {
            plan,
            status,
            razorpaySubscriptionId: entity.id,
            razorpayPlanId: entity.plan_id,
            razorpayCustomerId: entity.customer_id ?? subscription?.razorpayCustomerId ?? null,
            amountPaise: definition.amountPaise,
            currency: definition.currency,
            currentPeriodStart: razorpay_service_1.RazorpayService.toDate(entity.current_start),
            currentPeriodEnd: razorpay_service_1.RazorpayService.toDate(entity.current_end),
            cancelledAt: status === client_1.SubscriptionStatus.CANCELLED ? new Date() : null,
        };
        await this.prisma.subscription.upsert({
            where: { organizationId },
            update: data,
            create: { organizationId, ...data },
        });
        this.logger.log(`Subscription ${entity.id} for org ${organizationId} is now ${status} on ${plan}.`);
    }
    async markProcessed(eventId) {
        await this.prisma.webhookEvent.update({
            where: { provider_eventId: { provider: 'razorpay', eventId } },
            data: { processedAt: new Date(), error: null },
        });
    }
    planFromNotes(entity) {
        const note = entity.notes?.growthx_plan;
        return note && note in client_1.PlanType ? note : null;
    }
    mapStatus(razorpayStatus) {
        const mapped = STATUS_MAP[razorpayStatus];
        if (!mapped) {
            this.logger.warn(`Unknown Razorpay subscription status "${razorpayStatus}"; treating as PENDING.`);
            return client_1.SubscriptionStatus.PENDING;
        }
        return mapped;
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        razorpay_service_1.RazorpayService])
], BillingService);
//# sourceMappingURL=billing.service.js.map