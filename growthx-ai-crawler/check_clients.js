const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const websites = await prisma.website.findMany({ select: { domain: true, url: true } });
  console.log("Registered domains:", websites);
}
main().catch(console.error).finally(() => prisma.$disconnect());
