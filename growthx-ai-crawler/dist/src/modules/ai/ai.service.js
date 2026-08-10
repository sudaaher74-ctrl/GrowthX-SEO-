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
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const multi_ai_router_service_1 = require("../ai-search/multi-ai-router/multi-ai-router.service");
/** Constrains the model to exactly the shape we persist. */
const ANALYSIS_SCHEMA = {
    type: 'object',
    properties: {
        whyItMatters: { type: 'string' },
        seoImpact: { type: 'string' },
        businessImpact: { type: 'string' },
        priorityScore: { type: 'integer' },
        recommendedFix: { type: 'string' },
        expectedOutcome: { type: 'string' },
    },
    required: ['whyItMatters', 'seoImpact', 'businessImpact', 'priorityScore', 'recommendedFix', 'expectedOutcome'],
    additionalProperties: false,
};
let AiService = AiService_1 = class AiService {
    constructor(prisma, router) {
        this.prisma = prisma;
        this.router = router;
        this.logger = new common_1.Logger(AiService_1.name);
    }
    /**
     * Explains an SEO issue: why it matters, its SEO and business impact, and how
     * to fix it. Which model answers depends on the organization's plan — Gemini
     * on Starter, Claude or GPT on Pro — and is enforced by the router.
     *
     * With no provider configured (or on any model failure) this falls back to a
     * deterministic SEO rules engine, so the product still returns real guidance
     * rather than an error.
     */
    async analyzeIssue(issueId, organizationId) {
        const issue = await this.prisma.issue.findUnique({
            where: { id: issueId },
            include: { page: true },
        });
        if (!issue) {
            throw new Error(`Issue with ID ${issueId} not found`);
        }
        this.logger.log(`Analyzing ${issue.issueType} on ${issue.affectedUrl}...`);
        let analysis;
        let generatedByModel = 'rules-engine';
        try {
            const completion = await this.router.generate({
                prompt: this.buildPrompt(issue),
                systemInstruction: 'You are a Staff Technical SEO and growth architect. Be specific and actionable. ' +
                    'Respond with JSON matching the requested schema and nothing else.',
                task: multi_ai_router_service_1.AiTask.REASONING,
                organizationId,
                jsonSchema: ANALYSIS_SCHEMA,
            });
            if (completion.refused || !completion.text.trim()) {
                throw new Error('Model returned no usable content.');
            }
            analysis = this.parseAnalysis(completion.text, issue);
            generatedByModel = completion.model;
            this.logger.log(`Analysis from ${completion.provider}/${completion.model} ` +
                `(${completion.usage.inputTokens}in/${completion.usage.outputTokens}out` +
                `${completion.usage.estimatedCostUsd !== null ? `, $${completion.usage.estimatedCostUsd}` : ''})`);
        }
        catch (error) {
            this.logger.warn(`AI analysis unavailable (${error.message}); using the SEO rules engine.`);
            analysis = this.generateDeterministicAnalysis(issue.issueType, issue.severity, issue.affectedUrl, issue.description);
        }
        const record = {
            whyItMatters: analysis.whyItMatters,
            seoImpact: analysis.seoImpact,
            businessImpact: analysis.businessImpact,
            priorityScore: analysis.priorityScore,
            recommendedFixPatch: analysis.recommendedFix,
            expectedOutcome: analysis.expectedOutcome,
            generatedByModel,
            status: 'PENDING_APPROVAL',
        };
        await this.prisma.aIRecommendation.upsert({
            where: { issueId: issue.id },
            update: record,
            create: { issueId: issue.id, ...record },
        });
        await this.prisma.issue.update({
            where: { id: issue.id },
            data: { aiFixAvailable: true },
        });
        return analysis;
    }
    buildPrompt(issue) {
        return [
            'Analyze this technical SEO issue found during a site crawl.',
            `Issue type: ${issue.issueType}`,
            `Severity: ${issue.severity}`,
            `URL: ${issue.affectedUrl}`,
            `Detected: ${issue.description}`,
            '',
            'priorityScore is 1-100, weighted by how much fixing this moves organic traffic.',
            'recommendedFix must be concrete enough to implement without further research.',
        ].join('\n');
    }
    /** Tolerates a model that wraps its JSON in prose or a code fence. */
    parseAnalysis(text, issue) {
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
        const parsed = JSON.parse(candidate);
        const required = ['whyItMatters', 'seoImpact', 'businessImpact', 'recommendedFix', 'expectedOutcome'];
        for (const field of required) {
            if (typeof parsed[field] !== 'string' || !parsed[field].trim()) {
                throw new Error(`Model response is missing "${field}".`);
            }
        }
        const score = Number(parsed.priorityScore);
        return {
            whyItMatters: parsed.whyItMatters,
            seoImpact: parsed.seoImpact,
            businessImpact: parsed.businessImpact,
            priorityScore: Number.isFinite(score)
                ? Math.min(100, Math.max(1, Math.round(score)))
                : this.severityScore(issue.severity),
            recommendedFix: parsed.recommendedFix,
            expectedOutcome: parsed.expectedOutcome,
        };
    }
    severityScore(severity) {
        return { CRITICAL: 95, HIGH: 80, MEDIUM: 55, LOW: 30 }[severity] ?? 60;
    }
    /**
     * High-quality deterministic SEO intelligence fallback
     */
    generateDeterministicAnalysis(issueType, severity, url, description) {
        const priorityMap = {
            CRITICAL: 95,
            HIGH: 80,
            MEDIUM: 55,
            LOW: 30,
        };
        switch (issueType) {
            case 'MISSING_TITLE':
            case 'SHORT_TITLE':
            case 'LONG_TITLE':
                return {
                    whyItMatters: 'The HTML <title> tag is the single most critical on-page SEO element used by Google algorithms to understand topic relevancy and generate SERP snippets.',
                    seoImpact: 'Improper titles cause immediate drops in keyword relevancy scores and lead to Google rewriting snippets in search results.',
                    businessImpact: 'Lower SERP click-through rates (CTR) directly reduce organic user acquisition and pipeline velocity.',
                    priorityScore: priorityMap[severity] || 85,
                    recommendedFix: 'Craft a compelling title tag between 50-58 characters featuring primary target keywords at the front and brand modifier at the end.',
                    expectedOutcome: '15-25% increase in organic SERP click-through rate within 14 days of recrawling.',
                };
            case 'MISSING_META_DESCRIPTION':
                return {
                    whyItMatters: 'While meta descriptions are not a direct ranking factor, they act as ad copy in SERPs that persuades searchers to click your result over competitors.',
                    seoImpact: 'Missing meta descriptions force search engines to extract random sentences from the page body, often resulting in unappealing snippets.',
                    businessImpact: 'Depressed CTR leads to lost organic traffic and lower conversion opportunities.',
                    priorityScore: priorityMap[severity] || 75,
                    recommendedFix: 'Write a persuasive 130-155 character summary containing a clear value proposition and call to action.',
                    expectedOutcome: 'Up to 10% lift in organic traffic CTR from improved SERP appearance.',
                };
            case 'MISSING_ALT_TEXT':
                return {
                    whyItMatters: 'Image alt attributes provide semantic context for visually impaired screen reader users and search engine bots unable to process visual pixels directly.',
                    seoImpact: 'Loss of ranking eligibility in Google Image Search and reduced topical authority for surrounding text.',
                    businessImpact: 'Risk of web accessibility (WCAG/ADA) compliance failures and lost image-based organic traffic.',
                    priorityScore: priorityMap[severity] || 70,
                    recommendedFix: 'Add descriptive, natural language alt attributes (5-10 words) describing image content accurately without keyword stuffing.',
                    expectedOutcome: 'Enhanced WCAG accessibility compliance and incremental traffic from image search carousels.',
                };
            case 'MISSING_CANONICAL':
            case 'BROKEN_CANONICAL':
                return {
                    whyItMatters: 'Canonical tags instruct Google which version of a URL is the definitive master copy when parameters, tracking tags, or duplicate paths exist.',
                    seoImpact: 'Without valid canonicals, link equity is diluted across duplicate URL variations and crawl budget is wasted.',
                    businessImpact: 'Key landing pages may drop out of the index or get outranked by duplicate tracking URLs.',
                    priorityScore: priorityMap[severity] || 85,
                    recommendedFix: 'Inject a self-referencing <link rel="canonical" href="https://target-url.com/path" /> tag in the HTML head.',
                    expectedOutcome: 'Consolidation of ranking signals and elimination of duplicate content penalties.',
                };
            default:
                return {
                    whyItMatters: `This ${severity} technical SEO issue impairs crawler efficiency and user experience on ${url}.`,
                    seoImpact: 'Reduces overall domain technical health score and can impede deep page indexing.',
                    businessImpact: 'Suboptimal technical SEO performance limits organic growth potential.',
                    priorityScore: priorityMap[severity] || 60,
                    recommendedFix: description,
                    expectedOutcome: 'Improved site crawlability, technical health score, and organic ranking stability.',
                };
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        multi_ai_router_service_1.MultiAiRouterService])
], AiService);
//# sourceMappingURL=ai.service.js.map