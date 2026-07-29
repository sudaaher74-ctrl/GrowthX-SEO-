import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import Stripe from 'stripe';
import { PlanType } from '@prisma/client';
export declare class SubscriptionsService {
    private configService;
    private prisma;
    private stripe;
    constructor(configService: ConfigService, prisma: PrismaService);
    getSubscriptionForOrganization(organizationId: string): Promise<{
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        plan: import(".prisma/client").$Enums.PlanType;
        currentPeriodEnd: Date | null;
    } | null>;
    createCheckoutSession(organizationId: string, plan: PlanType): Promise<import("stripe/cjs/lib").Response<import("stripe/cjs/resources/Checkout").Session>>;
    handleWebhook(event: Stripe.Event): Promise<void>;
}
