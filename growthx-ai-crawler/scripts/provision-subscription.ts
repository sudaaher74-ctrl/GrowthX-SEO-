/**
 * Puts an organization on a plan without going through Razorpay checkout.
 *
 * Needed because billing enforcement is real: an organization with no
 * Subscription row resolves to FREE, which is crawl-only, one site and 100
 * pages. A client handed the product without a subscription would see most of
 * it return 403 on their first login.
 *
 * This is for agency-provisioned and negotiated accounts (typically ENTERPRISE,
 * which is priced manually anyway). It does not touch Razorpay: no payment is
 * created, so it must not be used to give away a plan someone should be paying
 * for through checkout.
 *
 * Usage:
 *   npx ts-node scripts/provision-subscription.ts --list
 *   npx ts-node scripts/provision-subscription.ts --org <id|slug> --plan ENTERPRISE
 *   npx ts-node scripts/provision-subscription.ts --org acme --plan GROWTH --months 12
 */
import 'dotenv/config';
import { PlanType, PrismaClient, SubscriptionStatus } from '@prisma/client';
import { PLAN_CATALOG } from '../src/modules/billing/plans.catalog';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function listOrganizations() {
  const orgs = await prisma.organization.findMany({
    include: { subscription: true, projects: { select: { id: true } } },
    orderBy: { createdAt: 'asc' },
  });

  if (orgs.length === 0) {
    console.log('No organizations exist yet.');
    return;
  }

  console.log(`\n${'ORGANIZATION'.padEnd(28)} ${'SLUG'.padEnd(20)} ${'PLAN'.padEnd(12)} PROJECTS`);
  console.log('─'.repeat(78));
  for (const org of orgs) {
    const plan = org.subscription
      ? `${org.subscription.plan} (${org.subscription.status})`
      : 'FREE (none)';
    console.log(
      `${org.name.slice(0, 27).padEnd(28)} ${org.slug.slice(0, 19).padEnd(20)} ${plan.padEnd(12)} ${org.projects.length}`,
    );
  }
  console.log(`\n${orgs.length} organization(s). Ids:`);
  for (const org of orgs) console.log(`  ${org.id}  ${org.slug}`);
}

async function main() {
  if (process.argv.includes('--list')) {
    await listOrganizations();
    return;
  }

  const orgRef = arg('org');
  const planName = (arg('plan') ?? '').toUpperCase();
  const months = Number(arg('months') ?? '12');

  if (!orgRef || !planName) {
    console.error(
      'Usage:\n' +
        '  --list                                   show organizations and their current plan\n' +
        '  --org <id|slug> --plan <PLAN> [--months N]  provision a plan\n\n' +
        `Plans: ${Object.keys(PLAN_CATALOG).join(', ')}`,
    );
    process.exit(1);
  }

  if (!(planName in PlanType)) {
    console.error(`Unknown plan "${planName}". Valid: ${Object.keys(PlanType).join(', ')}`);
    process.exit(1);
  }
  if (!Number.isFinite(months) || months < 1) {
    console.error('--months must be a positive number.');
    process.exit(1);
  }

  const plan = planName as PlanType;

  const organization = await prisma.organization.findFirst({
    where: { OR: [{ id: orgRef }, { slug: orgRef }] },
    include: { subscription: true },
  });
  if (!organization) {
    console.error(`No organization matches "${orgRef}". Run with --list to see them.`);
    process.exit(1);
  }

  const definition = PLAN_CATALOG[plan];
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + months);

  const previous = organization.subscription
    ? `${organization.subscription.plan} (${organization.subscription.status})`
    : 'none — resolving to FREE';

  const subscription = await prisma.subscription.upsert({
    where: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      plan,
      status: SubscriptionStatus.ACTIVE,
      // Denormalised so the record reflects the plan as it stood today, the
      // same way a real checkout would.
      amountPaise: definition.amountPaise,
      currency: definition.currency,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan,
      status: SubscriptionStatus.ACTIVE,
      amountPaise: definition.amountPaise,
      currency: definition.currency,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    },
  });

  console.log(`\nOrganization : ${organization.name} (${organization.slug})`);
  console.log(`Was          : ${previous}`);
  console.log(`Now          : ${subscription.plan} (${subscription.status})`);
  console.log(`Paid through : ${periodEnd.toISOString().slice(0, 10)}  (${months} month(s))`);
  console.log(`Features     : ${definition.features.size}`);
  console.log(`Max sites    : ${definition.maxSites ?? 'unlimited'}`);
  console.log(
    `Crawl pages  : ${definition.quotas.CRAWL_PAGES === null ? 'unlimited' : definition.quotas.CRAWL_PAGES.toLocaleString()}`,
  );
  console.log('\nNo Razorpay record was created — this is a manually provisioned plan.\n');
}

main()
  .catch((error) => {
    console.error('Provisioning failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
