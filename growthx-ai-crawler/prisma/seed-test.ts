import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding test data for Milquufresh...');

  // Create user
  const passwordHash = await bcrypt.hash('testpassword', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@milquufresh.in' },
    update: {},
    create: {
      email: 'admin@milquufresh.in',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Milquufresh',
    },
  });

  // Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'milquufresh' },
    update: {},
    create: {
      name: 'Milquufresh',
      slug: 'milquufresh',
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
  });

  // Create Project
  const project = await prisma.project.create({
    data: {
      name: 'Milquufresh SEO',
      organizationId: org.id,
    },
  });

  // Create Website
  const website = await prisma.website.upsert({
    where: { domain: 'milquufresh.in' },
    update: {
      projectId: project.id,
    },
    create: {
      domain: 'milquufresh.in',
      url: 'https://milquufresh.in',
      projectId: project.id,
      isVerified: true,
    },
  });

  console.log('Successfully seeded database for Milquufresh');
  console.log({
    user: user.email,
    org: org.slug,
    project: project.name,
    website: website.url,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
