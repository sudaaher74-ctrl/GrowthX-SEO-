const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany();
  console.log("Users:", users.map(u => ({ email: u.email, id: u.id, orgId: u.orgId })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
