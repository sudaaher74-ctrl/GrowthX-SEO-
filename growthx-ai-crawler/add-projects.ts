import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('No organization found in DB.');
    return;
  }
  
  const businesses = [
    'milquufresh',
    'Aivaenterprises',
    'OS interior',
    'dronarcheryacedeamy',
    'brandkettle',
    'immunitygroup'
  ];

  for (const name of businesses) {
    const exists = await prisma.project.findFirst({
      where: { name, organizationId: org.id }
    });
    
    if (!exists) {
      const proj = await prisma.project.create({
        data: {
          name,
          organizationId: org.id,
        }
      });
      console.log(`Created project: ${proj.name} with ID: ${proj.id}`);
    } else {
      console.log(`Project already exists: ${name}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
