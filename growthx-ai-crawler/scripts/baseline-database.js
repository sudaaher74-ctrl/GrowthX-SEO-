#!/usr/bin/env node
/**
 * Brings a database that predates the migrations directory under migration
 * control, without dropping anything.
 *
 * The production schema was created with `prisma db push`, which applies the
 * schema but records nothing in `_prisma_migrations`. `prisma migrate deploy`
 * then finds tables it has no history for and refuses with P3005 rather than
 * risk replaying a CREATE TABLE over live data. The documented remedy is to
 * mark the migrations that the database already contains as applied.
 *
 * Doing that blind is the dangerous part: `migrate resolve --applied` writes a
 * row claiming a migration ran, and Prisma believes it forever after. Marking
 * one whose tables are *not* really there means that DDL never runs and the
 * mismatch only surfaces later as a query against a missing column.
 *
 * So this verifies before it claims. Each migration is fingerprinted by the
 * tables and enum types it creates, and only migrations whose objects are
 * *all* present are marked applied. The first migration whose objects are
 * absent ends the baseline — it and everything after it are left for
 * `migrate deploy` to apply normally. A migration that is only half present
 * is real drift, and this stops rather than papering over it.
 *
 * No-op unless the database is in exactly the P3005 state, so it is safe to
 * run on every boot: a fresh database and an already-migrated one both fall
 * straight through.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const PRISMA_CLI = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');

/** Tables and enum types a migration creates, used to test whether it already ran. */
function fingerprint(sql) {
  const tables = [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"/gi)].map((m) => m[1]);
  const types = [...sql.matchAll(/CREATE TYPE "([^"]+)"/gi)].map((m) => m[1]);
  return { tables: [...new Set(tables)], types: [...new Set(types)] };
}

function migrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort() // timestamp-prefixed, so lexical order is chronological
    .map((name) => {
      const file = path.join(MIGRATIONS_DIR, name, 'migration.sql');
      const sql = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      return { name, ...fingerprint(sql) };
    });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('baseline: DATABASE_URL is not set.');
    process.exit(1);
  }

  // Required lazily: on a fresh image this runs before anything else touches
  // the client, and a missing client should not crash the whole entrypoint.
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const schemaRows = await prisma.$queryRawUnsafe(`SELECT current_schema() AS schema`);
    const schema = schemaRows[0]?.schema || 'public';

    const tableRows = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
      schema,
    );
    const present = new Set(tableRows.map((r) => r.table_name));

    if (present.has('_prisma_migrations')) {
      console.log('baseline: migration history already exists — nothing to do.');
      return;
    }
    if (present.size === 0) {
      console.log('baseline: database is empty — migrate deploy will create everything.');
      return;
    }

    const typeRows = await prisma.$queryRawUnsafe(
      `SELECT t.typname AS name
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = $1 AND t.typtype = 'e'`,
      schema,
    );
    const presentTypes = new Set(typeRows.map((r) => r.name));

    console.log(
      `baseline: ${present.size} table(s) but no migration history — this database predates prisma migrate.`,
    );

    const all = migrations();
    const toBaseline = [];
    let stopped = null;

    for (const migration of all) {
      const objects = [
        ...migration.tables.map((t) => ({ kind: 'table', name: t, found: present.has(t) })),
        ...migration.types.map((t) => ({ kind: 'type', name: t, found: presentTypes.has(t) })),
      ];

      // Nothing to test against: an ALTER-only migration inherits the verdict
      // of the run it sits in, which is the only defensible reading.
      if (objects.length === 0) {
        if (stopped) break;
        toBaseline.push(migration.name);
        continue;
      }

      const found = objects.filter((o) => o.found);

      if (found.length === objects.length) {
        if (stopped) {
          console.error(
            `\nbaseline: ABORTING. "${migration.name}" is already present, but the earlier ` +
              `"${stopped}" is not. That is out-of-order drift this script must not guess at.`,
          );
          process.exit(1);
        }
        toBaseline.push(migration.name);
      } else if (found.length === 0) {
        // First migration the database genuinely does not have. Everything
        // from here on should be applied for real.
        if (!stopped) stopped = migration.name;
      } else {
        const missing = objects.filter((o) => !o.found).map((o) => `${o.kind} ${o.name}`);
        console.error(
          `\nbaseline: ABORTING. "${migration.name}" is only partially present in the database.\n` +
            `  missing: ${missing.join(', ')}\n` +
            'Marking it applied would skip the rest of it permanently. Resolve this by hand.',
        );
        process.exit(1);
      }
    }

    if (toBaseline.length === 0) {
      console.log('baseline: no migration matches the existing schema — leaving it to migrate deploy.');
      return;
    }

    for (const name of toBaseline) {
      console.log(`baseline: marking ${name} as already applied`);
      execFileSync(process.execPath, [PRISMA_CLI, 'migrate', 'resolve', '--applied', name], {
        stdio: 'inherit',
      });
    }

    const remaining = all.length - toBaseline.length;
    console.log(
      `baseline: done — ${toBaseline.length} migration(s) recorded as applied, ` +
        `${remaining} left for migrate deploy to run.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('baseline: failed —', err?.message || err);
  process.exit(1);
});
