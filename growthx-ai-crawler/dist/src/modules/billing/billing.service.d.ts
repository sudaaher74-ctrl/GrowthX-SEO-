import { PlanType, Subscription } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RazorpayService } from './razorpay.service';
export declare class BillingService {
    private readonly prisma;
    private readonly razorpay;
    private readonly logger;
    constructor(prisma: PrismaService, razorpay: RazorpayService);
    /** Public pricing table for the frontend. */
    listPlans(): {
        plan: import(".prisma/client").$Enums.PlanType;
        name: string;
        tagline: string;
        amountPaise: number;
        price: string;
        currency: "INR";
        interval: "monthly";
        maxSites: number | null;
        maxSeats: number | null;
        features: import("./plans.catalog").Feature[];
        quotas: import("./plans.catalog").QuotaLimits;
    }[];
    getSubscription(organizationId: string): Promise<Subscription | null>;
    /**
     * Starts a Razorpay subscription and returns the checkout parameters the
     * browser needs. The plan is *not* granted here — entitlement only follows
     * the `subscription.activated` / `subscription.charged` webhook, so a customer
     * who abandons checkout is never billed-in-name-only.
     */
    startCheckout(params: {
        organizationId: string;
        plan: PlanType;
        email: string;
        name?: string;
    }): Promise<{
        subscriptionId: string;
        razorpayKeyId: string;
        shortUrl: string | null;
        plan: import(".prisma/client").$Enums.PlanType;
        planName: string;
        amountPaise: number;
        price: string;
        currency: "INR";
    }>;
    cancel(organizationId: string, atCycleEnd?: boolean): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        plan: import(".prisma/client").$Enums.PlanType;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        razorpayCustomerId: string | null;
        razorpaySubscriptionId: string | null;
        razorpayPlanId: string | null;
        amountPaise: number;
        currency: string;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
        cancelledAt: Date | null;
    }>;
    /**
     * Applies a verified webhook. Idempotent: the delivery id is recorded first
     * and a repeat delivery is dropped, so Razorpay's retries cannot roll the
     * billing period forward twice.
     */
    handleWebhook(params: {
        eventId: string;
        eventType: string;
        payload: any;
    }): Promise<{
        handled: boolean;
        reason?: string;
    }>;
    /** Writes Razorpay's view of a subscription into our table. */
    private applySubscriptionState;
    private markProcessed;
    private planFromNotes;
    private mapStatus;
}
