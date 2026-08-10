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
exports.StrategyController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const entitlements_guard_1 = require("../billing/entitlements.guard");
const entitlements_decorator_1 = require("../billing/entitlements.decorator");
const plans_catalog_1 = require("../billing/plans.catalog");
const strategy_service_1 = require("./strategy.service");
/**
 * Market analysis, SEO roadmap, content plan, and social strategy — the
 * "what do we do about it" layer on top of the crawl and visibility data.
 * Pro-only.
 */
let StrategyController = class StrategyController {
    constructor(strategy) {
        this.strategy = strategy;
    }
    getEvidence(projectId) {
        return this.strategy.gatherEvidence(projectId);
    }
    list(projectId) {
        return this.strategy.list(projectId);
    }
    get(reportId) {
        return this.strategy.get(reportId);
    }
    generate(req, projectId) {
        // req.organizationId is set by EntitlementsGuard.
        return this.strategy.generate(projectId, req.organizationId);
    }
};
exports.StrategyController = StrategyController;
__decorate([
    (0, common_1.Get)('evidence'),
    (0, swagger_1.ApiOperation)({ summary: 'What a strategy would be built from, without spending an allowance' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StrategyController.prototype, "getEvidence", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Previously generated strategy reports' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StrategyController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':reportId'),
    (0, swagger_1.ApiOperation)({ summary: 'One strategy report, with the evidence it was built from' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    (0, swagger_1.ApiParam)({ name: 'reportId' }),
    __param(0, (0, common_1.Param)('reportId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StrategyController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Generate a new strategy (counts against the plan allowance)' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], StrategyController.prototype, "generate", null);
exports.StrategyController = StrategyController = __decorate([
    (0, swagger_1.ApiTags)('Strategy'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/projects/:projectId/strategy'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, entitlements_guard_1.EntitlementsGuard),
    (0, entitlements_decorator_1.OrgFrom)('project', 'projectId'),
    (0, entitlements_decorator_1.RequiresFeature)(plans_catalog_1.Feature.MARKET_STRATEGY),
    __metadata("design:paramtypes", [strategy_service_1.StrategyService])
], StrategyController);
//# sourceMappingURL=strategy.controller.js.map