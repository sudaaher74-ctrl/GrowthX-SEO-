const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const issues = await prisma.issue.findMany({
    where: { crawlJobId: "ee0934e9-9ac3-412f-a4aa-4c5e72e3e8a3" },
    take: 5
  });
  console.log("Found issues:", issues.length);
  console.log(issues);
}
main().catch(console.error).finally(() => prisma.$disconnect());
