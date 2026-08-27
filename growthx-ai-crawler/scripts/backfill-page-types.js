/**
 * Types pages that were crawled before Page.pageType existed.
 *
 * The column ships with a default of 'OTHER', so every page already in the
 * table reads as untyped until it is crawled again. Waiting for a re-crawl
 * would leave the gap comparison wrong rather than empty — a site whose pages
 * are all 'OTHER' looks like it has no service pages at all, which is a worse
 * answer than no answer.
 *
 * Plain JS on purpose, for the same reason scripts/repair-membership.js is:
 * ts-node is a devDependency the production image does not carry. The
 * classifier itself is not duplicated here — it is required from the build
 * output, so this script and the crawler can never disagree about what a
 * service page is.
 *
 * Idempotent. It only reads rows still sitting at 'OTHER' and only writes the
 * ones that classify as something else, so a second run over an already
 * backfilled table writes nothing. Pages that genuinely are 'OTHER' get
 * re-examined on each run; that is a few hundred rows of read, and it is what
 * lets the script pick up rules added to the classifier later.
 */
const { PrismaClient } = require('@prisma/client');

const BATCH = 500;

async function main() {
  let classifyPageType;
  try {
    ({ classifyPageType } = require('../dist/modules/crawler/page-type'));
  } catch (err) {
    // Running from source without a build. Nothing to do and nothing broken —
    // say which it is rather than failing with a bare module-not-found.
    console.error(
      'Page type backfill skipped: dist/modules/crawler/page-type is not built. ' +
        `Run the build first (${err.message}).`,
    );
    return;
  }

  const prisma = new PrismaClient();
  let scanned = 0;
  let updated = 0;

  try {
    // Keyed on id rather than skip/take: the updates change nothing about
    // ordering, but a page crawled while this runs would shift an offset-based
    // window and silently skip a row.
    let cursor = null;
    for (;;) {
      const pages = await prisma.page.findMany({
        where: { pageType: 'OTHER' },
        select: { id: true, url: true, title: true, h1: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (pages.length === 0) break;
      cursor = pages[pages.length - 1].id;
      scanned += pages.length;

      // Grouped by resulting type so each type costs one UPDATE rather than
      // one per page.
      const byType = new Map();
      for (const page of pages) {
        const type = classifyPageType({ url: page.url, title: page.title, h1: page.h1 });
        if (type === 'OTHER') continue;
        const ids = byType.get(type) || [];
        ids.push(page.id);
        byType.set(type, ids);
      }

      for (const [pageType, ids] of byType) {
        const result = await prisma.page.updateMany({
          where: { id: { in: ids } },
          data: { pageType },
        });
        updated += result.count;
      }
    }

    if (updated === 0) {
      console.log(`Page type backfill: nothing to do (${scanned} untyped page(s) checked).`);
    } else {
      console.log(`Page type backfill: typed ${updated} of ${scanned} page(s) checked.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`Page type backfill failed: ${err.message}`);
  process.exitCode = 1;
});
