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
exports.OrganizationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const client_1 = require("@prisma/client");
/** Roles that can manage other members — everyone else can only view. */
const MANAGER_ROLES = new Set([client_1.Role.OWNER, client_1.Role.ADMIN]);
let OrganizationsService = class OrganizationsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createOrganization(userId, data) {
        return this.prisma.$transaction(async (tx) => {
            const org = await tx.organization.create({ data });
            await tx.organizationMember.create({
                data: {
                    userId,
                    organizationId: org.id,
                    role: client_1.Role.OWNER,
                },
            });
            return org;
        });
    }
    async getOrganizationsForUser(userId) {
        return this.prisma.organization.findMany({
            where: {
                members: {
                    some: { userId },
                },
            },
        });
    }
    async listMembers(organizationId) {
        const members = await this.prisma.organizationMember.findMany({
            where: { organizationId },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: 'asc' },
        });
        return members.map((m) => ({
            id: m.id,
            role: m.role,
            joinedAt: m.createdAt,
            userId: m.user.id,
            email: m.user.email,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
        }));
    }
    /**
     * Attaches an already-registered user to the org by email.
     *
     * There is no outbound email in this system yet, so this cannot invite
     * someone who hasn't signed up — it can only be honest about that rather
     * than pretending to send an invite that never arrives.
     */
    async addMember(organizationId, requesterId, email, role) {
        await this.assertManager(organizationId, requesterId);
        const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (!user) {
            throw new common_1.NotFoundException(`No GrowthX AI account exists for ${email}. They need to create one at /register before you can add them to this organization.`);
        }
        const existing = await this.prisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId: user.id, organizationId } },
        });
        if (existing)
            throw new common_1.ConflictException(`${email} is already a member of this organization.`);
        const member = await this.prisma.organizationMember.create({
            data: { userId: user.id, organizationId, role },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        });
        return {
            id: member.id,
            role: member.role,
            joinedAt: member.createdAt,
            userId: member.user.id,
            email: member.user.email,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
        };
    }
    async updateMemberRole(organizationId, requesterId, memberId, role) {
        await this.assertManager(organizationId, requesterId);
        const member = await this.requireMember(organizationId, memberId);
        if (member.role === client_1.Role.OWNER && role !== client_1.Role.OWNER) {
            await this.assertNotLastOwner(organizationId, member.id);
        }
        return this.prisma.organizationMember.update({ where: { id: memberId }, data: { role } });
    }
    async removeMember(organizationId, requesterId, memberId) {
        await this.assertManager(organizationId, requesterId);
        const member = await this.requireMember(organizationId, memberId);
        if (member.role === client_1.Role.OWNER) {
            await this.assertNotLastOwner(organizationId, member.id);
        }
        await this.prisma.organizationMember.delete({ where: { id: memberId } });
    }
    async requireMember(organizationId, memberId) {
        const member = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId } });
        if (!member)
            throw new common_1.NotFoundException('Member not found in this organization.');
        return member;
    }
    async assertManager(organizationId, requesterId) {
        const requester = await this.prisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId: requesterId, organizationId } },
        });
        if (!requester || !MANAGER_ROLES.has(requester.role)) {
            throw new common_1.ForbiddenException('Only owners and admins can manage team members.');
        }
    }
    async assertNotLastOwner(organizationId, excludingMemberId) {
        const otherOwners = await this.prisma.organizationMember.count({
            where: { organizationId, role: client_1.Role.OWNER, id: { not: excludingMemberId } },
        });
        if (otherOwners === 0) {
            throw new common_1.ConflictException('An organization must keep at least one owner.');
        }
    }
};
exports.OrganizationsService = OrganizationsService;
exports.OrganizationsService = OrganizationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrganizationsService);
//# sourceMappingURL=organizations.service.js.map