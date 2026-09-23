import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Organization, Role } from '@prisma/client';

/** Roles that can manage other members — everyone else can only view. */
const MANAGER_ROLES: ReadonlySet<Role> = new Set([Role.OWNER, Role.ADMIN]);

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Only the name and slug come from the client. Passing the request body to
   * Prisma as-is accepted nested writes too — `members: { create: ... }` could
   * attach any user to the new organization, and a budget could be preset.
   */
  async createOrganization(userId: string, input: { name?: unknown; slug?: unknown }): Promise<Organization> {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const slug = typeof input?.slug === 'string' ? input.slug.trim().toLowerCase() : '';
    if (!name || !slug) throw new BadRequestException('An organization needs a name and a slug.');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException('The slug may contain only lowercase letters, numbers and hyphens.');
    }

    const existing = await this.prisma.organization.findUnique({ where: { slug }, select: { id: true } });
    if (existing) throw new ConflictException('That slug is already taken. Choose another.');

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name, slug } });
      
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

  /** Members only: this lists every member's email address. */
  async listMembers(organizationId: string, requesterId: string) {
    const requester = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: requesterId, organizationId } },
      select: { id: true },
    });
    if (!requester) throw new NotFoundException('Organization not found');

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
    assertRole(role);
    const requester = await this.assertManager(organizationId, requesterId);
    if (role === Role.OWNER) assertOwner(requester.role);

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
    assertRole(role);
    const requester = await this.assertManager(organizationId, requesterId);
    const member = await this.requireMember(organizationId, memberId);
    // An admin managing members must not be able to make an owner, or unmake one.
    if (member.role === Role.OWNER || role === Role.OWNER) assertOwner(requester.role);

    if (member.role === Role.OWNER && role !== Role.OWNER) {
      await this.assertNotLastOwner(organizationId, member.id);
    }

    return this.prisma.organizationMember.update({ where: { id: memberId }, data: { role } });
  }

  async removeMember(organizationId: string, requesterId: string, memberId: string) {
    const requester = await this.assertManager(organizationId, requesterId);
    const member = await this.requireMember(organizationId, memberId);
    if (member.role === Role.OWNER) assertOwner(requester.role);

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
    return requester;
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

function assertRole(role: unknown): asserts role is Role {
  if (!Object.values(Role).includes(role as Role)) {
    throw new BadRequestException(`Role must be one of ${Object.values(Role).join(', ')}.`);
  }
}

function assertOwner(role: Role) {
  if (role !== Role.OWNER) {
    throw new ForbiddenException('Only an owner can grant, change or remove the owner role.');
  }
}
