import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const jobs = await prisma.crawlJob.findMany({
    where: { website: { domain: 'milquufresh.in' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, pagesCrawled: true, issuesFound: true, createdAt: true, finishedAt: true },
  });

  console.log(`Crawl Jobs for milquufresh.in:`);
  console.log(JSON.stringify(jobs, null, 2));
  await prisma.$disconnect();
}

main();
