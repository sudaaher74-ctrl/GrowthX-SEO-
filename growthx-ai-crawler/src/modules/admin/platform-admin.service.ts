import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export function parseConfiguredAdminUserIds(raw: string | undefined = process.env.PLATFORM_ADMIN_USER_IDS): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

/**
 * Single source of truth for platform-operator authorization across the API.
 *
 * Security invariants:
 * - Never trusts email strings or hard-coded addresses.
 * - Requires an immutable User.id that exists in the database.
 * - Requires verified ownership (`emailVerifiedAt != null`) so public password
 *   signups can never claim operator privileges.
 * - Denies any explicitly revoked operator (`platformAdminRevokedAt != null`)
 *   even if their user ID still appears in `PLATFORM_ADMIN_USER_IDS`.
 * - Fails closed when unconfigured.
 */
@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async isPlatformAdmin(userId: string | null | undefined): Promise<boolean> {
    const normalizedId = typeof userId === 'string' ? userId.trim() : '';
    if (!normalizedId || !this.prisma?.user?.findUnique) {
      return false;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: normalizedId },
      select: {
        id: true,
        emailVerifiedAt: true,
        isPlatformAdmin: true,
        platformAdminRevokedAt: true,
      },
    });

    if (!user) return false;
    if (!user.emailVerifiedAt) return false;
    if (user.platformAdminRevokedAt) return false;

    if (user.isPlatformAdmin) return true;

    const configuredIds = parseConfiguredAdminUserIds();
    return configuredIds.has(user.id);
  }

  async assertPlatformAdmin(userId: string | null | undefined): Promise<void> {
    const allowed = await this.isPlatformAdmin(userId);
    if (!allowed) {
      throw new ForbiddenException('This area is restricted to Reigel platform operators.');
    }
  }
}
