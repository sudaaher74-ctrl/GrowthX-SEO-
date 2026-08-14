import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Wiping existing data...');
  
  // Wipe all demo data
  await prisma.promptCheck.deleteMany();
  await prisma.trackedPrompt.deleteMany();
  await prisma.competitorDomain.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.page.deleteMany();
  await prisma.crawlJob.deleteMany();
  await prisma.website.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding real data for Milquufresh...');

  // Create user
  const passwordHash = await bcrypt.hash('testpassword', 10);
  const user = await prisma.user.create({
    data: {
      email: 'admin@milquufresh.in',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Milquufresh',
    },
  });

  // Create Organization
  const org = await prisma.organization.create({
    data: {
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
  const website = await prisma.website.create({
    data: {
      domain: 'milquufresh.in',
      url: 'https://milquufresh.in',
      projectId: project.id,
      isVerified: true,
    },
  });

  // Add Competitors
  await prisma.competitorDomain.createMany({
    data: [
      { projectId: project.id, domain: 'countrydelight.in', label: 'Country Delight' },
      { projectId: project.id, domain: 'amul.com', label: 'Amul' },
      { projectId: project.id, domain: 'motherdairy.com', label: 'Mother Dairy' },
    ]
  });

  // Add Prompts
  await prisma.trackedPrompt.createMany({
    data: [
      { projectId: project.id, text: 'best a2 milk delivery app', intent: 'TRANSACTIONAL', estimatedVolume: 5000 },
      { projectId: project.id, text: 'is milquufresh milk pure', intent: 'INFORMATIONAL', estimatedVolume: 1200 },
      { projectId: project.id, text: 'organic milk delivery bangalore', intent: 'TRANSACTIONAL', estimatedVolume: 3400 },
    ]
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
