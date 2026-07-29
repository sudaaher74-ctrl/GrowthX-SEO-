import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import Stripe from 'stripe';
import { PlanType } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY') || 'sk_test_placeholder';
    this.stripe = new Stripe(stripeKey);
  }

  async getSubscriptionForOrganization(organizationId: string) {
    return this.prisma.subscription.findUnique({
      where: { organizationId },
    });
  }

  async createCheckoutSession(organizationId: string, plan: PlanType) {
    // Basic skeleton for Stripe checkout
    // Here we would lookup the Stripe Price ID based on the plan type
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: 'price_placeholder', // Should be dynamic based on plan
          quantity: 1,
        },
      ],
      success_url: `${this.configService.get('FRONTEND_URL')}/dashboard/billing?success=true`,
      cancel_url: `${this.configService.get('FRONTEND_URL')}/dashboard/billing?canceled=true`,
      client_reference_id: organizationId,
    });

    return session;
  }

  async handleWebhook(event: Stripe.Event) {
    // Implement webhook handler logic (e.g., checkout.session.completed, invoice.paid)
  }
}

