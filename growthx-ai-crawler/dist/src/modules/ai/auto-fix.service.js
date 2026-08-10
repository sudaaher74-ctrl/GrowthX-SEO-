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
var AutoFixService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoFixService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const multi_ai_router_service_1 = require("../ai-search/multi-ai-router/multi-ai-router.service");
const fix_generator_1 = require("./fix-generator");
let AutoFixService = AutoFixService_1 = class AutoFixService {
    constructor(prisma, router) {
        this.prisma = prisma;
        this.router = router;
        this.logger = new common_1.Logger(AutoFixService_1.name);
    }
    /**
     * Proposes a concrete patch for an issue, written from the customer's own
     * page content. Nothing is applied here — Module 16 requires approval first.
     *
     * If no model is reachable, a deterministic fallback derived from the page is
     * used instead. Both paths are grounded in the customer's page: a patch must
     * never carry our product name, an invented price, or a made-up claim.
     */
    async generateFixPatch(issueId, organizationId) {
        const issue = await this.prisma.issue.findUnique({
            where: { id: issueId },
            include: { page: true, aiRecommendation: true },
        });
        if (!issue || !issue.page) {
            throw new common_1.NotFoundException(`Issue or associated page not found for ID ${issueId}`);
        }
        const page = {
            url: issue.affectedUrl,
            title: issue.page.title,
            metaDescription: issue.page.metaDescription,
            canonicalUrl: issue.page.canonicalUrl,
            h1: issue.page.h1,
            h2: issue.page.h2,
            wordCount: issue.page.wordCount,
        };
        const plan = (0, fix_generator_1.planFix)(issue.issueType, page, issue.recommendation);
        this.logger.log(`Generating ${plan.fixType} patch for ${issue.affectedUrl}...`);
        let rendered = null;
        let source = 'heuristic';
        let model;
        // Some fixes (canonical URLs, breadcrumbs) are derived, not written — an
        // empty prompt marks those and skips the model entirely.
        if (plan.prompt) {
            try {
                const completion = await this.router.generate({
                    prompt: plan.prompt,
                    systemInstruction: 'You are a technical SEO editor writing production copy for a client site. ' +
                        'Respond only with JSON matching the schema.',
                    task: multi_ai_router_service_1.AiTask.REASONING,
                    organizationId,
                    jsonSchema: plan.schema,
                });
                if (!completion.refused && completion.text.trim()) {
                    rendered = (0, fix_generator_1.renderFromModel)(plan, this.parseJson(completion.text), page);
                    if (rendered) {
                        source = 'model';
                        model = completion.model;
                    }
                }
            }
            catch (error) {
                this.logger.warn(`Model unavailable for ${plan.fixType} (${error.message}); using the derived fallback.`);
            }
        }
        if (!rendered)
            rendered = plan.heuristic();
        const patch = {
            fixType: plan.fixType,
            targetUrl: issue.affectedUrl,
            originalValue: plan.originalValue,
            proposedValue: rendered.proposedValue,
            codeSnippet: rendered.codeSnippet,
            source,
            model,
        };
        await this.prisma.aIRecommendation.upsert({
            where: { issueId: issue.id },
            update: { recommendedFixPatch: JSON.stringify(patch, null, 2), status: 'PENDING_APPROVAL' },
            create: {
                issueId: issue.id,
                whyItMatters: issue.aiRecommendation?.whyItMatters || 'Improves technical SEO health.',
                seoImpact: issue.aiRecommendation?.seoImpact || 'Positive ranking signal.',
                businessImpact: issue.aiRecommendation?.businessImpact || 'Higher traffic retention.',
                priorityScore: issue.aiRecommendation?.priorityScore || 75,
                recommendedFixPatch: JSON.stringify(patch, null, 2),
                expectedOutcome: issue.aiRecommendation?.expectedOutcome || 'Resolved audit issue.',
                generatedByModel: model ?? 'rules-engine',
                status: 'PENDING_APPROVAL',
            },
        });
        return patch;
    }
    /** Tolerates a model that wraps JSON in prose or a code fence. */
    parseJson(text) {
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
        try {
            return JSON.parse(candidate);
        }
        catch {
            return {};
        }
    }
    /**
     * User approves the AI recommendation.
     * Module 16: Every change requires user approval before execution.
     */
    async approveAndExecuteFix(issueId, approvedByUserId) {
        const rec = await this.prisma.aIRecommendation.findUnique({
            where: { issueId },
            include: { issue: true },
        });
        if (!rec) {
            throw new common_1.NotFoundException(`No AI recommendation found for issue ID ${issueId}`);
        }
        if (rec.status !== 'PENDING_APPROVAL') {
            throw new common_1.BadRequestException(`Recommendation is currently in status ${rec.status} and cannot be re-approved.`);
        }
        this.logger.log(`User ${approvedByUserId} APPROVED fix for issue ${issueId}. Executing automated workflow...`);
        // In a live integration, this would trigger an API call to CMS/GitHub PR or database update.
        // We record state change to 'APPROVED' and then 'APPLIED'.
        await this.prisma.aIRecommendation.update({
            where: { issueId },
            data: {
                status: 'APPLIED',
                approvedBy: approvedByUserId,
                appliedAt: new Date(),
            },
        });
        await this.prisma.issue.update({
            where: { id: issueId },
            data: { status: 'RESOLVED' },
        });
        let parsedPatch = {};
        try {
            parsedPatch = JSON.parse(rec.recommendedFixPatch);
        }
        catch {
            parsedPatch = { text: rec.recommendedFixPatch };
        }
        return {
            success: true,
            message: `Successfully approved and applied AI fix patch for issue on ${rec.issue.affectedUrl}. Issue marked RESOLVED.`,
            patch: parsedPatch,
        };
    }
    async rejectFix(issueId, rejectedByUserId) {
        await this.prisma.aIRecommendation.update({
            where: { issueId },
            data: {
                status: 'REJECTED',
                approvedBy: rejectedByUserId,
            },
        });
        await this.prisma.issue.update({
            where: { id: issueId },
            data: { status: 'IGNORED' },
        });
        return { success: true, message: `Recommendation for issue ${issueId} rejected and marked IGNORED.` };
    }
};
exports.AutoFixService = AutoFixService;
exports.AutoFixService = AutoFixService = AutoFixService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        multi_ai_router_service_1.MultiAiRouterService])
], AutoFixService);
//# sourceMappingURL=auto-fix.service.js.map