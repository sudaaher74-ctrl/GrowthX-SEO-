/**
 * Wipes every row from the database so the product starts clean from today.
 *
 * Schema and migration history are kept: every table in `public` except
 * `_prisma_migrations` is truncated in one statement, with identities reset
 * and cascades applied. Users, accounts, integrations, crawls, findings,
 * snapshots and token wallets are all deleted — sign-ups start over.
 *
 * Plain JS for the same reason the other scripts here are: the production
 * image has no ts-node.
 *
 * Irreversible, so it refuses to run without both:
 *   RESET_CONFIRM=<hostname>/<database>   (printed by a dry run)
 *   --yes
 * Without them it only prints what it would delete.
 *
 *   node scripts/reset-data.js            # dry run: target + row counts
 *   RESET_CONFIRM=host/db node scripts/reset-data.js --yes
 *
 * Redis (BullMQ queues) is not touched; flush it separately so no queued job
 * points at a row that no longer exists.
 */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  const target = `${url.hostname}/${url.pathname.replace(/^\//, '')}`;
  const prisma = new PrismaClient();
  try {
    const tables = (
      await prisma.$queryRaw`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
        ORDER BY tablename`
    ).map((r) => r.tablename);

    console.log(`Target: ${target}`);
    console.log(`${tables.length} tables would be truncated.`);

    const confirmed = process.argv.includes('--yes') && process.env.RESET_CONFIRM === target;
    if (!confirmed) {
      for (const t of tables) {
        const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`);
        if (n > 0) console.log(`  ${t}: ${n}`);
      }
      console.log(`\nDry run. To delete, re-run with: RESET_CONFIRM=${target} node scripts/reset-data.js --yes`);
      return;
    }

    const list = tables.map((t) => `"${t}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    console.log('Done. All data deleted; schema and migrations untouched.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
