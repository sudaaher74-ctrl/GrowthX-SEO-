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
var AiVisibilityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiVisibilityService = exports.SUPPORTED_ASSISTANTS = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma.service");
const multi_ai_router_service_1 = require("../ai-search/multi-ai-router/multi-ai-router.service");
const entitlements_service_1 = require("../billing/entitlements.service");
const plans_catalog_1 = require("../billing/plans.catalog");
const citation_detector_1 = require("./citation/citation-detector");
const visibility_report_1 = require("./citation/visibility-report");
/**
 * Which assistants we can genuinely query.
 *
 * Perplexity, Google AI Overviews, and Copilot have no API we can drive, so a
 * check against them records an explicit error instead of a fabricated result.
 * Wiring one up later means adding an entry here and nothing else.
 */
const ASSISTANT_PROVIDER = {
    [client_1.AiAssistant.CHATGPT]: multi_ai_router_service_1.AiProvider.OPENAI,
    [client_1.AiAssistant.CLAUDE]: multi_ai_router_service_1.AiProvider.ANTHROPIC,
    [client_1.AiAssistant.GEMINI]: multi_ai_router_service_1.AiProvider.GEMINI,
};
exports.SUPPORTED_ASSISTANTS = Object.keys(ASSISTANT_PROVIDER);
const UNSUPPORTED_REASON = 'No public API is available for this assistant, so its citation share cannot be measured directly.';
/** Keeps stored evidence useful without bloating the table. */
const EXCERPT_LIMIT = 2000;
let AiVisibilityService = AiVisibilityService_1 = class AiVisibilityService {
    constructor(prisma, router, entitlements) {
        this.prisma = prisma;
        this.router = router;
        this.entitlements = entitlements;
        this.logger = new common_1.Logger(AiVisibilityService_1.name);
    }
    /** Resolves everything a citation check needs to know about the customer. */
    async loadContext(projectId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: { websites: { select: { domain: true } }, competitors: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const ownDomains = project.websites.map((w) => (0, citation_detector_1.normalizeDomain)(w.domain)).filter(Boolean);
        if (ownDomains.length === 0) {
            throw new common_1.BadRequestException('Add at least one website to this project before tracking AI visibility — ' +
                'without a domain there is nothing to look for in the answers.');
        }
        const competitorLabels = {};
        const competitors = project.competitors.map((c) => {
            const domain = (0, citation_detector_1.normalizeDomain)(c.domain);
            if (c.label)
                competitorLabels[domain] = c.label;
            return { domain, names: c.label ? [c.label] : undefined };
        });
        return {
            organizationId: project.organizationId,
            ownDomains,
            // The project name is usually the brand, which catches "Northwind Outdoors"
            // where the domain label alone ("northwindoutdoors") would not.
            ownBrandNames: [project.name].filter(Boolean),
            competitors,
            competitorLabels,
        };
    }
    /**
     * Asks one assistant one prompt and records whether the customer was cited.
     *
     * A failure is persisted as a check with `error` set rather than swallowed,
     * so "we could not ask" never silently reads as "you were not cited".
     */
    async runCheck(trackedPromptId, assistant, context) {
        const prompt = await this.prisma.trackedPrompt.findUnique({ where: { id: trackedPromptId } });
        if (!prompt)
            throw new common_1.NotFoundException('Tracked prompt not found');
        const provider = ASSISTANT_PROVIDER[assistant];
        if (!provider) {
            return this.prisma.promptCheck.create({
                data: { trackedPromptId, assistant, error: UNSUPPORTED_REASON },
            });
        }
        try {
            const completion = await this.router.generate({
                prompt: prompt.text,
                // Asked as a plain end-user question on purpose: we want the answer a
                // real person would get, not one primed to mention any particular brand.
                systemInstruction: 'Answer as you normally would for a member of the public. ' +
                    'Where you recommend specific companies or products, name them and link them.',
                task: multi_ai_router_service_1.AiTask.REASONING,
                provider,
                organizationId: context.organizationId,
            });
            if (completion.refused) {
                return this.prisma.promptCheck.create({
                    data: { trackedPromptId, assistant, model: completion.model, error: 'Assistant declined to answer.' },
                });
            }
            const detection = (0, citation_detector_1.detectCitation)({
                answer: completion.text,
                ownDomains: context.ownDomains,
                ownBrandNames: context.ownBrandNames,
                competitors: context.competitors,
            });
            return this.prisma.promptCheck.create({
                data: {
                    trackedPromptId,
                    assistant,
                    model: completion.model,
                    cited: detection.cited,
                    position: detection.position,
                    citedUrl: detection.citedUrl,
                    competitorsCited: detection.competitorsCited,
                    answerExcerpt: completion.text.slice(0, EXCERPT_LIMIT),
                },
            });
        }
        catch (error) {
            this.logger.warn(`Check failed for ${assistant} on prompt ${trackedPromptId}: ${error.message}`);
            return this.prisma.promptCheck.create({
                data: { trackedPromptId, assistant, error: String(error.message).slice(0, 500) },
            });
        }
    }
    /**
     * Runs every active prompt against every requested assistant.
     *
     * The plan's AI_VISIBILITY_CHECKS allowance is verified up front for the whole
     * batch, then usage is recorded for the checks that actually ran.
     */
    async sweepProject(projectId, options = {}) {
        const context = await this.loadContext(projectId);
        const assistants = options.assistants?.length ? options.assistants : exports.SUPPORTED_ASSISTANTS;
        const prompts = await this.prisma.trackedPrompt.findMany({
            where: { projectId, isActive: true },
        });
        const skippedAssistants = assistants.filter((a) => !ASSISTANT_PROVIDER[a]);
        const runnable = assistants.filter((a) => ASSISTANT_PROVIDER[a]);
        const planned = prompts.length * runnable.length;
        if (!options.skipEntitlementCheck) {
            await this.entitlements.assertFeature(context.organizationId, plans_catalog_1.Feature.AI_VISIBILITY);
            if (planned > 0) {
                await this.entitlements.assertQuota(context.organizationId, client_1.UsageMetric.AI_VISIBILITY_CHECKS, planned);
            }
        }
        let checksRun = 0;
        let checksFailed = 0;
        let citations = 0;
        for (const prompt of prompts) {
            for (const assistant of runnable) {
                const check = await this.runCheck(prompt.id, assistant, context);
                if (check.error) {
                    checksFailed += 1;
                }
                else {
                    checksRun += 1;
                    if (check.cited)
                        citations += 1;
                }
            }
        }
        // Only successful calls are billed — a provider outage costs the customer nothing.
        if (checksRun > 0) {
            await this.entitlements.recordUsage(context.organizationId, client_1.UsageMetric.AI_VISIBILITY_CHECKS, checksRun);
        }
        this.logger.log(`Swept ${prompts.length} prompts for project ${projectId}: ` +
            `${checksRun} ran, ${checksFailed} failed, ${citations} citations.`);
        return {
            projectId,
            promptsChecked: prompts.length,
            checksRun,
            checksFailed,
            citations,
            skippedAssistants,
        };
    }
    /** The AI Visibility dashboard payload for a project. */
    async getReport(projectId, days = 28) {
        const context = await this.loadContext(projectId);
        const periodEnd = new Date();
        const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000);
        // Reach back two windows so the period-over-period delta needs no second query.
        const since = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);
        const checks = await this.prisma.promptCheck.findMany({
            where: { trackedPrompt: { projectId }, checkedAt: { gte: since } },
            select: {
                assistant: true,
                checkedAt: true,
                cited: true,
                position: true,
                competitorsCited: true,
                error: true,
            },
        });
        return (0, visibility_report_1.buildVisibilityReport)(checks, {
            periodStart,
            periodEnd,
            competitorLabels: context.competitorLabels,
        });
    }
    /** The prompt table beneath the dashboard: latest result per prompt/assistant. */
    async listPrompts(projectId) {
        const prompts = await this.prisma.trackedPrompt.findMany({
            where: { projectId },
            include: { checks: { orderBy: { checkedAt: 'desc' }, take: exports.SUPPORTED_ASSISTANTS.length } },
            orderBy: { createdAt: 'desc' },
        });
        return prompts.map((prompt) => ({
            id: prompt.id,
            text: prompt.text,
            intent: prompt.intent,
            cluster: prompt.cluster,
            estimatedVolume: prompt.estimatedVolume,
            isActive: prompt.isActive,
            latestChecks: prompt.checks.map((check) => ({
                assistant: check.assistant,
                checkedAt: check.checkedAt,
                cited: check.cited,
                position: check.position,
                citedUrl: check.citedUrl,
                competitorsCited: check.competitorsCited,
                error: check.error,
            })),
        }));
    }
    async addPrompts(projectId, prompts) {
        await this.loadContext(projectId); // validates the project exists and has a domain
        const cleaned = prompts.map((p) => p.text?.trim()).filter(Boolean);
        if (cleaned.length === 0)
            throw new common_1.BadRequestException('At least one prompt is required.');
        return this.prisma.$transaction(prompts
            .filter((p) => p.text?.trim())
            .map((p) => this.prisma.trackedPrompt.upsert({
            where: { projectId_text: { projectId, text: p.text.trim() } },
            update: { intent: p.intent, cluster: p.cluster, estimatedVolume: p.estimatedVolume, isActive: true },
            create: {
                projectId,
                text: p.text.trim(),
                intent: p.intent,
                cluster: p.cluster,
                estimatedVolume: p.estimatedVolume,
            },
        })));
    }
    async addCompetitor(projectId, domain, label) {
        const normalized = (0, citation_detector_1.normalizeDomain)(domain);
        if (!normalized)
            throw new common_1.BadRequestException('A competitor domain is required.');
        return this.prisma.competitorDomain.upsert({
            where: { projectId_domain: { projectId, domain: normalized } },
            update: { label },
            create: { projectId, domain: normalized, label },
        });
    }
};
exports.AiVisibilityService = AiVisibilityService;
exports.AiVisibilityService = AiVisibilityService = AiVisibilityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        multi_ai_router_service_1.MultiAiRouterService,
        entitlements_service_1.EntitlementsService])
], AiVisibilityService);
//# sourceMappingURL=ai-visibility.service.js.map