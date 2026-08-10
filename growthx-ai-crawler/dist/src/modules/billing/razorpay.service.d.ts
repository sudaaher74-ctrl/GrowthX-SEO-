import { ConfigService } from '@nestjs/config';
import { PlanType } from '@prisma/client';
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
export declare class RazorpayService {
    private readonly config;
    private readonly logger;
    private readonly keyId;
    private readonly keySecret;
    private readonly webhookSecret;
    /** Razorpay plan ids, keyed by our PlanType, created lazily on first use. */
    private readonly planIdCache;
    constructor(config: ConfigService);
    get isConfigured(): boolean;
    get publicKeyId(): string;
    private client;
    private post;
    private get;
    /**
     * Returns the Razorpay plan id for one of our plans, creating it on first use
     * so a fresh environment does not need manual dashboard setup. Set
     * `RAZORPAY_PLAN_ID_STARTER` / `RAZORPAY_PLAN_ID_GROWTH` / `RAZORPAY_PLAN_ID_PRO` to pin existing plans.
     */
    ensurePlan(planType: PlanType): Promise<string>;
    createCustomer(params: {
        name?: string;
        email: string;
        organizationId: string;
    }): Promise<string>;
    createSubscription(params: {
        planType: PlanType;
        customerId?: string;
        organizationId: string;
        /** Number of billing cycles to authorise. 12 = one year of monthly charges. */
        totalCount?: number;
    }): Promise<RazorpaySubscription>;
    fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription>;
    cancelSubscription(subscriptionId: string, atCycleEnd?: boolean): Promise<RazorpaySubscription>;
    /**
     * Verifies `x-razorpay-signature` against the raw request body.
     *
     * Must be given the *raw* bytes: re-serialising the parsed JSON changes key
     * order and whitespace and the HMAC will not match.
     */
    verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean;
    /** Razorpay sends unix seconds; null means the cycle has not started yet. */
    static toDate(unixSeconds: number | null | undefined): Date | null;
}
