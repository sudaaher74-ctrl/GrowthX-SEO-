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
exports.AutomationController = exports.ConnectRepoDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const entitlements_guard_1 = require("../billing/entitlements.guard");
const entitlements_decorator_1 = require("../billing/entitlements.decorator");
const plans_catalog_1 = require("../billing/plans.catalog");
const automation_service_1 = require("./automation.service");
const content_generation_service_1 = require("./content-generation.service");
class ConnectRepoDto {
}
exports.ConnectRepoDto = ConnectRepoDto;
/**
 * The autonomous loop: crawl → analyse → plan content → edit the site's code →
 * open a pull request.
 *
 * Pro-only. A PR is the deliverable; publishing to the live site is a separate,
 * explicit opt-in on the repository.
 */
let AutomationController = class AutomationController {
    constructor(automation, content) {
        this.automation = automation;
        this.content = content;
    }
    // ── repository
    getRepository(projectId) {
        return this.automation.getRepository(projectId);
    }
    connectRepository(projectId, body) {
        return this.automation.connectRepository(projectId, body);
    }
    // ── content pipeline
    planContent(projectId) {
        return this.content.planFromStrategy(projectId);
    }
    listContent(projectId) {
        return this.content.list(projectId);
    }
    draft(req, pieceId) {
        return this.content.draft(pieceId, req.organizationId);
    }
    // ── runs
    runFixes(req, projectId, body) {
        return this.automation.runFixes(projectId, req.organizationId, body?.issueIds);
    }
    runContent(req, projectId, body) {
        return this.automation.runContent(projectId, req.organizationId, body?.pieceIds);
    }
    listRuns(projectId) {
        return this.automation.listRuns(projectId);
    }
};
exports.AutomationController = AutomationController;
__decorate([
    (0, common_1.Get)('repository'),
    (0, swagger_1.ApiOperation)({ summary: 'The connected repository (never returns the token)' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "getRepository", null);
__decorate([
    (0, common_1.Post)('repository'),
    (0, swagger_1.ApiOperation)({ summary: "Connect the client's website repository" }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                owner: { type: 'string', example: 'acme-inc' },
                name: { type: 'string', example: 'website' },
                accessToken: { type: 'string', description: 'GitHub PAT with Contents: Read and write' },
                defaultBranch: { type: 'string', example: 'main' },
                framework: { type: 'string', enum: ['nextjs', 'static-html', 'unknown'] },
                contentDir: { type: 'string', example: 'content/blog' },
                autoMerge: { type: 'boolean', example: false },
            },
        },
    }),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ConnectRepoDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "connectRepository", null);
__decorate([
    (0, common_1.Post)('content/plan'),
    (0, swagger_1.ApiOperation)({ summary: "Turn the latest strategy's content plan into tracked pieces" }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "planContent", null);
__decorate([
    (0, common_1.Get)('content'),
    (0, swagger_1.ApiOperation)({ summary: 'Planned, drafted and shipped content for this client' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "listContent", null);
__decorate([
    (0, common_1.Post)('content/:pieceId/draft'),
    (0, swagger_1.ApiOperation)({ summary: 'Write the actual page for a planned piece' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    (0, swagger_1.ApiParam)({ name: 'pieceId' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('pieceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "draft", null);
__decorate([
    (0, common_1.Post)('runs/fixes'),
    (0, swagger_1.ApiOperation)({ summary: 'Apply approved SEO fixes to the repo and open a PR' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    (0, swagger_1.ApiBody)({ required: false, schema: { type: 'object', properties: { issueIds: { type: 'array', items: { type: 'string' } } } } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "runFixes", null);
__decorate([
    (0, common_1.Post)('runs/content'),
    (0, swagger_1.ApiOperation)({ summary: 'Commit drafted pages to the repo and open a PR' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    (0, swagger_1.ApiBody)({ required: false, schema: { type: 'object', properties: { pieceIds: { type: 'array', items: { type: 'string' } } } } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('projectId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "runContent", null);
__decorate([
    (0, common_1.Get)('runs'),
    (0, swagger_1.ApiOperation)({ summary: 'History of automation runs, with per-step logs' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "listRuns", null);
exports.AutomationController = AutomationController = __decorate([
    (0, swagger_1.ApiTags)('Autonomous engineer'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/projects/:projectId/automation'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, entitlements_guard_1.EntitlementsGuard),
    (0, entitlements_decorator_1.OrgFrom)('project', 'projectId'),
    (0, entitlements_decorator_1.RequiresFeature)(plans_catalog_1.Feature.AUTO_FIX_DEPLOY),
    __metadata("design:paramtypes", [automation_service_1.AutomationService,
        content_generation_service_1.ContentGenerationService])
], AutomationController);
//# sourceMappingURL=automation.controller.js.map