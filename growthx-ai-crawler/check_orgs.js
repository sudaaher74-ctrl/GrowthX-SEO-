const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const orgs = await prisma.organization.findMany();
  console.log("Organizations:", orgs);
  const members = await prisma.organizationMember.findMany();
  console.log("Members:", members);
}
main().catch(console.error).finally(() => prisma.$disconnect());
