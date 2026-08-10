import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanType } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { PlanDefinition, getPlan } from './plans.catalog';

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  customer_id?: string;
  status: string;
  short_url?: string;
  current_start: number | null;
  current_end: number | null;
  notes?: Record<string, string>;
}

/**
 * Thin Razorpay REST client. Razorpay's own SDK is not used so the transport
 * stays mockable in tests and we keep control of timeouts and error shapes.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  /** Razorpay plan ids, keyed by our PlanType, created lazily on first use. */
  private readonly planIdCache = new Map<PlanType, string>();

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID') ?? '';
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';

    for (const plan of [PlanType.STARTER, PlanType.GROWTH, PlanType.PRO]) {
      const configured = this.config.get<string>(`RAZORPAY_PLAN_ID_${plan}`);
      if (configured) this.planIdCache.set(plan, configured);
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  get publicKeyId(): string {
    return this.keyId;
  }

  private client(): AxiosInstance {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      );
    }
    return axios.create({
      baseURL: 'https://api.razorpay.com/v1',
      timeout: 15_000,
      auth: { username: this.keyId, password: this.keySecret },
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    try {
      const { data } = await this.client().post<T>(path, body);
      return data;
    } catch (error: any) {
      const detail = error.response?.data?.error?.description ?? error.message;
      this.logger.error(`Razorpay POST ${path} failed: ${detail}`);
      throw new InternalServerErrorException(`Razorpay request failed: ${detail}`);
    }
  }

  private async get<T>(path: string): Promise<T> {
    try {
      const { data } = await this.client().get<T>(path);
      return data;
    } catch (error: any) {
      const detail = error.response?.data?.error?.description ?? error.message;
      this.logger.error(`Razorpay GET ${path} failed: ${detail}`);
      throw new InternalServerErrorException(`Razorpay request failed: ${detail}`);
    }
  }

  /**
   * Returns the Razorpay plan id for one of our plans, creating it on first use
   * so a fresh environment does not need manual dashboard setup. Set
   * `RAZORPAY_PLAN_ID_STARTER` / `RAZORPAY_PLAN_ID_GROWTH` / `RAZORPAY_PLAN_ID_PRO` to pin existing plans.
   */
  async ensurePlan(planType: PlanType): Promise<string> {
    const cached = this.planIdCache.get(planType);
    if (cached) return cached;

    const definition: PlanDefinition = getPlan(planType);
    const created = await this.post<{ id: string }>('/plans', {
      period: 'monthly',
      interval: 1,
      item: {
        name: `GrowthX AI SEO — ${definition.name}`,
        description: definition.tagline,
        amount: definition.amountPaise,
        currency: definition.currency,
      },
      notes: { growthx_plan: planType },
    });

    this.logger.log(`Created Razorpay plan ${created.id} for ${planType}`);
    this.planIdCache.set(planType, created.id);
    return created.id;
  }

  async createCustomer(params: { name?: string; email: string; organizationId: string }): Promise<string> {
    const customer = await this.post<{ id: string }>('/customers', {
      name: params.name || params.email,
      email: params.email,
      fail_existing: 0, // return the existing customer instead of erroring
      notes: { organizationId: params.organizationId },
    });
    return customer.id;
  }

  async createSubscription(params: {
    planType: PlanType;
    customerId?: string;
    organizationId: string;
    /** Number of billing cycles to authorise. 12 = one year of monthly charges. */
    totalCount?: number;
  }): Promise<RazorpaySubscription> {
    const planId = await this.ensurePlan(params.planType);

    return this.post<RazorpaySubscription>('/subscriptions', {
      plan_id: planId,
      customer_id: params.customerId,
      total_count: params.totalCount ?? 12,
      customer_notify: 1,
      notes: { organizationId: params.organizationId, growthx_plan: params.planType },
    });
  }

  async fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
    return this.get<RazorpaySubscription>(`/subscriptions/${subscriptionId}`);
  }

  async cancelSubscription(subscriptionId: string, atCycleEnd = true): Promise<RazorpaySubscription> {
    return this.post<RazorpaySubscription>(`/subscriptions/${subscriptionId}/cancel`, {
      cancel_at_cycle_end: atCycleEnd ? 1 : 0,
    });
  }

  /**
   * Verifies `x-razorpay-signature` against the raw request body.
   *
   * Must be given the *raw* bytes: re-serialising the parsed JSON changes key
   * order and whitespace and the HMAC will not match.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
    if (!this.webhookSecret) {
      this.logger.error('RAZORPAY_WEBHOOK_SECRET is not set; refusing to trust webhook.');
      return false;
    }
    if (!signature) return false;

    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');

    // timingSafeEqual throws on length mismatch, so guard first.
    return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  /** Razorpay sends unix seconds; null means the cycle has not started yet. */
  static toDate(unixSeconds: number | null | undefined): Date | null {
    return unixSeconds ? new Date(unixSeconds * 1000) : null;
  }
}
