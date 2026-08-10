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
exports.EntitlementsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const entitlements_service_1 = require("./entitlements.service");
const entitlements_decorator_1 = require("./entitlements.decorator");
const org_context_service_1 = require("./org-context.service");
/**
 * Enforces plan features and usage allowances. Run it after `JwtAuthGuard` so
 * `request.user` is populated.
 *
 * The resolved organization id is attached to the request as
 * `request.organizationId` so handlers can record usage without resolving twice.
 */
let EntitlementsGuard = class EntitlementsGuard {
    constructor(reflector, entitlements, orgContext) {
        this.reflector = reflector;
        this.entitlements = entitlements;
        this.orgContext = orgContext;
    }
    async canActivate(context) {
        const targets = [context.getHandler(), context.getClass()];
        const features = this.reflector.getAllAndOverride(entitlements_decorator_1.REQUIRED_FEATURES_KEY, targets);
        const quota = this.reflector.getAllAndOverride(entitlements_decorator_1.REQUIRED_QUOTA_KEY, targets);
        // Nothing to enforce on this route.
        if (!features?.length && !quota)
            return true;
        const source = this.reflector.getAllAndOverride(entitlements_decorator_1.ORG_SOURCE_KEY, targets);
        const request = context.switchToHttp().getRequest();
        const organizationId = await this.orgContext.resolve(request, source);
        request.organizationId = organizationId;
        for (const feature of features ?? []) {
            await this.entitlements.assertFeature(organizationId, feature);
        }
        if (quota) {
            await this.entitlements.assertQuota(organizationId, quota.metric, quota.amount);
        }
        return true;
    }
};
exports.EntitlementsGuard = EntitlementsGuard;
exports.EntitlementsGuard = EntitlementsGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        entitlements_service_1.EntitlementsService,
        org_context_service_1.OrgContextService])
], EntitlementsGuard);
//# sourceMappingURL=entitlements.guard.js.map