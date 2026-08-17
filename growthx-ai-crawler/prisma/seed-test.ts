import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Wiping existing data...');
  
  // Wipe all demo data
  await prisma.promptCheck.deleteMany();
  await prisma.trackedPrompt.deleteMany();
  await prisma.competitorDomain.deleteMany();
  await prisma.creatorOutreach.deleteMany();
  await prisma.creatorMatch.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.contentCalendarItem.deleteMany();
  await prisma.contentStrategy.deleteMany();
  await prisma.contentGap.deleteMany();
  await prisma.creativePattern.deleteMany();
  await prisma.competitorContent.deleteMany();
  await prisma.competitorAccount.deleteMany();
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

  // ==========================================
  // CONTENT INTELLIGENCE & CREATIVE ENGINE DEMO DATA
  // ==========================================

  console.log('Seeding Content Intelligence Demo Data...');

  // 1. Competitor Accounts & Content
  const countryDelightAcc = await prisma.competitorAccount.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      competitorId: 'dummy-competitor-id',
      displayName: 'Country Delight',
      platform: 'INSTAGRAM',
      handle: 'countrydelightnatural',
      profileUrl: 'https://instagram.com/countrydelightnatural',
      followerCount: 250000,
      isActive: true,
    }
  });

  const cdContent = await prisma.competitorContent.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      accountId: countryDelightAcc.id,
      platform: 'INSTAGRAM',
      contentType: 'REEL',
      contentUrl: 'https://instagram.com/p/12345',
      caption: 'Pure cow milk delivered to your doorstep everyday. #CountryDelight #PureMilk',
      publishedAt: new Date(),
      viewsCount: 15000,
      likesCount: 1200,
    }
  });

  // 2. Creative Patterns
  const pattern1 = await prisma.creativePattern.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      name: 'Farm-to-home transparency',
      description: 'Showing the journey of milk from the farm directly to the consumer.',
      frequency: 15,
      marketSaturation: 75,
      opportunityScore: 40,
    }
  });
  
  const pattern2 = await prisma.creativePattern.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      name: 'A2 Milk Science Explanation',
      description: 'Educational content explaining the health benefits of A2 beta-casein protein.',
      frequency: 4,
      marketSaturation: 20,
      opportunityScore: 92,
    }
  });

  // 3. Content Gaps
  await prisma.contentGap.createMany({
    data: [
      {
        projectId: project.id,
        organizationId: org.id,
        title: 'Educational content on A2 milk benefits',
        description: 'Competitors are not adequately educating consumers on why A2 milk is better for digestion. High opportunity for Milquufresh.',
        gapType: 'MARKET_GAP',
        competitionLevel: 'LOW',
        opportunityScore: 95,
        recommendedAction: 'Create a 3-part Reel series featuring a nutritionist explaining A2 protein.',
        patternId: pattern2.id,
      },
      {
        projectId: project.id,
        organizationId: org.id,
        title: 'Influencer unboxing & taste tests',
        description: 'Country Delight and Amul are dominating lifestyle unboxing content. You are missing out on this highly engaging format.',
        gapType: 'CUSTOMER_MISSING',
        competitionLevel: 'HIGH',
        opportunityScore: 70,
        recommendedAction: 'Partner with 5 micro-influencers in Bangalore for authentic taste-test reviews.',
      }
    ]
  });

  // 4. Content Strategy
  const strategy = await prisma.contentStrategy.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      title: 'Milquufresh Q3 Educational & Trust Strategy',
      industrySkill: 'Premium Dairy & Health',
      status: 'APPROVED',
      contentPillars: [
        { pillar: 'EDUCATIONAL', percentage: 40, rationale: 'Educate on A2 benefits' },
        { pillar: 'PRODUCT', percentage: 30, rationale: 'Showcase product purity' },
        { pillar: 'LIFESTYLE', percentage: 20, rationale: 'Morning routines' },
        { pillar: 'PROMOTIONAL', percentage: 10, rationale: 'Subscription discounts' }
      ],
      campaignIdeas: [
        { name: 'The A2 Advantage', objective: 'Education & Conversion', concept: 'Nutritionist led breakdown' },
        { name: 'Morning Freshness', objective: 'Brand Awareness', concept: 'User generated morning routines' }
      ],
      content: {
        executiveSummary: 'This strategy focuses on dominating the A2 milk education space, taking advantage of the high opportunity score detected in our gap analysis.',
        hooks: ['Tired of feeling bloated after drinking milk?', 'Here is what big dairy does not tell you...'],
        whatToAvoid: ['Generic cow pictures', 'Overly promotional messaging without value']
      }
    }
  });

  // 5. Campaigns & Creators
  const campaign = await prisma.campaign.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      name: 'The A2 Advantage Launch',
      objective: 'Educate consumers and drive 500 new subscriptions',
      productFocus: 'A2 Cow Milk',
      targetAudience: 'Health conscious mothers in Bangalore, 25-45',
      platforms: ['INSTAGRAM', 'YOUTUBE'],
      budget: 150000,
      status: 'ACTIVE',
    }
  });

  const creator1 = await prisma.creator.create({
    data: {
      organizationId: org.id,
      name: 'Priya Sharma',
      handle: 'priya_health_diaries',
      platform: 'INSTAGRAM',
      category: 'FITNESS',
      location: 'Bangalore, India',
      followerCount: 45000,
      engagementRate: 4.5,
      averageBudget: 15000,
      tags: ['Nutritionist', 'Mom', 'Healthy Living']
    }
  });

  const creator2 = await prisma.creator.create({
    data: {
      organizationId: org.id,
      name: 'Rahul Foodie',
      handle: 'rahuleatsblr',
      platform: 'INSTAGRAM',
      category: 'FOOD',
      location: 'Bangalore, India',
      followerCount: 120000,
      engagementRate: 2.1,
      averageBudget: 30000,
      tags: ['Food Blogger', 'Reviews']
    }
  });

  // Matches & Outreach
  await prisma.creatorMatch.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      campaignId: campaign.id,
      creatorId: creator1.id,
      matchScore: 92,
      scoreBreakdown: { rationale: 'Perfect alignment: Bangalore-based nutritionist mom speaking to exact target audience.' },
    }
  });

  await prisma.creatorOutreach.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      creatorId: creator1.id,
      subject: 'Collaboration with Milquufresh - The A2 Advantage',
      messageBody: 'Hi Priya, we love your content on healthy living for moms! We are launching a new A2 milk campaign...',
      pipelineStage: 'CONTACTED',
      approvedToSend: true,
      contactedAt: new Date(),
    }
  });
  
  await prisma.creatorOutreach.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      creatorId: creator2.id,
      subject: 'Collaboration with Milquufresh - Taste Test',
      messageBody: 'Hi Rahul, we want you to taste test our fresh A2 milk...',
      pipelineStage: 'SHORTLISTED',
      approvedToSend: false,
    }
  });

  // 6. Content Calendar
  await prisma.contentCalendarItem.createMany({
    data: [
      {
        projectId: project.id,
        organizationId: org.id,
        campaignId: campaign.id,
        title: 'Why A2 Milk is Better',
        platform: 'INSTAGRAM',
        contentType: 'REEL',
        contentPillar: 'EDUCATIONAL',
        status: 'APPROVED',
        caption: 'Did you know that not all milk is created equal? Our A2 milk is easier to digest because... 👇\n\n#Milquufresh #A2Milk #HealthyLiving',
        hook: 'If you feel bloated after drinking milk, watch this.',
        hashtags: ['Milquufresh', 'A2Milk', 'HealthyLiving', 'Bangalore'],
        scheduledFor: new Date(Date.now() + 86400000), // Tomorrow
      },
      {
        projectId: project.id,
        organizationId: org.id,
        title: 'Farm to Doorstep Journey',
        platform: 'INSTAGRAM',
        contentType: 'CAROUSEL',
        contentPillar: 'PRODUCT',
        status: 'DRAFT',
        caption: 'From our happy cows to your morning tea. Here is how we ensure 100% purity. 🥛✨',
        hook: 'Ever wonder where your milk comes from?',
        hashtags: ['FarmFresh', 'PureMilk', 'Milquufresh'],
      }
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
