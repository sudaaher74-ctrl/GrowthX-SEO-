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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgContextService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
/**
 * Works out which organization a request is acting on, and confirms the caller
 * is a member of it. Without this, plan gating would be trivially bypassed by
 * passing someone else's organization id.
 */
let OrgContextService = class OrgContextService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Resolution order:
     *   1. the resource named by `@OrgFrom(...)`, traced back to its organization
     *   2. an explicit id in the route params, body, query, or `x-organization-id`
     *   3. the caller's organization, when they belong to exactly one
     */
    async resolve(request, source) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new common_1.ForbiddenException('Authentication is required for billed operations.');
        }
        const fromResource = source ? await this.fromResource(request, source) : null;
        const organizationId = fromResource ?? this.explicitId(request) ?? (await this.soleOrganization(userId));
        if (!organizationId) {
            throw new common_1.BadRequestException('Could not determine the organization for this request. Pass organizationId or the x-organization-id header.');
        }
        await this.assertMembership(userId, organizationId);
        return organizationId;
    }
    explicitId(request) {
        return (request.params?.organizationId ??
            request.params?.orgId ??
            request.body?.organizationId ??
            request.query?.organizationId ??
            request.headers?.['x-organization-id'] ??
            null);
    }
    async soleOrganization(userId) {
        const memberships = await this.prisma.organizationMember.findMany({
            where: { userId },
            select: { organizationId: true },
            take: 2,
        });
        return memberships.length === 1 ? memberships[0].organizationId : null;
    }
    async fromResource(request, source) {
        const id = request.params?.[source.param];
        if (!id)
            return null;
        switch (source.resource) {
            case 'organization':
                return id;
            case 'project': {
                const project = await this.prisma.project.findUnique({ where: { id }, select: { organizationId: true } });
                if (!project)
                    throw new common_1.NotFoundException('Project not found');
                return project.organizationId;
            }
            case 'website': {
                const website = await this.prisma.website.findUnique({
                    where: { id },
                    select: { project: { select: { organizationId: true } } },
                });
                if (!website)
                    throw new common_1.NotFoundException('Website not found');
                return website.project?.organizationId ?? null;
            }
            case 'crawlJob': {
                const job = await this.prisma.crawlJob.findUnique({
                    where: { id },
                    select: { website: { select: { project: { select: { organizationId: true } } } } },
                });
                if (!job)
                    throw new common_1.NotFoundException('Crawl job not found');
                return job.website.project?.organizationId ?? null;
            }
            case 'issue': {
                const issue = await this.prisma.issue.findUnique({
                    where: { id },
                    select: { crawlJob: { select: { website: { select: { project: { select: { organizationId: true } } } } } } },
                });
                if (!issue)
                    throw new common_1.NotFoundException('Issue not found');
                return issue.crawlJob.website.project?.organizationId ?? null;
            }
        }
    }
    async assertMembership(userId, organizationId) {
        const membership = await this.prisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId, organizationId } },
            select: { id: true },
        });
        if (!membership) {
            throw new common_1.ForbiddenException('You do not have access to this organization.');
        }
    }
};
exports.OrgContextService = OrgContextService;
exports.OrgContextService = OrgContextService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrgContextService);
//# sourceMappingURL=org-context.service.js.map