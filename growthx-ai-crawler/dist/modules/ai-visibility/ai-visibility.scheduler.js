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
var AiVisibilityScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiVisibilityScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma.service");
const entitlements_service_1 = require("../billing/entitlements.service");
const plans_catalog_1 = require("../billing/plans.catalog");
const ai_visibility_service_1 = require("./ai-visibility.service");
/**
 * Daily citation sweep. The dashboard's trend line is only meaningful if the
 * checks run on a schedule rather than when someone happens to open the page.
 */
let AiVisibilityScheduler = AiVisibilityScheduler_1 = class AiVisibilityScheduler {
    constructor(prisma, visibility, entitlements) {
        this.prisma = prisma;
        this.visibility = visibility;
        this.entitlements = entitlements;
        this.logger = new common_1.Logger(AiVisibilityScheduler_1.name);
    }
    /** 06:00 UTC, matching the rank-tracking cadence the dashboard advertises. */
    async handleDailySweep() {
        if (process.env.AI_VISIBILITY_SWEEP_ENABLED === 'false') {
            this.logger.log('Daily AI visibility sweep is disabled by configuration.');
            return;
        }
        const projects = await this.prisma.project.findMany({
            where: { prompts: { some: { isActive: true } } },
            select: { id: true, name: true, organizationId: true },
        });
        this.logger.log(`Daily AI visibility sweep: ${projects.length} project(s) with active prompts.`);
        for (const project of projects) {
            try {
                // Skip quietly rather than throwing: a lapsed plan is an expected state
                // for a scheduled job, not an error worth alerting on.
                const { plan } = await this.entitlements.resolvePlan(project.organizationId);
                const entitled = await this.entitlements.hasFeature(project.organizationId, plans_catalog_1.Feature.AI_VISIBILITY);
                if (!entitled) {
                    this.logger.debug(`Skipping ${project.name}: ${plan} does not include AI visibility.`);
                    continue;
                }
                const quota = await this.entitlements.checkQuota(project.organizationId, client_1.UsageMetric.AI_VISIBILITY_CHECKS);
                if (!quota.allowed) {
                    this.logger.warn(`Skipping ${project.name}: AI visibility allowance exhausted for this period.`);
                    continue;
                }
                const result = await this.visibility.sweepProject(project.id);
                this.logger.log(`${project.name}: ${result.checksRun} checks, ${result.citations} citations, ` +
                    `${result.checksFailed} failed.`);
            }
            catch (error) {
                // One bad project must not abort the sweep for everyone else.
                this.logger.error(`Sweep failed for project ${project.id}: ${error.message}`);
            }
        }
    }
    /** Exposed for the admin "run now" path and for tests. */
    async sweepOne(projectId) {
        return this.visibility.sweepProject(projectId);
    }
};
exports.AiVisibilityScheduler = AiVisibilityScheduler;
__decorate([
    (0, schedule_1.Cron)('0 6 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AiVisibilityScheduler.prototype, "handleDailySweep", null);
exports.AiVisibilityScheduler = AiVisibilityScheduler = AiVisibilityScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_visibility_service_1.AiVisibilityService,
        entitlements_service_1.EntitlementsService])
], AiVisibilityScheduler);
//# sourceMappingURL=ai-visibility.scheduler.js.map