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
exports.AiVisibilityController = exports.AddCompetitorDto = exports.AddPromptsDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const entitlements_guard_1 = require("../billing/entitlements.guard");
const entitlements_decorator_1 = require("../billing/entitlements.decorator");
const plans_catalog_1 = require("../billing/plans.catalog");
const ai_visibility_service_1 = require("./ai-visibility.service");
const aeo_analysis_service_1 = require("./aeo-analysis/aeo-analysis.service");
class AddPromptsDto {
}
exports.AddPromptsDto = AddPromptsDto;
class AddCompetitorDto {
}
exports.AddCompetitorDto = AddCompetitorDto;
/**
 * AI Visibility (AEO/GEO) — whether ChatGPT, Claude, and Gemini cite the
 * customer when answering the questions their buyers actually ask.
 *
 * Every route is Pro-only: the whole surface sits behind Feature.AI_VISIBILITY.
 */
let AiVisibilityController = class AiVisibilityController {
    constructor(visibility, aeo) {
        this.visibility = visibility;
        this.aeo = aeo;
    }
    async getReport(projectId, days) {
        const window = Math.min(180, Math.max(7, parseInt(days ?? '28', 10) || 28));
        const report = await this.visibility.getReport(projectId, window);
        return {
            ...report,
            // Stated explicitly so the dashboard never implies we measured an
            // assistant we cannot actually query.
            measurableAssistants: ai_visibility_service_1.SUPPORTED_ASSISTANTS,
        };
    }
    listPrompts(projectId) {
        return this.visibility.listPrompts(projectId);
    }
    addPrompts(projectId, body) {
        return this.visibility.addPrompts(projectId, body?.prompts ?? []);
    }
    addCompetitor(projectId, body) {
        return this.visibility.addCompetitor(projectId, body?.domain, body?.label);
    }
    sweep(projectId, body) {
        // The service checks the AI_VISIBILITY_CHECKS allowance for the whole batch
        // before spending anything, then bills only the checks that succeeded.
        return this.visibility.sweepProject(projectId, { assistants: body?.assistants });
    }
    getAeo(projectId) {
        return this.aeo.analyzeWebsiteAeo(projectId);
    }
};
exports.AiVisibilityController = AiVisibilityController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Citation share, per-assistant breakdown, share of voice, and weekly trend' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    (0, swagger_1.ApiQuery)({ name: 'days', required: false, example: 28 }),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AiVisibilityController.prototype, "getReport", null);
__decorate([
    (0, common_1.Get)('prompts'),
    (0, swagger_1.ApiOperation)({ summary: 'Tracked prompts with their most recent result per assistant' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AiVisibilityController.prototype, "listPrompts", null);
__decorate([
    (0, common_1.Post)('prompts'),
    (0, swagger_1.ApiOperation)({ summary: 'Add or update the prompts tracked for this project' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                prompts: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            text: { type: 'string', example: 'best insulated jacket for winter hiking' },
                            intent: { type: 'string', enum: Object.values(client_1.SearchIntent) },
                            cluster: { type: 'string', example: 'buying guides' },
                            estimatedVolume: { type: 'number', example: 4400 },
                        },
                    },
                },
            },
        },
    }),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, AddPromptsDto]),
    __metadata("design:returntype", void 0)
], AiVisibilityController.prototype, "addPrompts", null);
__decorate([
    (0, common_1.Post)('competitors'),
    (0, swagger_1.ApiOperation)({ summary: 'Track a competitor for share-of-voice comparison' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                domain: { type: 'string', example: 'trailheadco.com' },
                // Without this, an answer saying "Trailhead Co" rather than the domain
                // is missed, so the label is worth setting.
                label: { type: 'string', example: 'Trailhead Co' },
            },
        },
    }),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, AddCompetitorDto]),
    __metadata("design:returntype", void 0)
], AiVisibilityController.prototype, "addCompetitor", null);
__decorate([
    (0, common_1.Post)('sweep'),
    (0, swagger_1.ApiOperation)({ summary: 'Run every active prompt against every measurable assistant now' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    (0, swagger_1.ApiBody)({
        required: false,
        schema: {
            type: 'object',
            properties: {
                assistants: { type: 'array', items: { type: 'string', enum: Object.values(client_1.AiAssistant) } },
            },
        },
    }),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AiVisibilityController.prototype, "sweep", null);
__decorate([
    (0, common_1.Get)('aeo'),
    (0, swagger_1.ApiOperation)({ summary: 'On-page answer-engine readiness (structured data, semantic HTML)' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AiVisibilityController.prototype, "getAeo", null);
exports.AiVisibilityController = AiVisibilityController = __decorate([
    (0, swagger_1.ApiTags)('AI Visibility'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/projects/:projectId/ai-visibility'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, entitlements_guard_1.EntitlementsGuard),
    (0, entitlements_decorator_1.OrgFrom)('project', 'projectId'),
    (0, entitlements_decorator_1.RequiresFeature)(plans_catalog_1.Feature.AI_VISIBILITY),
    __metadata("design:paramtypes", [ai_visibility_service_1.AiVisibilityService,
        aeo_analysis_service_1.AeoAnalysisService])
], AiVisibilityController);
//# sourceMappingURL=ai-visibility.controller.js.map