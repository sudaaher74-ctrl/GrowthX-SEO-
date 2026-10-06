import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, User } from '@prisma/client';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private projectsService: ProjectsService,
  ) {}

  /**
   * Case-insensitive: accounts created before emails were normalised may be
   * stored as typed ("Priya@Shop.in"), and the owner must still be able to
   * sign in as "priya@shop.in". The oldest match wins if both spellings exist.
   */
  async findByEmail(email: string): Promise<User | null> {
    const wanted = String(email ?? '').trim();
    if (!wanted) return null;
    return this.prisma.user.findFirst({
      where: { email: { equals: wanted, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  /**
   * Safely deletes a user account and cleanly disposes of or detaches
   * user-owned data following tenant isolation and GDPR/DPDP rules:
   *
   * 1. Inspects all organizations where the user is a member.
   *    - If sole member: cleanly deletes all organization projects (with Google revokes)
   *      and deletes the organization.
   *    - If multi-member: removes user's membership so workspace remains operational for others.
   * 2. Anonymizes audit logs (`userId = null`) to maintain compliance audit trails
   *    without foreign key violations.
   * 3. Deletes user-specific sessions (VoiceSession + cascades, RefreshSession, LoginCode).
   * 4. Deletes the User row.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;

    this.logger.log(`SECURITY_EVENT ACCOUNT_DELETION_INITIATED user=${userId} email=${user.email}`);

    // 1. Memberships and organizations
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });

    for (const membership of memberships) {
      const memberCount = await this.prisma.organizationMember.count({
        where: { organizationId: membership.organizationId },
      });

      if (memberCount <= 1) {
        // Sole member: clean up organization's projects first
        const projects = await this.prisma.project.findMany({
          where: { organizationId: membership.organizationId },
          select: { id: true },
        });

        for (const proj of projects) {
          await this.projectsService.deleteProject(proj.id);
        }

        await this.prisma.organization.delete({
          where: { id: membership.organizationId },
        });
      } else {
        // Multi-member: detach membership
        await this.prisma.organizationMember.deleteMany({
          where: { userId, organizationId: membership.organizationId },
        });
      }
    }

    // 2. Anonymize audit logs
    await this.prisma.auditLog.updateMany({
      where: { userId },
      data: { userId: null },
    });

    // 3. User-specific transient / voice sessions
    await this.prisma.voiceSession.deleteMany({
      where: { userId },
    });
    await this.prisma.loginCode.deleteMany({
      where: { userId },
    });
    await this.prisma.refreshSession.deleteMany({
      where: { userId },
    });

    // 4. Delete the user
    await this.prisma.user.delete({
      where: { id: userId },
    });

    this.logger.log(`SECURITY_EVENT ACCOUNT_DELETED user=${userId}`);
  }
}
