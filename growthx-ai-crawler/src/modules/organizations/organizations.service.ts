import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, Organization, Role } from '@prisma/client';

/** Roles that can manage other members — everyone else can only view. */
const MANAGER_ROLES: ReadonlySet<Role> = new Set([Role.OWNER, Role.ADMIN]);

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async createOrganization(userId: string, data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data });
      
      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: org.id,
          role: Role.OWNER,
        },
      });

      return org;
    });
  }

  async getOrganizationsForUser(userId: string): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
    });
  }

  async listMembers(organizationId: string) {
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
  async addMember(organizationId: string, requesterId: string, email: string, role: Role) {
    await this.assertManager(organizationId, requesterId);

    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      throw new NotFoundException(
        `No GrowthX AI account exists for ${email}. They need to create one at /register before you can add them to this organization.`,
      );
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });
    if (existing) throw new ConflictException(`${email} is already a member of this organization.`);

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

  async updateMemberRole(organizationId: string, requesterId: string, memberId: string, role: Role) {
    await this.assertManager(organizationId, requesterId);
    const member = await this.requireMember(organizationId, memberId);

    if (member.role === Role.OWNER && role !== Role.OWNER) {
      await this.assertNotLastOwner(organizationId, member.id);
    }

    return this.prisma.organizationMember.update({ where: { id: memberId }, data: { role } });
  }

  async removeMember(organizationId: string, requesterId: string, memberId: string) {
    await this.assertManager(organizationId, requesterId);
    const member = await this.requireMember(organizationId, memberId);

    if (member.role === Role.OWNER) {
      await this.assertNotLastOwner(organizationId, member.id);
    }

    await this.prisma.organizationMember.delete({ where: { id: memberId } });
  }

  private async requireMember(organizationId: string, memberId: string) {
    const member = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId } });
    if (!member) throw new NotFoundException('Member not found in this organization.');
    return member;
  }

  private async assertManager(organizationId: string, requesterId: string) {
    const requester = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: requesterId, organizationId } },
    });
    if (!requester || !MANAGER_ROLES.has(requester.role)) {
      throw new ForbiddenException('Only owners and admins can manage team members.');
    }
  }

  private async assertNotLastOwner(organizationId: string, excludingMemberId: string) {
    const otherOwners = await this.prisma.organizationMember.count({
      where: { organizationId, role: Role.OWNER, id: { not: excludingMemberId } },
    });
    if (otherOwners === 0) {
      throw new ConflictException('An organization must keep at least one owner.');
    }
  }
}

