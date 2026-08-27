/**
 * Attaches an account to an organization at boot, driven by environment.
 *
 * A missing OrganizationMember row leaves an account able to sign in while
 * reaching no data: reads scoped by organization silently return nothing and
 * writes that need the column fail outright. scripts/check-memberships.ts
 * repairs that, but it is TypeScript run with ts-node — a devDependency the
 * production image does not carry — and Render's free plan has no shell to run
 * it from anyway. This is the same repair, in plain JS, reachable by setting
 * two environment variables in the dashboard.
 *
 * It is deliberately not an HTTP route. Granting workspace access over an
 * endpoint would mean anyone who can reach the API could try; environment
 * variables can only be set by whoever owns the deployment.
 *
 *   REPAIR_ATTACH_EMAIL   the account to attach
 *   REPAIR_ATTACH_ORG     organization slug or id
 *   REPAIR_ATTACH_ROLE    optional, defaults to OWNER
 *
 * With either of the first two unset this is a no-op, so it costs a normal boot
 * nothing. Remove the variables once the repair has been logged — leaving them
 * set just makes every later boot re-check a row that already exists.
 *
 * A failure here never stops the API booting: an unrepaired membership is a
 * broken workspace, but a container that will not start is a broken product.
 */
const { PrismaClient } = require('@prisma/client');

const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

async function main() {
  const email = (process.env.REPAIR_ATTACH_EMAIL || '').trim();
  const org = (process.env.REPAIR_ATTACH_ORG || '').trim();

  if (!email && !org) return;

  if (!email || !org) {
    console.warn(
      'Membership repair skipped: REPAIR_ATTACH_EMAIL and REPAIR_ATTACH_ORG must both be set.',
    );
    return;
  }

  const role = (process.env.REPAIR_ATTACH_ROLE || 'OWNER').trim().toUpperCase();
  if (!ROLES.includes(role)) {
    console.warn(`Membership repair skipped: REPAIR_ATTACH_ROLE='${role}' is not one of ${ROLES.join(', ')}.`);
    return;
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) {
      // Naming the accounts that do exist turns a typo into a one-line fix
      // rather than another deploy cycle spent guessing.
      const known = await prisma.user.findMany({ select: { email: true }, take: 20, orderBy: { email: 'asc' } });
      console.warn(`Membership repair: no user with email '${email}'.`);
      console.warn(`  Accounts on this database: ${known.map((u) => u.email).join(', ') || '(none)'}`);
      return;
    }

    const organization = await prisma.organization.findFirst({
      where: { OR: [{ slug: org }, { id: org }] },
      select: { id: true, name: true, slug: true },
    });
    if (!organization) {
      const known = await prisma.organization.findMany({ select: { slug: true }, take: 20, orderBy: { slug: 'asc' } });
      console.warn(`Membership repair: no organization with slug or id '${org}'.`);
      console.warn(`  Organizations on this database: ${known.map((o) => o.slug).join(', ') || '(none)'}`);
      return;
    }

    const existing = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      select: { role: true },
    });

    if (existing) {
      console.log(
        `Membership repair: ${user.email} is already a ${existing.role} of ${organization.name}. Nothing to do. ` +
          'Remove REPAIR_ATTACH_EMAIL and REPAIR_ATTACH_ORG.',
      );
      return;
    }

    await prisma.organizationMember.create({
      data: { userId: user.id, organizationId: organization.id, role },
    });

    console.log(
      `Membership repair: added ${user.email} to ${organization.name} (${organization.slug}) as ${role}. ` +
        'Remove REPAIR_ATTACH_EMAIL and REPAIR_ATTACH_ORG now that it is done.',
    );
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.warn(`Membership repair failed, continuing to boot: ${error && error.message ? error.message : error}`);
});
