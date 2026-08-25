/**
 * Reports who can reach which organization, and repairs orphaned ones.
 *
 * Tenant isolation is enforced through `OrganizationMember` rows. While those
 * checks were missing, every logged-in user could reach every organization, so
 * a missing membership row had no visible effect. With the checks restored, a
 * missing row is the difference between seeing your workspace and a 403 — so
 * it needs to be visible before someone hits it in the product.
 *
 * Two situations this surfaces:
 *   - an organization with no members at all, reachable by nobody
 *   - a user signed in under a different identity than the one that owns the
 *     data (a Google login gets its own auto-created workspace, not the one a
 *     seeder made), which now correctly cannot see the other workspace
 *
 * Run:      npx ts-node scripts/check-memberships.ts
 * Repair:   npx ts-node scripts/check-memberships.ts --attach <email> --org <slug-or-id> [--role OWNER]
 *
 * The repair grants a real person access to real data, so it never runs
 * implicitly — both flags are required and it prints what it did.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function report() {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      members: { select: { role: true, user: { select: { email: true } } } },
      _count: { select: { projects: true } },
    },
    orderBy: { name: 'asc' },
  });

  console.log('\nOrganizations\n' + '='.repeat(70));
  let orphaned = 0;

  for (const org of organizations) {
    const label = `${org.name} (${org.slug}) — ${org._count.projects} project(s)`;

    if (org.members.length === 0) {
      orphaned++;
      console.log(`✗ ${label}\n    NO MEMBERS — nobody can reach this organization or its data.`);
      console.log(`    Repair: --attach <email> --org ${org.slug}\n`);
      continue;
    }

    console.log(`✓ ${label}`);
    for (const m of org.members) console.log(`    ${m.role.padEnd(6)} ${m.user.email}`);
    console.log();
  }

  const users = await prisma.user.findMany({
    select: { email: true, memberships: { select: { organizationId: true } } },
    orderBy: { email: 'asc' },
  });

  const stranded = users.filter((u) => u.memberships.length === 0);
  if (stranded.length > 0) {
    console.log('Users with no organization\n' + '='.repeat(70));
    // These sign in successfully and then see nothing, because every read is
    // scoped to an organization they are not in.
    for (const u of stranded) console.log(`✗ ${u.email} — signs in, but reaches no data.`);
    console.log();
  }

  console.log('='.repeat(70));
  console.log(
    `${organizations.length} organization(s), ${orphaned} with no members, ` +
      `${stranded.length} user(s) with no organization.`,
  );

  if (orphaned === 0 && stranded.length === 0) {
    console.log('Every organization is reachable and every user belongs to one.');
  }
}

async function attach(email: string, org: string, role: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) throw new Error(`No user with email ${email}.`);

  const organization = await prisma.organization.findFirst({
    where: { OR: [{ slug: org }, { id: org }] },
    select: { id: true, name: true, slug: true },
  });
  if (!organization) throw new Error(`No organization with slug or id ${org}.`);

  const existing = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    select: { role: true },
  });

  if (existing) {
    console.log(`${user.email} is already a ${existing.role} of ${organization.name}. Nothing to do.`);
    return;
  }

  await prisma.organizationMember.create({
    data: { userId: user.id, organizationId: organization.id, role: role as any },
  });

  console.log(`Added ${user.email} to ${organization.name} (${organization.slug}) as ${role}.`);
}

async function main() {
  const email = arg('attach');
  const org = arg('org');

  if (email || org) {
    if (!email || !org) throw new Error('Both --attach <email> and --org <slug-or-id> are required.');
    await attach(email, org, (arg('role') || 'OWNER').toUpperCase());
    console.log();
  }

  await report();
}

main()
  .catch((error) => {
    console.error(`\n${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
