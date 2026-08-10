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
var RazorpayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RazorpayService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const axios_1 = require("axios");
const crypto = require("crypto");
const plans_catalog_1 = require("./plans.catalog");
/**
 * Thin Razorpay REST client. Razorpay's own SDK is not used so the transport
 * stays mockable in tests and we keep control of timeouts and error shapes.
 */
let RazorpayService = RazorpayService_1 = class RazorpayService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(RazorpayService_1.name);
        /** Razorpay plan ids, keyed by our PlanType, created lazily on first use. */
        this.planIdCache = new Map();
        this.keyId = this.config.get('RAZORPAY_KEY_ID') ?? '';
        this.keySecret = this.config.get('RAZORPAY_KEY_SECRET') ?? '';
        this.webhookSecret = this.config.get('RAZORPAY_WEBHOOK_SECRET') ?? '';
        for (const plan of [client_1.PlanType.STARTER, client_1.PlanType.GROWTH, client_1.PlanType.PRO]) {
            const configured = this.config.get(`RAZORPAY_PLAN_ID_${plan}`);
            if (configured)
                this.planIdCache.set(plan, configured);
        }
    }
    get isConfigured() {
        return Boolean(this.keyId && this.keySecret);
    }
    get publicKeyId() {
        return this.keyId;
    }
    client() {
        if (!this.isConfigured) {
            throw new common_1.ServiceUnavailableException('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
        }
        return axios_1.default.create({
            baseURL: 'https://api.razorpay.com/v1',
            timeout: 15_000,
            auth: { username: this.keyId, password: this.keySecret },
            headers: { 'Content-Type': 'application/json' },
        });
    }
    async post(path, body) {
        try {
            const { data } = await this.client().post(path, body);
            return data;
        }
        catch (error) {
            const detail = error.response?.data?.error?.description ?? error.message;
            this.logger.error(`Razorpay POST ${path} failed: ${detail}`);
            throw new common_1.InternalServerErrorException(`Razorpay request failed: ${detail}`);
        }
    }
    async get(path) {
        try {
            const { data } = await this.client().get(path);
            return data;
        }
        catch (error) {
            const detail = error.response?.data?.error?.description ?? error.message;
            this.logger.error(`Razorpay GET ${path} failed: ${detail}`);
            throw new common_1.InternalServerErrorException(`Razorpay request failed: ${detail}`);
        }
    }
    /**
     * Returns the Razorpay plan id for one of our plans, creating it on first use
     * so a fresh environment does not need manual dashboard setup. Set
     * `RAZORPAY_PLAN_ID_STARTER` / `RAZORPAY_PLAN_ID_GROWTH` / `RAZORPAY_PLAN_ID_PRO` to pin existing plans.
     */
    async ensurePlan(planType) {
        const cached = this.planIdCache.get(planType);
        if (cached)
            return cached;
        const definition = (0, plans_catalog_1.getPlan)(planType);
        const created = await this.post('/plans', {
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
    async createCustomer(params) {
        const customer = await this.post('/customers', {
            name: params.name || params.email,
            email: params.email,
            fail_existing: 0, // return the existing customer instead of erroring
            notes: { organizationId: params.organizationId },
        });
        return customer.id;
    }
    async createSubscription(params) {
        const planId = await this.ensurePlan(params.planType);
        return this.post('/subscriptions', {
            plan_id: planId,
            customer_id: params.customerId,
            total_count: params.totalCount ?? 12,
            customer_notify: 1,
            notes: { organizationId: params.organizationId, growthx_plan: params.planType },
        });
    }
    async fetchSubscription(subscriptionId) {
        return this.get(`/subscriptions/${subscriptionId}`);
    }
    async cancelSubscription(subscriptionId, atCycleEnd = true) {
        return this.post(`/subscriptions/${subscriptionId}/cancel`, {
            cancel_at_cycle_end: atCycleEnd ? 1 : 0,
        });
    }
    /**
     * Verifies `x-razorpay-signature` against the raw request body.
     *
     * Must be given the *raw* bytes: re-serialising the parsed JSON changes key
     * order and whitespace and the HMAC will not match.
     */
    verifyWebhookSignature(rawBody, signature) {
        if (!this.webhookSecret) {
            this.logger.error('RAZORPAY_WEBHOOK_SECRET is not set; refusing to trust webhook.');
            return false;
        }
        if (!signature)
            return false;
        const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
        const expectedBuf = Buffer.from(expected, 'utf8');
        const actualBuf = Buffer.from(signature, 'utf8');
        // timingSafeEqual throws on length mismatch, so guard first.
        return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
    }
    /** Razorpay sends unix seconds; null means the cycle has not started yet. */
    static toDate(unixSeconds) {
        return unixSeconds ? new Date(unixSeconds * 1000) : null;
    }
};
exports.RazorpayService = RazorpayService;
exports.RazorpayService = RazorpayService = RazorpayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RazorpayService);
//# sourceMappingURL=razorpay.service.js.map