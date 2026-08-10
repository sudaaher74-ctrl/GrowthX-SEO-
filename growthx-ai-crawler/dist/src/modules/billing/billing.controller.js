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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingController = exports.StartCheckoutDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const billing_service_1 = require("./billing.service");
const entitlements_service_1 = require("./entitlements.service");
const org_context_service_1 = require("./org-context.service");
const razorpay_service_1 = require("./razorpay.service");
class StartCheckoutDto {
}
exports.StartCheckoutDto = StartCheckoutDto;
let BillingController = class BillingController {
    constructor(billing, entitlements, orgContext, razorpay) {
        this.billing = billing;
        this.entitlements = entitlements;
        this.orgContext = orgContext;
        this.razorpay = razorpay;
    }
    listPlans() {
        return { plans: this.billing.listPlans(), gateway: 'razorpay', configured: this.razorpay.isConfigured };
    }
    async getEntitlements(req, orgId) {
        await this.orgContext.assertMembership(req.user.userId, orgId);
        return this.entitlements.getEntitlements(orgId);
    }
    async getSubscription(req, orgId) {
        await this.orgContext.assertMembership(req.user.userId, orgId);
        return this.billing.getSubscription(orgId);
    }
    async startCheckout(req, orgId, body) {
        await this.orgContext.assertMembership(req.user.userId, orgId);
        if (!body?.plan)
            throw new common_1.BadRequestException('plan is required');
        if (!body?.email)
            throw new common_1.BadRequestException('email is required');
        return this.billing.startCheckout({
            organizationId: orgId,
            plan: body.plan,
            email: body.email,
            name: body.name,
        });
    }
    async cancel(req, orgId, body) {
        await this.orgContext.assertMembership(req.user.userId, orgId);
        return this.billing.cancel(orgId, !body?.immediate);
    }
    /**
     * Razorpay webhook. Unauthenticated by design — trust comes from the HMAC
     * signature over the raw body, which is why `rawBody` is enabled in main.ts.
     */
    async webhook(req, signature) {
        const raw = req.rawBody;
        if (!raw) {
            throw new common_1.BadRequestException('Raw body unavailable; enable rawBody on the Nest application.');
        }
        if (!this.razorpay.verifyWebhookSignature(raw, signature)) {
            throw new common_1.ForbiddenException('Invalid Razorpay webhook signature.');
        }
        const payload = JSON.parse(raw.toString('utf8'));
        // Razorpay sends a unique delivery id per webhook attempt-group.
        const eventId = req.headers['x-razorpay-event-id'] ?? `${payload.event}:${payload.created_at}`;
        return this.billing.handleWebhook({ eventId, eventType: payload.event, payload });
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Get)('plans'),
    (0, swagger_1.ApiOperation)({ summary: 'Public pricing table: what ₹2,000 and ₹5,000 include' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listPlans", null);
__decorate([
    (0, common_1.Get)('organizations/:orgId/entitlements'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Resolved plan, feature flags, and usage for an organization' }),
    (0, swagger_1.ApiParam)({ name: 'orgId', description: 'Organization ID' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orgId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getEntitlements", null);
__decorate([
    (0, common_1.Get)('organizations/:orgId/subscription'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Current subscription record for an organization' }),
    (0, swagger_1.ApiParam)({ name: 'orgId', description: 'Organization ID' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orgId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getSubscription", null);
__decorate([
    (0, common_1.Post)('organizations/:orgId/checkout'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Create a Razorpay subscription and return checkout parameters' }),
    (0, swagger_1.ApiParam)({ name: 'orgId', description: 'Organization ID' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                plan: { type: 'string', enum: ['STARTER', 'PRO'], example: 'PRO' },
                email: { type: 'string', example: 'owner@business.in' },
                name: { type: 'string', example: 'Acme Traders' },
            },
        },
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orgId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, StartCheckoutDto]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "startCheckout", null);
__decorate([
    (0, common_1.Post)('organizations/:orgId/cancel'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel the subscription at the end of the paid cycle' }),
    (0, swagger_1.ApiParam)({ name: 'orgId', description: 'Organization ID' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orgId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('webhooks/razorpay'),
    (0, swagger_1.ApiExcludeEndpoint)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-razorpay-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "webhook", null);
exports.BillingController = BillingController = __decorate([
    (0, swagger_1.ApiTags)('Billing & Plans'),
    (0, common_1.Controller)('api/billing'),
    __metadata("design:paramtypes", [billing_service_1.BillingService,
        entitlements_service_1.EntitlementsService,
        org_context_service_1.OrgContextService,
        razorpay_service_1.RazorpayService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map