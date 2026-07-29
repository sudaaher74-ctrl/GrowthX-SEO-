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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../database/prisma.service");
const stripe_1 = require("stripe");
let SubscriptionsService = class SubscriptionsService {
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
        const stripeKey = this.configService.get('STRIPE_SECRET_KEY') || 'sk_test_placeholder';
        this.stripe = new stripe_1.default(stripeKey);
    }
    async getSubscriptionForOrganization(organizationId) {
        return this.prisma.subscription.findUnique({
            where: { organizationId },
        });
    }
    async createCheckoutSession(organizationId, plan) {
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
    async handleWebhook(event) {
        // Implement webhook handler logic (e.g., checkout.session.completed, invoice.paid)
    }
};
exports.SubscriptionsService = SubscriptionsService;
exports.SubscriptionsService = SubscriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map