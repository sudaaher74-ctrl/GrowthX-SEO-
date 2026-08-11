const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const websites = await prisma.website.findMany({
    include: {
      crawlJobs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, errorMessage: true, pagesCrawled: true, issuesFound: true }
      }
    }
  });
  console.log(JSON.stringify(websites, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
