import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PlanType, Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RazorpayService, RazorpaySubscription } from './razorpay.service';
import { PLAN_CATALOG, SELF_SERVE_PLANS, formatInr, getPlan } from './plans.catalog';

/** Razorpay subscription state -> our enum. */
const STATUS_MAP: Readonly<Record<string, SubscriptionStatus>> = {
  created: SubscriptionStatus.CREATED,
  authenticated: SubscriptionStatus.AUTHENTICATED,
  active: SubscriptionStatus.ACTIVE,
  pending: SubscriptionStatus.PENDING,
  halted: SubscriptionStatus.HALTED,
  cancelled: SubscriptionStatus.CANCELLED,
  completed: SubscriptionStatus.COMPLETED,
  expired: SubscriptionStatus.EXPIRED,
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
  ) {}

  /** Public pricing table for the frontend. */
  listPlans() {
    return SELF_SERVE_PLANS.map((planType) => {
      const definition = PLAN_CATALOG[planType];
      return {
        plan: definition.plan,
        name: definition.name,
        tagline: definition.tagline,
        amountPaise: definition.amountPaise,
        price: formatInr(definition.amountPaise),
        currency: definition.currency,
        interval: definition.interval,
        maxSites: definition.maxSites,
        maxSeats: definition.maxSeats,
        features: [...definition.features],
        quotas: definition.quotas,
      };
    });
  }

  async getSubscription(organizationId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { organizationId } });
  }

  /**
   * Starts a Razorpay subscription and returns the checkout parameters the
   * browser needs. The plan is *not* granted here — entitlement only follows
   * the `subscription.activated` / `subscription.charged` webhook, so a customer
   * who abandons checkout is never billed-in-name-only.
   */
  async startCheckout(params: { organizationId: string; plan: PlanType; email: string; name?: string }) {
    if (!SELF_SERVE_PLANS.includes(params.plan)) {
      throw new BadRequestException(`${params.plan} is not available for self-serve checkout.`);
    }

    const organization = await this.prisma.organization.findUnique({ where: { id: params.organizationId } });
    if (!organization) throw new NotFoundException('Organization not found');

    const existing = await this.getSubscription(params.organizationId);
    if (existing?.status === SubscriptionStatus.ACTIVE && existing.plan === params.plan) {
      throw new BadRequestException(`This organization is already on the ${getPlan(params.plan).name} plan.`);
    }

    const customerId =
      existing?.razorpayCustomerId ??
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

    const definition = getPlan(params.plan);

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
      price: formatInr(definition.amountPaise),
      currency: definition.currency,
    };
  }

  async cancel(organizationId: string, atCycleEnd = true) {
    const subscription = await this.getSubscription(organizationId);
    if (!subscription?.razorpaySubscriptionId) {
      throw new NotFoundException('No active subscription to cancel.');
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
  async handleWebhook(params: { eventId: string; eventType: string; payload: any }): Promise<{ handled: boolean; reason?: string }> {
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
      const entity: RazorpaySubscription | undefined = params.payload?.payload?.subscription?.entity;

      if (!entity?.id) {
        await this.markProcessed(params.eventId);
        return { handled: false, reason: 'no subscription entity' };
      }

      await this.applySubscriptionState(entity);
      await this.markProcessed(params.eventId);
      return { handled: true };
    } catch (error: any) {
      this.logger.error(`Failed to process webhook ${params.eventId}: ${error.message}`);
      await this.prisma.webhookEvent.update({
        where: { provider_eventId: { provider: 'razorpay', eventId: params.eventId } },
        data: { error: String(error.message).slice(0, 1000) },
      });
      throw error;
    }
  }

  /** Writes Razorpay's view of a subscription into our table. */
  private async applySubscriptionState(entity: RazorpaySubscription): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { razorpaySubscriptionId: entity.id },
    });

    const organizationId = subscription?.organizationId ?? entity.notes?.organizationId;
    if (!organizationId) {
      this.logger.warn(`Razorpay subscription ${entity.id} has no organization we can attribute it to.`);
      return;
    }

    const plan = this.planFromNotes(entity) ?? subscription?.plan ?? PlanType.FREE;
    const definition = getPlan(plan);
    const status = this.mapStatus(entity.status);

    const data = {
      plan,
      status,
      razorpaySubscriptionId: entity.id,
      razorpayPlanId: entity.plan_id,
      razorpayCustomerId: entity.customer_id ?? subscription?.razorpayCustomerId ?? null,
      amountPaise: definition.amountPaise,
      currency: definition.currency,
      currentPeriodStart: RazorpayService.toDate(entity.current_start),
      currentPeriodEnd: RazorpayService.toDate(entity.current_end),
      cancelledAt: status === SubscriptionStatus.CANCELLED ? new Date() : null,
    };

    await this.prisma.subscription.upsert({
      where: { organizationId },
      update: data,
      create: { organizationId, ...data },
    });

    this.logger.log(`Subscription ${entity.id} for org ${organizationId} is now ${status} on ${plan}.`);
  }

  private async markProcessed(eventId: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { provider_eventId: { provider: 'razorpay', eventId } },
      data: { processedAt: new Date(), error: null },
    });
  }

  private planFromNotes(entity: RazorpaySubscription): PlanType | null {
    const note = entity.notes?.growthx_plan;
    return note && note in PlanType ? (note as PlanType) : null;
  }

  private mapStatus(razorpayStatus: string): SubscriptionStatus {
    const mapped = STATUS_MAP[razorpayStatus];
    if (!mapped) {
      this.logger.warn(`Unknown Razorpay subscription status "${razorpayStatus}"; treating as PENDING.`);
      return SubscriptionStatus.PENDING;
    }
    return mapped;
  }
}
