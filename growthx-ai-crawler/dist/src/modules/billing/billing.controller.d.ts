import { RawBodyRequest } from '@nestjs/common';
import { PlanType } from '@prisma/client';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { OrgContextService } from './org-context.service';
import { RazorpayService } from './razorpay.service';
export declare class StartCheckoutDto {
    plan: PlanType;
    email: string;
    name?: string;
}
export declare class BillingController {
    private readonly billing;
    private readonly entitlements;
    private readonly orgContext;
    private readonly razorpay;
    constructor(billing: BillingService, entitlements: EntitlementsService, orgContext: OrgContextService, razorpay: RazorpayService);
    listPlans(): {
        plans: {
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
        gateway: string;
        configured: boolean;
    };
    getEntitlements(req: any, orgId: string): Promise<import("./entitlements.service").ResolvedEntitlements>;
    getSubscription(req: any, orgId: string): Promise<{
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
    } | null>;
    startCheckout(req: any, orgId: string, body: StartCheckoutDto): Promise<{
        subscriptionId: string;
        razorpayKeyId: string;
        shortUrl: string | null;
        plan: import(".prisma/client").$Enums.PlanType;
        planName: string;
        amountPaise: number;
        price: string;
        currency: "INR";
    }>;
    cancel(req: any, orgId: string, body: {
        immediate?: boolean;
    }): Promise<{
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
     * Razorpay webhook. Unauthenticated by design — trust comes from the HMAC
     * signature over the raw body, which is why `rawBody` is enabled in main.ts.
     */
    webhook(req: RawBodyRequest<Request>, signature: string): Promise<{
        handled: boolean;
        reason?: string;
    }>;
}
