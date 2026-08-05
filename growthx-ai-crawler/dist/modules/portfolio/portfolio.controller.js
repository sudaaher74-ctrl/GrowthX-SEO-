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
exports.PortfolioController = exports.SetRetainerDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const org_context_service_1 = require("../billing/org-context.service");
const portfolio_service_1 = require("./portfolio.service");
class SetRetainerDto {
}
exports.SetRetainerDto = SetRetainerDto;
/** The agency-level view: all clients in one organization. */
let PortfolioController = class PortfolioController {
    constructor(portfolio, orgContext) {
        this.portfolio = portfolio;
        this.orgContext = orgContext;
    }
    async getPortfolio(req, orgId, days) {
        await this.orgContext.assertMembership(req.user.userId, orgId);
        const window = Math.min(180, Math.max(7, parseInt(days ?? '28', 10) || 28));
        return this.portfolio.getPortfolio(orgId, window);
    }
    async setRetainer(req, orgId, projectId, body) {
        await this.orgContext.assertMembership(req.user.userId, orgId);
        return this.portfolio.setRetainer(projectId, body);
    }
};
exports.PortfolioController = PortfolioController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Every client with AI share, health, criticals and retainer' }),
    (0, swagger_1.ApiParam)({ name: 'orgId' }),
    (0, swagger_1.ApiQuery)({ name: 'days', required: false, example: 28 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orgId')),
    __param(2, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PortfolioController.prototype, "getPortfolio", null);
__decorate([
    (0, common_1.Patch)('clients/:projectId/retainer'),
    (0, swagger_1.ApiOperation)({ summary: 'Record what a client pays, so MRR is real rather than assumed' }),
    (0, swagger_1.ApiParam)({ name: 'orgId' }),
    (0, swagger_1.ApiParam)({ name: 'projectId' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orgId')),
    __param(2, (0, common_1.Param)('projectId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, SetRetainerDto]),
    __metadata("design:returntype", Promise)
], PortfolioController.prototype, "setRetainer", null);
exports.PortfolioController = PortfolioController = __decorate([
    (0, swagger_1.ApiTags)('Agency portfolio'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/organizations/:orgId/portfolio'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [portfolio_service_1.PortfolioService,
        org_context_service_1.OrgContextService])
], PortfolioController);
//# sourceMappingURL=portfolio.controller.js.map