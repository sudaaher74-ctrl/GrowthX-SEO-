/**
 * Backfills `projectId` and `fingerprint` onto existing `Issue` rows.
 *
 * Run once after the additive migration
 * (20260922093000_issue_project_and_fingerprint) and before the follow-up that
 * makes `fingerprint` NOT NULL:
 *
 *   npm run script:backfill-issue-identity
 *
 * Three properties matter more than speed:
 *
 * - **Batched.** `aivaenterprises.com` alone carries 156 issues across 35
 *   pages. A client with 10,000 pages would time out a naive `updateMany` over
 *   the whole table, and a statement that times out half way leaves no record
 *   of how far it got.
 * - **Resumable.** Progress is written after every batch, so an interrupted
 *   run continues from where it stopped rather than starting over.
 * - **Idempotent.** Safe to re-run from the beginning at any time. Every write
 *   is derived from data already on the row, so a second pass computes the
 *   same values as the first.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fingerprintFor, fingerprintScope } from '../fingerprint.util';

const BATCH_SIZE = 1000;
const PROGRESS_FILE =
  process.env.BACKFILL_PROGRESS_FILE ??
  path.join(process.cwd(), '.backfill-issue-identity.json');

interface Progress {
  cursor: string | null;
  scanned: number;
  updated: number;
  orphaned: number;
  startedAt: string;
}

function readProgress(): Progress {
  try {
    const raw = fs.readFileSync(PROGRESS_FILE, 'utf8');
    return JSON.parse(raw) as Progress;
  } catch {
    return {
      cursor: null,
      scanned: 0,
      updated: 0,
      orphaned: 0,
      startedAt: new Date().toISOString(),
    };
  }
}

let progressWriteFailed = false;

function writeProgress(p: Progress): void {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
  } catch (err) {
    // Losing resumability is a far smaller problem than losing the run. In the
    // production image /app is root-owned and the process is `node`, so an
    // unwritable progress file is a realistic outcome rather than a
    // hypothetical one — and it must not stop the backfill from finishing.
    if (!progressWriteFailed) {
      progressWriteFailed = true;
      console.warn(
        `Could not write progress to ${PROGRESS_FILE} (${(err as Error).message}). ` +
          'The backfill continues, but an interrupted run will restart from the beginning. ' +
          'Set BACKFILL_PROGRESS_FILE to a writable path to restore resumability.',
      );
    }
  }
}

export async function backfillIssueIdentity(
  prisma: PrismaClient,
  log: (msg: string) => void = console.log,
): Promise<{ scanned: number; updated: number; orphaned: number }> {
  const progress = readProgress();
  if (progress.cursor) {
    log(`Resuming from issue id ${progress.cursor} (${progress.scanned} scanned so far).`);
  }

  // The first-seen date for a fingerprint is the earliest createdAt across
  // every row that shares it, which is not knowable from the row in hand. This
  // pass collects those dates once, up front, so the batched pass below does
  // not need a query per row.
  //
  // Grouped in the database rather than in memory: one row per (crawlJob,
  // issueType, affectedUrl) is far smaller than one per issue, and this runs
  // against tables with hundreds of thousands of rows.
  log('Collecting first-seen and last-seen dates per fingerprint...');
  const seenDates = new Map<string, { first: Date; last: Date }>();

  let datesCursor: string | null = null;
  for (;;) {
    const rows: Array<{
      id: string;
      issueType: string;
      affectedUrl: string;
      createdAt: Date;
      crawlJob: { websiteId: string; website: { projectId: string | null } | null } | null;
    }> = await prisma.issue.findMany({
      where: datesCursor ? { id: { gt: datesCursor } } : {},
      select: {
        id: true,
        issueType: true,
        affectedUrl: true,
        createdAt: true,
        crawlJob: {
          select: { websiteId: true, website: { select: { projectId: true } } },
        },
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.crawlJob) continue;
      const scope = fingerprintScope(
        row.crawlJob.website?.projectId ?? null,
        row.crawlJob.websiteId,
      );
      const fp = fingerprintFor(scope, row.issueType, row.affectedUrl);
      const seen = seenDates.get(fp);
      if (!seen) {
        seenDates.set(fp, { first: row.createdAt, last: row.createdAt });
      } else {
        if (row.createdAt < seen.first) seen.first = row.createdAt;
        if (row.createdAt > seen.last) seen.last = row.createdAt;
      }
    }

    datesCursor = rows[rows.length - 1].id;
    if (rows.length < BATCH_SIZE) break;
  }
  log(`Collected dates for ${seenDates.size} distinct fingerprints.`);

  // Second pass: write. Ordered by id so the cursor is stable, and committed
  // batch by batch so an interrupted run loses at most one batch of work.
  for (;;) {
    const rows: Array<{
      id: string;
      issueType: string;
      affectedUrl: string;
      createdAt: Date;
      crawlJob: { websiteId: string; website: { projectId: string | null } | null } | null;
    }> = await prisma.issue.findMany({
      where: progress.cursor ? { id: { gt: progress.cursor } } : {},
      select: {
        id: true,
        issueType: true,
        affectedUrl: true,
        createdAt: true,
        crawlJob: {
          select: { websiteId: true, website: { select: { projectId: true } } },
        },
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;

    // Rows that share a fingerprint get identical values, so they are written
    // together. On a table large enough to be worth batching at all, most rows
    // ARE repeats — the same finding seen by crawl after crawl — so this is
    // the difference between one statement per row and one per distinct
    // finding. Where every row is unique it costs nothing.
    const writeGroups = new Map<
      string,
      { ids: string[]; projectId: string | null; fingerprint: string; first: Date; last: Date }
    >();

    for (const row of rows) {
      progress.scanned++;

      // An issue whose crawl job or website has gone leaves nothing to resolve
      // a project from. Counted and left alone rather than deleted or assigned
      // to an invented project — this is the case the follow-up NOT NULL
      // migration has to account for.
      if (!row.crawlJob) {
        progress.orphaned++;
        continue;
      }

      const projectId = row.crawlJob.website?.projectId ?? null;
      const scope = fingerprintScope(projectId, row.crawlJob.websiteId);
      const fingerprint = fingerprintFor(scope, row.issueType, row.affectedUrl);
      const dates = seenDates.get(fingerprint);

      const group = writeGroups.get(fingerprint);
      if (group) {
        group.ids.push(row.id);
      } else {
        writeGroups.set(fingerprint, {
          ids: [row.id],
          projectId,
          fingerprint,
          first: dates?.first ?? row.createdAt,
          last: dates?.last ?? row.createdAt,
        });
      }
      progress.updated++;
    }

    for (const group of writeGroups.values()) {
      await prisma.issue.updateMany({
        where: { id: { in: group.ids } },
        data: {
          projectId: group.projectId,
          fingerprint: group.fingerprint,
          firstDetectedAt: group.first,
          lastSeenAt: group.last,
        },
      });
    }

    progress.cursor = rows[rows.length - 1].id;
    writeProgress(progress);
    log(
      `Batch done — ${progress.scanned} scanned, ${progress.updated} updated, ` +
        `${progress.orphaned} orphaned. Cursor at ${progress.cursor}.`,
    );

    if (rows.length < BATCH_SIZE) break;
  }

  log(
    `Backfill complete: ${progress.scanned} scanned, ${progress.updated} updated, ` +
      `${progress.orphaned} orphaned (no crawl job or website to resolve a project from).`,
  );

  if (progress.orphaned > 0) {
    log(
      `NOTE: ${progress.orphaned} rows could not be given an identity. They are ` +
        `left as-is; the follow-up NOT NULL migration must handle them.`,
    );
  }

  return {
    scanned: progress.scanned,
    updated: progress.updated,
    orphaned: progress.orphaned,
  };
}

// Only runs when invoked directly, so the function above stays importable from
// a test without a database connection being opened on import.
if (require.main === module) {
  const prisma = new PrismaClient();
  backfillIssueIdentity(prisma)
    .then(() => {
      // Progress is kept deliberately: a completed run that is re-invoked
      // should not silently start over on a table of this size. Delete
      // .backfill-issue-identity.json to force a full re-run.
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backfill failed. Re-run to resume from the last batch.', err);
      process.exit(1);
    })
    .finally(() => void prisma.$disconnect());
}
