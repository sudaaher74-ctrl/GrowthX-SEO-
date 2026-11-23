#!/usr/bin/env node
/**
 * Safe operator provisioning & migration utility for platform administrators.
 *
 * Platform-admin access is backed strictly by immutable, verified User IDs —
 * never by unverified emails or hard-coded addresses.
 *
 * Usage:
 *   node scripts/manage-platform-admins.js list
 *   node scripts/manage-platform-admins.js grant --user-id <uuid> --confirm-ownership "<evidence>"
 *   node scripts/manage-platform-admins.js revoke --user-id <uuid> --reason "<reason>"
 */
const { PrismaClient } = require('@prisma/client');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'list';
  const prisma = new PrismaClient();

  try {
    if (command === 'list') {
      const envIds = (process.env.PLATFORM_ADMIN_USER_IDS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const admins = await prisma.user.findMany({
        where: {
          OR: [
            { isPlatformAdmin: true },
            ...(envIds.length ? [{ id: { in: envIds } }] : []),
          ],
        },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          isPlatformAdmin: true,
          platformAdminGrantedAt: true,
          platformAdminRevokedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      console.log('Configured PLATFORM_ADMIN_USER_IDS:', envIds.length ? envIds.join(', ') : '(none)');
      console.table(
        admins.map((u) => ({
          id: u.id,
          email: u.email,
          verified: Boolean(u.emailVerifiedAt),
          dbAdmin: u.isPlatformAdmin,
          inEnv: envIds.includes(u.id),
          revoked: Boolean(u.platformAdminRevokedAt),
          effectiveAdmin: Boolean(u.emailVerifiedAt && !u.platformAdminRevokedAt && (u.isPlatformAdmin || envIds.includes(u.id))),
        })),
      );
      return;
    }

    if (command === 'grant') {
      const userId = String(args['user-id'] || '').trim();
      const evidence = String(args['confirm-ownership'] || '').trim();
      if (!userId) {
        console.error('Error: --user-id <uuid> is required.');
        process.exit(1);
      }
      if (evidence.length < 5) {
        console.error('Error: --confirm-ownership "<evidence>" is required to record out-of-band ownership verification.');
        process.exit(1);
      }

      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        console.error(`Error: No user found with id=${userId}.`);
        process.exit(1);
      }

      const now = new Date();
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerifiedAt: existing.emailVerifiedAt ?? now,
          isPlatformAdmin: true,
          platformAdminGrantedAt: now,
          platformAdminRevokedAt: null,
        },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          isPlatformAdmin: true,
          platformAdminGrantedAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: updated.id,
          action: 'PLATFORM_ADMIN_GRANTED',
          details: {
            evidence,
            grantedAt: now.toISOString(),
          },
        },
      });

      console.log('Platform-admin granted:', updated);
      console.log(`Optional deployment pin: PLATFORM_ADMIN_USER_IDS=${updated.id}`);
      return;
    }

    if (command === 'revoke') {
      const userId = String(args['user-id'] || '').trim();
      const reason = String(args['reason'] || 'operator revocation').trim();
      if (!userId) {
        console.error('Error: --user-id <uuid> is required.');
        process.exit(1);
      }

      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        console.error(`Error: No user found with id=${userId}.`);
        process.exit(1);
      }

      const now = new Date();
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            isPlatformAdmin: false,
            platformAdminRevokedAt: now,
            sessionsInvalidatedAt: now,
          },
        }),
        prisma.refreshSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        }),
        prisma.auditLog.create({
          data: {
            userId,
            action: 'PLATFORM_ADMIN_REVOKED',
            details: {
              reason,
              revokedAt: now.toISOString(),
            },
          },
        }),
      ]);

      console.log(`Platform-admin revoked and active refresh sessions terminated for user ${userId}.`);
      console.log('Also remove this user ID from PLATFORM_ADMIN_USER_IDS if present.');
      return;
    }

    console.error(`Unknown command: ${command}. Use list | grant | revoke.`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
