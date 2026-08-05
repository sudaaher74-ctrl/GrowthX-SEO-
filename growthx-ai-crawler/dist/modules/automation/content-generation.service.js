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
var ContentGenerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentGenerationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma.service");
const multi_ai_router_service_1 = require("../ai-search/multi-ai-router/multi-ai-router.service");
const strategy_service_1 = require("../strategy/strategy.service");
/** The shape a generated page must come back in. */
const PAGE_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string', description: 'Page title, 50-58 characters.' },
        metaDescription: { type: 'string', description: 'Meta description, 130-155 characters.' },
        slug: { type: 'string', description: 'URL slug, lowercase and hyphenated, no leading slash.' },
        body: {
            type: 'string',
            description: 'The full page in Markdown. Use ## and ### headings. 800-1500 words. No front matter, no H1 — the title becomes the H1.',
        },
    },
    required: ['title', 'metaDescription', 'slug', 'body'],
    additionalProperties: false,
};
const SYSTEM_PROMPT = 'You are writing a page that will be published on a client\'s live website. ' +
    'Write for their actual customers, in their domain, using only facts evidenced ' +
    'by the brief. Never invent statistics, prices, awards, client names, or ' +
    'testimonials. If you would need a specific number you do not have, write ' +
    'around it. Respond only with JSON matching the schema.';
let ContentGenerationService = ContentGenerationService_1 = class ContentGenerationService {
    constructor(prisma, router, strategy) {
        this.prisma = prisma;
        this.router = router;
        this.strategy = strategy;
        this.logger = new common_1.Logger(ContentGenerationService_1.name);
    }
    /**
     * Turns the latest strategy's content plan into tracked ContentPiece rows.
     *
     * Nothing is written yet — this is the queue an agency reviews before any
     * page is drafted or committed.
     */
    async planFromStrategy(projectId) {
        const latest = await this.prisma.strategyReport.findFirst({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });
        if (!latest) {
            throw new common_1.BadRequestException('Generate a strategy first — the content plan comes from it.');
        }
        const plan = latest.content?.contentPlan;
        if (!Array.isArray(plan) || plan.length === 0) {
            throw new common_1.BadRequestException('The latest strategy contains no content plan.');
        }
        const created = [];
        for (const item of plan) {
            if (!item?.title)
                continue;
            const slug = this.slugify(item.title);
            created.push(await this.prisma.contentPiece.upsert({
                where: { projectId_slug: { projectId, slug } },
                update: { format: item.format, targetQuery: item.targetQuery, rationale: item.why },
                create: {
                    projectId,
                    slug,
                    title: item.title,
                    format: item.format,
                    targetQuery: item.targetQuery,
                    rationale: item.why,
                    status: client_1.ContentPieceStatus.PLANNED,
                },
            }));
        }
        this.logger.log(`Planned ${created.length} content pieces for project ${projectId}.`);
        return created;
    }
    /**
     * Writes the actual page for one planned piece.
     *
     * The brief is built from the same evidence the strategy used, so the page is
     * about this business rather than generically about the topic.
     */
    async draft(pieceId, organizationId) {
        const piece = await this.prisma.contentPiece.findUnique({ where: { id: pieceId } });
        if (!piece)
            throw new common_1.BadRequestException('Content piece not found');
        const evidence = await this.strategy.gatherEvidence(piece.projectId);
        const brief = [
            `# Brief`,
            `Business: ${evidence.business.projectName} (${evidence.business.domains.join(', ')})`,
            `Page to write: ${piece.title}`,
            piece.format ? `Format: ${piece.format}` : '',
            piece.targetQuery ? `Target query: ${piece.targetQuery}` : '',
            piece.rationale ? `Why this page: ${piece.rationale}` : '',
            '',
            `# What this business actually publishes today`,
            ...evidence.site.samplePages.slice(0, 8).map((p) => `- ${p.url} — "${p.title ?? 'untitled'}"`),
            '',
            evidence.aiVisibility.lostPrompts.length
                ? `# Questions competitors are winning\n${evidence.aiVisibility.lostPrompts
                    .map((p) => `- "${p.prompt}" (cited instead: ${p.competitors.join(', ')})`)
                    .join('\n')}`
                : '',
            '',
            'Write the page so it directly answers the target query for this business.',
        ]
            .filter(Boolean)
            .join('\n');
        const completion = await this.router.generate({
            prompt: brief,
            systemInstruction: SYSTEM_PROMPT,
            task: multi_ai_router_service_1.AiTask.REASONING,
            organizationId,
            jsonSchema: PAGE_SCHEMA,
            maxTokens: 16000,
        });
        if (completion.refused || !completion.text.trim()) {
            throw new common_1.ServiceUnavailableException('The model did not return a page. Please retry.');
        }
        const parsed = this.parseJson(completion.text);
        if (!parsed.body || !parsed.title) {
            throw new common_1.ServiceUnavailableException('The model returned an unusable page. Please retry.');
        }
        return this.prisma.contentPiece.update({
            where: { id: pieceId },
            data: {
                title: parsed.title,
                metaDescription: parsed.metaDescription ?? null,
                slug: this.slugify(parsed.slug || parsed.title),
                body: parsed.body,
                generatedByModel: completion.model,
                status: client_1.ContentPieceStatus.DRAFTED,
            },
        });
    }
    /** Renders a drafted piece as the file that gets committed. */
    toMarkdownFile(piece) {
        const frontMatter = [
            '---',
            `title: ${JSON.stringify(piece.title)}`,
            `description: ${JSON.stringify(piece.metaDescription ?? '')}`,
            piece.targetQuery ? `keywords: ${JSON.stringify([piece.targetQuery])}` : '',
            `date: ${new Date().toISOString().slice(0, 10)}`,
            '---',
            '',
        ]
            .filter(Boolean)
            .join('\n');
        return `${frontMatter}${piece.body.trim()}\n`;
    }
    async list(projectId) {
        return this.prisma.contentPiece.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                slug: true,
                format: true,
                targetQuery: true,
                status: true,
                filePath: true,
                generatedByModel: true,
                metaDescription: true,
                createdAt: true,
            },
        });
    }
    slugify(value) {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 80);
    }
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
};
exports.ContentGenerationService = ContentGenerationService;
exports.ContentGenerationService = ContentGenerationService = ContentGenerationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        multi_ai_router_service_1.MultiAiRouterService,
        strategy_service_1.StrategyService])
], ContentGenerationService);
//# sourceMappingURL=content-generation.service.js.map