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
exports.AiSearchController = exports.AiSearchDto = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ai_search_service_1 = require("./ai-search/ai-search.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const entitlements_guard_1 = require("../billing/entitlements.guard");
const entitlements_service_1 = require("../billing/entitlements.service");
const entitlements_decorator_1 = require("../billing/entitlements.decorator");
const plans_catalog_1 = require("../billing/plans.catalog");
class AiSearchDto {
}
exports.AiSearchDto = AiSearchDto;
let AiSearchController = class AiSearchController {
    constructor(aiSearchService, entitlements) {
        this.aiSearchService = aiSearchService;
        this.entitlements = entitlements;
    }
    async askQuestion(req, projectId, body) {
        // req.organizationId is set by EntitlementsGuard; it decides which models are reachable.
        const answer = await this.aiSearchService.askQuestion(projectId, body.question, req.organizationId);
        await this.entitlements.recordUsage(req.organizationId, client_1.UsageMetric.AI_ANALYSES);
        return answer;
    }
};
exports.AiSearchController = AiSearchController;
__decorate([
    (0, common_1.Post)(),
    (0, entitlements_decorator_1.Metered)(plans_catalog_1.Feature.AI_RECOMMENDATIONS, client_1.UsageMetric.AI_ANALYSES),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, AiSearchDto]),
    __metadata("design:returntype", Promise)
], AiSearchController.prototype, "askQuestion", null);
exports.AiSearchController = AiSearchController = __decorate([
    (0, common_1.Controller)('api/projects/:projectId/chat'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, entitlements_guard_1.EntitlementsGuard),
    (0, entitlements_decorator_1.OrgFrom)('project', 'projectId'),
    __metadata("design:paramtypes", [ai_search_service_1.AiSearchService,
        entitlements_service_1.EntitlementsService])
], AiSearchController);
//# sourceMappingURL=ai-search.controller.js.map