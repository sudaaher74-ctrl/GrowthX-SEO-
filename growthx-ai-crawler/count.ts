import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pages = await prisma.page.count();
  const issues = await prisma.issue.count();
  const jobs = await prisma.crawlJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  
  console.log(`Pages: ${pages}`);
  console.log(`Issues: ${issues}`);
  console.log(`Latest Job Status: ${jobs[0]?.status}, Pages Crawled: ${jobs[0]?.pagesCrawled}`);
}

main().finally(() => prisma.$disconnect());
