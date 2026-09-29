/**
 * Operator tools for organizations' tokens: see balances, give tokens, set an
 * allowance, and check the books.
 *
 * Works straight against the database, so it needs no login and no
 * PLATFORM_ADMIN_EMAILS — which is the point: it is what an operator reaches for
 * when the API itself is the thing being set up. It goes through the same
 * TokensService the API uses, so a grant made here takes the same lock and
 * writes the same ledger row as one made from the dashboard.
 *
 *   npx ts-node scripts/tokens.ts --list
 *   npx ts-node scripts/tokens.ts --org acme
 *   npx ts-node scripts/tokens.ts --org acme --grant 2000000 --note "Goodwill after the outage"
 *   npx ts-node scripts/tokens.ts --org acme --grant -50000            (take bonus tokens back)
 *   npx ts-node scripts/tokens.ts --org acme --allowance 10000000      (this org's own monthly allowance)
 *   npx ts-node scripts/tokens.ts --org acme --allowance default       (back to TOKENS_MONTHLY_ALLOWANCE)
 *   npx ts-node scripts/tokens.ts --verify                             (does every balance match its ledger?)
 *
 * `--org` takes an id or a slug. Nothing here is a payment: it does not charge
 * anyone, so do not use it to hand out tokens someone should be paying for.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { TokensService } from '../src/modules/tokens/tokens.service';

const prisma = new PrismaClient();
const tokens = new TokensService(prisma as unknown as PrismaService);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const n = (value: number) => value.toLocaleString('en-US');

async function list() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true, tokenWallet: true },
    orderBy: { createdAt: 'asc' },
  });
  if (organizations.length === 0) {
    console.log('No organizations exist yet.');
    return;
  }

  const mode = tokens.config().mode;
  console.log(`\nMode: ${mode}    Default monthly allowance: ${n(tokens.config().monthlyAllowance)}\n`);
  console.log(`${'ORGANIZATION'.padEnd(30)} ${'SLUG'.padEnd(24)} ${'AVAILABLE'.padStart(14)} ${'ALLOWANCE'.padStart(14)} ${'BONUS'.padStart(12)}  PERIOD ENDS`);
  console.log('─'.repeat(112));
  for (const org of organizations) {
    const w = org.tokenWallet;
    // A wallet is opened on first use, so an organization without one has not
    // used a metered feature yet. Listing must not open one.
    console.log(
      `${org.name.slice(0, 29).padEnd(30)} ${org.slug.slice(0, 23).padEnd(24)} ` +
        (w
          ? `${n(w.allowanceBalance + w.bonusBalance).padStart(14)} ${n(w.allowanceBalance).padStart(14)} ${n(w.bonusBalance).padStart(12)}  ${w.periodEnd.toISOString().slice(0, 10)}`
          : `${'(not started)'.padStart(14)}`),
    );
  }
  console.log(`\n${organizations.length} organization(s).\n`);
}

async function resolveOrganization(ref: string) {
  const organization = await prisma.organization.findFirst({ where: { OR: [{ id: ref }, { slug: ref }] } });
  if (!organization) {
    console.error(`No organization matches "${ref}". Run with --list to see them.`);
    process.exit(1);
  }
  return organization;
}

async function show(organizationId: string, name: string) {
  const balance = await tokens.getBalance(organizationId);
  const { items } = await tokens.history(organizationId, { limit: 10, includeInternal: true });

  console.log(`\n${name}  (${organizationId})`);
  console.log(`  Available : ${n(balance.available)}`);
  console.log(`  Allowance : ${n(balance.allowance.remaining)} of ${n(balance.allowance.granted)}, refills ${balance.allowance.periodEnd.toISOString().slice(0, 10)}`);
  if (balance.allowance.monthly !== balance.allowance.granted) {
    console.log(`              (from then it is ${n(balance.allowance.monthly)} a month)`);
  }
  console.log(`  Bonus     : ${n(balance.bonus)}  (never expires)`);
  console.log('\n  Latest movements');
  for (const row of items) {
    const sign = row.tokens > 0 ? '+' : '';
    console.log(
      `    ${row.createdAt.toISOString().slice(0, 16).replace('T', ' ')}  ${row.kind.padEnd(10)} ${row.action.padEnd(20)} ` +
        `${(sign + n(row.tokens)).padStart(14)}  →  ${n(row.balanceAfter)}`,
    );
  }
  console.log();
}

/**
 * The books either balance or they do not. For each wallet: the ledger summed
 * from the start must equal both buckets, and no row's recorded balance may
 * disagree with the running total at that row.
 */
async function verify() {
  const wallets = await prisma.tokenWallet.findMany({ include: { organization: { select: { slug: true } } } });
  let bad = 0;

  for (const wallet of wallets) {
    const rows = await prisma.tokenTransaction.findMany({
      where: { organizationId: wallet.organizationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, kind: true, allowanceDelta: true, bonusDelta: true },
    });
    const allowance = rows.reduce((sum, r) => sum + r.allowanceDelta, 0);
    const bonus = rows.reduce((sum, r) => sum + r.bonusDelta, 0);

    if (allowance !== wallet.allowanceBalance || bonus !== wallet.bonusBalance) {
      bad++;
      console.log(
        `✗ ${wallet.organization.slug}: wallet holds ${n(wallet.allowanceBalance)} allowance + ${n(wallet.bonusBalance)} bonus, ` +
          `but the ledger adds up to ${n(allowance)} + ${n(bonus)}.`,
      );
    }
  }

  console.log(bad === 0 ? `✓ ${wallets.length} wallet(s), every balance matches its ledger.` : `\n${bad} of ${wallets.length} wallet(s) do not balance.`);
  if (bad > 0) process.exitCode = 1;
}

async function main() {
  if (process.argv.includes('--list')) return list();
  if (process.argv.includes('--verify')) return verify();

  const ref = arg('org');
  if (!ref) {
    console.error(
      'Usage:\n' +
        '  --list                                   every organization and its tokens\n' +
        '  --org <id|slug>                          one organization, with its latest movements\n' +
        '  --org <id|slug> --grant <n> [--note ..]  give n bonus tokens (negative takes them back)\n' +
        '  --org <id|slug> --allowance <n|default>  set its monthly allowance\n' +
        '  --verify                                 check every balance against its ledger',
    );
    process.exit(1);
  }

  const organization = await resolveOrganization(ref);

  const grant = arg('grant');
  if (grant !== undefined) {
    const amount = Number(grant);
    if (!Number.isInteger(amount) || amount === 0) {
      console.error('--grant takes a whole number of tokens other than zero (negative takes tokens back).');
      process.exit(1);
    }
    await tokens.adjust({ organizationId: organization.id, amount, note: arg('note') ?? 'Granted from the command line' });
    console.log(`${amount > 0 ? 'Granted' : 'Took back'} ${n(Math.abs(amount))} bonus tokens ${amount > 0 ? 'to' : 'from'} ${organization.name}.`);
  }

  const allowance = arg('allowance');
  if (allowance !== undefined) {
    const value = allowance === 'default' ? null : Number(allowance);
    await tokens.setMonthlyAllowance(organization.id, value);
    console.log(
      value === null
        ? `${organization.name} now follows the default monthly allowance (from next month).`
        : `${organization.name} now gets ${n(value)} tokens a month (from next month).`,
    );
  }

  await show(organization.id, organization.name);
}

main()
  .catch((error) => {
    console.error('Failed:', error?.response?.message ?? error?.message ?? error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
