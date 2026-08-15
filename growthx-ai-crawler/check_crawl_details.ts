import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const website = await prisma.website.findUnique({
    where: { domain: 'milquufresh.in' },
    include: {
      crawlJobs: {
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { pages: true, issues: true },
          },
        },
      },
    },
  });

  console.log(`Website for milquufresh.in:`);
  console.log(JSON.stringify(website, null, 2));

  await prisma.$disconnect();
}

main();
