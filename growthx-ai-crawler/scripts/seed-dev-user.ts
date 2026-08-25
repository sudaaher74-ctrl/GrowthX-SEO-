import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'dev@growthx.ai';
  const orgName = 'GrowthX Dev Workspace';
  const orgSlug = 'growthx-dev';

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash('password', 10);
    user = await prisma.user.create({
      data: {
        email,
        firstName: 'Developer',
        lastName: 'User',
        passwordHash,
      },
    });
    console.log(`Created user: ${user.email}`);
  } else {
    console.log(`User already exists: ${user.email}`);
  }

  let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: orgName,
        slug: orgSlug,
      },
    });
    console.log(`Created organization: ${org.name}`);
  } else {
    console.log(`Organization already exists: ${org.name}`);
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organizationId: org.id },
  });

  if (!membership) {
    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER', 
      },
    });
    console.log(`Added user to organization as member.`);
  } else {
    console.log(`User is already a member of the organization.`);
  }

  // Find or create a default project
  let project = await prisma.project.findFirst({ where: { organizationId: org.id } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'Default Dev Project',
      },
    });
    console.log(`Created default project: ${project.name}`);
  } else {
    console.log(`Default project already exists.`);
  }

  console.log(`\n--- DEV CREDENTIALS ---`);
  console.log(`User ID: ${user.id}`);
  console.log(`Org ID: ${org.id}`);
  console.log(`Project ID: ${project.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
