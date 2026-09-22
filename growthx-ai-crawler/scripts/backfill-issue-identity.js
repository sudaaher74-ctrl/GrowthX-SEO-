/**
 * Gives findings recorded before Issue.fingerprint existed their identity.
 *
 * Until this runs, every row written before the migration has a null
 * fingerprint, which reconciliation skips by design — so those findings can
 * never resolve and never regress, and the history the column exists to create
 * starts empty. A re-crawl does not fix it: it writes new rows and leaves the
 * old ones anonymous.
 *
 * Plain JS on purpose, for the same reason scripts/backfill-page-types.js is:
 * ts-node is a devDependency the production image does not carry, so a
 * TypeScript entry point cannot run where this actually needs to run. The
 * backfill itself is not duplicated here — it is required from the build
 * output, because URL normalisation is what decides whether two crawls agree
 * and a second copy of it drifting by one trailing slash would quietly break
 * the continuity this is for.
 *
 * Idempotent and resumable. Every value written is derived from data already
 * on the row, so a second pass computes the same answers as the first.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  let backfillIssueIdentity;
  try {
    ({ backfillIssueIdentity } = require('../dist/modules/issues/scripts/backfill-issue-identity'));
  } catch (err) {
    // Running from source without a build. Nothing to do and nothing broken —
    // say which it is rather than failing with a bare module-not-found.
    console.error(
      'Issue identity backfill skipped: dist/modules/issues/scripts/backfill-issue-identity ' +
        `is not built. Run the build first (${err.message}).`,
    );
    return;
  }

  // /app is root-owned in the runtime image and the process runs as `node`, so
  // the default next to the working directory is not writable there. storage/
  // is chowned for exactly this kind of runtime write.
  if (!process.env.BACKFILL_PROGRESS_FILE) {
    const storageDir = path.join(process.cwd(), 'storage');
    if (fs.existsSync(storageDir)) {
      process.env.BACKFILL_PROGRESS_FILE = path.join(
        storageDir,
        '.backfill-issue-identity.json',
      );
    }
  }

  const prisma = new PrismaClient();
  try {
    const result = await backfillIssueIdentity(prisma);
    console.log(
      `Issue identity backfill finished: ${result.scanned} scanned, ` +
        `${result.updated} updated, ${result.orphaned} orphaned.`,
    );
    if (result.orphaned > 0) {
      console.warn(
        `${result.orphaned} rows have no crawl job to resolve an identity from. ` +
          'They keep a null fingerprint and will block the follow-up NOT NULL ' +
          'migration; see prisma/migrations/20260922093000_issue_project_and_fingerprint/FOLLOW-UP.md.',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Issue identity backfill failed. Re-run to resume.', err);
  process.exitCode = 1;
});
