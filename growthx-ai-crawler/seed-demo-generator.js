const fs = require('fs');
const path = require('path');

const seedContent = `import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Wiping existing data...');
  
  // Wipe all demo data
  await prisma.promptCheck.deleteMany();
  await prisma.trackedPrompt.deleteMany();
  await prisma.competitorDomain.deleteMany();
  
  // Wipe Content Intelligence Models
  await prisma.creatorOutreach.deleteMany();
  await prisma.creatorMatch.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.contentCalendarItem.deleteMany();
  await prisma.contentStrategy.deleteMany();
  await prisma.contentGap.deleteMany();
  await prisma.patternContentLink.deleteMany();
  await prisma.creativePattern.deleteMany();
  await prisma.contentClassification.deleteMany();
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

  // 1. Competitor Accounts
  console.log('  -> Competitor Accounts & Content');
  const cdInsta = await prisma.competitorAccount.create({
    data: {
      projectId: project.id, organizationId: org.id, competitorId: 'cd_id',
      displayName: 'Country Delight', platform: 'INSTAGRAM', handle: 'countrydelightnatural',
      profileUrl: 'https://instagram.com/countrydelightnatural', followerCount: 250000, isActive: true,
    }
  });

  const amulInsta = await prisma.competitorAccount.create({
    data: {
      projectId: project.id, organizationId: org.id, competitorId: 'amul_id',
      displayName: 'Amul', platform: 'INSTAGRAM', handle: 'amul_india',
      profileUrl: 'https://instagram.com/amul_india', followerCount: 1500000, isActive: true,
    }
  });

  const akshayaInsta = await prisma.competitorAccount.create({
    data: {
      projectId: project.id, organizationId: org.id, competitorId: 'ak_id',
      displayName: 'Akshayakalpa', platform: 'INSTAGRAM', handle: 'akshayakalpa',
      profileUrl: 'https://instagram.com/akshayakalpa', followerCount: 120000, isActive: true,
    }
  });

  // 2. Competitor Content
  const cdReel1 = await prisma.competitorContent.create({
    data: {
      projectId: project.id, organizationId: org.id, accountId: cdInsta.id,
      platform: 'INSTAGRAM', contentType: 'REEL', contentUrl: 'https://instagram.com/p/cd1',
      caption: 'The purest cow milk delivered directly from farm to doorstep in 24 hours. #CountryDelight',
      publishedAt: new Date(Date.now() - 5 * 86400000), viewsCount: 45000, likesCount: 3200, commentsCount: 140, sharesCount: 50, engagementAvailable: true,
    }
  });

  const cdReel2 = await prisma.competitorContent.create({
    data: {
      projectId: project.id, organizationId: org.id, accountId: cdInsta.id,
      platform: 'INSTAGRAM', contentType: 'REEL', contentUrl: 'https://instagram.com/p/cd2',
      caption: 'Does your milk pass the purity test? See how we test every batch. #PurityTest',
      publishedAt: new Date(Date.now() - 2 * 86400000), viewsCount: 85000, likesCount: 6500, commentsCount: 320, sharesCount: 410, engagementAvailable: true,
    }
  });

  const amulPost1 = await prisma.competitorContent.create({
    data: {
      projectId: project.id, organizationId: org.id, accountId: amulInsta.id,
      platform: 'INSTAGRAM', contentType: 'POST', contentUrl: 'https://instagram.com/p/amul1',
      caption: 'Amul Topical: The taste of India! #AmulTopical',
      publishedAt: new Date(Date.now() - 1 * 86400000), viewsCount: 120000, likesCount: 15000, commentsCount: 500, sharesCount: 1200, engagementAvailable: true,
    }
  });
  
  const akshayaCarousel1 = await prisma.competitorContent.create({
    data: {
      projectId: project.id, organizationId: org.id, accountId: akshayaInsta.id,
      platform: 'INSTAGRAM', contentType: 'CAROUSEL', contentUrl: 'https://instagram.com/p/ak1',
      caption: 'Organic farming is not just a method, it is a philosophy. Here is how our farmers work. #OrganicFarming',
      publishedAt: new Date(Date.now() - 10 * 86400000), viewsCount: 20000, likesCount: 1100, commentsCount: 45, sharesCount: 20, engagementAvailable: true,
    }
  });

  // 3. Content Classifications
  await prisma.contentClassification.createMany({
    data: [
      { contentId: cdReel1.id, contentCategory: 'EDUCATIONAL', visualFormat: 'REEL', detectedTopics: ['Logistics', 'Freshness'], detectedObjects: ['Milk Bottle', 'Delivery Truck'], storytellingStyle: 'Fast-paced', hookType: 'Question', ctaType: 'Download App', creativityScore: 7.5, classifiedByModel: 'gpt-4o' },
      { contentId: cdReel2.id, contentCategory: 'EDUCATIONAL', visualFormat: 'REEL', detectedTopics: ['Quality Testing', 'Science'], detectedObjects: ['Lab Equipment', 'Milk'], storytellingStyle: 'Behind-the-scenes', hookType: 'Challenge', ctaType: 'Subscribe', creativityScore: 8.8, classifiedByModel: 'gpt-4o' },
      { contentId: amulPost1.id, contentCategory: 'ENTERTAINMENT', visualFormat: 'STATIC', detectedTopics: ['Pop Culture', 'Humor'], detectedObjects: ['Amul Girl', 'Cartoon'], storytellingStyle: 'Satire', hookType: 'Visual Pun', ctaType: 'None', creativityScore: 9.5, classifiedByModel: 'gpt-4o' },
      { contentId: akshayaCarousel1.id, contentCategory: 'BEHIND_SCENES', visualFormat: 'CAROUSEL', detectedTopics: ['Sustainability', 'Farming'], detectedObjects: ['Cow', 'Farmer', 'Grass'], storytellingStyle: 'Documentary', hookType: 'Statistic', ctaType: 'Read More', creativityScore: 6.2, classifiedByModel: 'gpt-4o' }
    ]
  });

  // 4. Creative Patterns
  console.log('  -> Creative Patterns & Links');
  const patPurity = await prisma.creativePattern.create({
    data: { projectId: project.id, organizationId: org.id, name: 'Purity Testing Demonstrations', description: 'Showing lab tests or home tests to prove milk is unadulterated.', frequency: 24, marketSaturation: 85, opportunityScore: 35 }
  });
  
  const patFarm = await prisma.creativePattern.create({
    data: { projectId: project.id, organizationId: org.id, name: 'Happy Cows & Organic Farms', description: 'Behind the scenes at the farm showing well-treated cows and green pastures.', frequency: 18, marketSaturation: 60, opportunityScore: 65 }
  });

  const patTopical = await prisma.creativePattern.create({
    data: { projectId: project.id, organizationId: org.id, name: 'Pop Culture & Topical Memes', description: 'Reacting to current events or pop culture with branded illustrations.', frequency: 12, marketSaturation: 40, opportunityScore: 50 }
  });

  const patA2 = await prisma.creativePattern.create({
    data: { projectId: project.id, organizationId: org.id, name: 'A2 Protein Education', description: 'Explaining the digestive benefits of A2 milk over regular milk.', frequency: 5, marketSaturation: 15, opportunityScore: 95 }
  });

  const patKids = await prisma.creativePattern.create({
    data: { projectId: project.id, organizationId: org.id, name: 'Kids Drinking Milk', description: 'Mothers giving milk to their kids, highlighting nutrition for growth.', frequency: 30, marketSaturation: 90, opportunityScore: 20 }
  });

  // Pattern Links
  await prisma.patternContentLink.createMany({
    data: [
      { patternId: patPurity.id, contentId: cdReel2.id },
      { patternId: patFarm.id, contentId: akshayaCarousel1.id },
      { patternId: patTopical.id, contentId: amulPost1.id },
    ]
  });

  // 5. Content Gaps
  console.log('  -> Content Gaps');
  await prisma.contentGap.createMany({
    data: [
      { projectId: project.id, organizationId: org.id, gapType: 'MARKET_GAP', patternId: patA2.id, title: 'Deep dive into A2 Milk Science', description: 'Competitors mention A2 milk but do not explain the science behind it. High opportunity to build authority.', competitionLevel: 'LOW', opportunityScore: 95, recommendedAction: 'Partner with pediatricians or nutritionists for a video series.' },
      { projectId: project.id, organizationId: org.id, gapType: 'CUSTOMER_MISSING', patternId: patFarm.id, title: 'Lack of Farm-to-Table Transparency', description: 'Akshayakalpa and Country Delight show their farms frequently. Milquufresh lacks visual proof of farm practices.', competitionLevel: 'HIGH', opportunityScore: 65, recommendedAction: 'Shoot a farm documentary reel showing the exact origin of Milquufresh.' },
      { projectId: project.id, organizationId: org.id, gapType: 'SATURATED', patternId: patKids.id, title: 'Generic Kids Drinking Milk Posts', description: 'This pattern is highly saturated and yields low engagement across the board. Stop doing this.', competitionLevel: 'HIGH', opportunityScore: 20, recommendedAction: 'Pivot from generic kid posts to specific nutritional outcomes (e.g. immunity building recipes).' },
      { projectId: project.id, organizationId: org.id, gapType: 'DIFFERENTIATION', title: 'Glass Bottle Delivery Aesthetics', description: 'No competitor is highlighting the aesthetic and environmental benefit of glass bottle deliveries.', competitionLevel: 'LOW', opportunityScore: 88, recommendedAction: 'ASMR style unboxing of cold glass milk bottles.' },
    ]
  });

  // 6. Content Strategies
  console.log('  -> Content Strategies');
  const stratEducate = await prisma.contentStrategy.create({
    data: {
      projectId: project.id, organizationId: org.id, title: 'Q3: A2 Milk Authority & Trust', industrySkill: 'Premium Dairy', status: 'APPROVED',
      contentPillars: [
        { pillar: 'EDUCATIONAL', percentage: 50, rationale: 'Dominate A2 science gap' },
        { pillar: 'BEHIND_SCENES', percentage: 30, rationale: 'Build trust with farm tours' },
        { pillar: 'LIFESTYLE', percentage: 20, rationale: 'Glass bottle aesthetics' }
      ],
      campaignIdeas: [
        { name: 'The A2 Advantage Series', objective: 'Lead Generation', concept: 'Doctor-led breakdowns' },
        { name: 'Glass is Class', objective: 'Brand Awareness', concept: 'ASMR unboxing' }
      ],
      content: { executiveSummary: 'Focus entirely on scientific superiority and premium packaging.', hooks: ['Why regular milk makes you bloated', 'Listen to this sound (ASMR bottle clink)'], whatToAvoid: ['Plastic pouches', 'Generic family photos'] }
    }
  });

  const stratPromo = await prisma.contentStrategy.create({
    data: {
      projectId: project.id, organizationId: org.id, title: 'Diwali Festive Subscriptions', industrySkill: 'Dairy eCommerce', status: 'DRAFT',
      contentPillars: [
        { pillar: 'PROMOTIONAL', percentage: 70, rationale: 'Drive trial packs' },
        { pillar: 'LIFESTYLE', percentage: 30, rationale: 'Festive recipes with ghee/milk' }
      ],
      campaignIdeas: [ { name: 'Pure Diwali', objective: 'Sales', concept: 'Discounts on 3-month subscriptions' } ],
      content: { executiveSummary: 'Aggressive conversion campaign for the festive season.', hooks: ['This Diwali, gift health.'], whatToAvoid: ['Focusing on single purchases'] }
    }
  });

  // 7. Campaigns & Creators
  console.log('  -> Campaigns & Creators');
  const campaignA2 = await prisma.campaign.create({
    data: { projectId: project.id, organizationId: org.id, name: 'The A2 Advantage', objective: 'Educate & Convert', productFocus: 'A2 Cow Milk', targetAudience: 'Health conscious moms, 25-45, Tier 1', platforms: ['INSTAGRAM', 'YOUTUBE'], budget: 200000, status: 'ACTIVE' }
  });

  const campaignGlass = await prisma.campaign.create({
    data: { projectId: project.id, organizationId: org.id, name: 'Glass is Class (ASMR)', objective: 'Brand Awareness', productFocus: 'Packaging & Purity', targetAudience: 'Gen-Z & Millennials, Eco-conscious', platforms: ['INSTAGRAM', 'TIKTOK'], budget: 50000, status: 'PLANNING' }
  });

  const creatorsData = [
    { name: 'Dr. Priya Sharma', handle: 'priya_health_diaries', platform: 'INSTAGRAM', category: 'FITNESS', followerCount: 45000, engagementRate: 4.5, averageBudget: 15000, tags: ['Nutritionist', 'Doctor'] },
    { name: 'Rahul Foodie', handle: 'rahuleatsblr', platform: 'INSTAGRAM', category: 'FOOD', followerCount: 120000, engagementRate: 2.1, averageBudget: 30000, tags: ['Food Blogger'] },
    { name: 'Sneha EcoLiving', handle: 'sneha_sustainable', platform: 'INSTAGRAM', category: 'LIFESTYLE', followerCount: 75000, engagementRate: 5.2, averageBudget: 20000, tags: ['Eco-friendly', 'ASMR'] },
    { name: 'Mom & Me', handle: 'mom_and_me_vlogs', platform: 'YOUTUBE', category: 'PARENTING', followerCount: 350000, engagementRate: 3.1, averageBudget: 80000, tags: ['Mom', 'Vlogs'] },
    { name: 'Dr. Anjali', handle: 'anjali_pediatrics', platform: 'INSTAGRAM', category: 'FITNESS', followerCount: 15000, engagementRate: 8.5, averageBudget: 10000, tags: ['Pediatrician', 'Micro'] }
  ];

  const creators = [];
  for (const cd of creatorsData) {
    const c = await prisma.creator.create({ data: { organizationId: org.id, ...cd } });
    creators.push(c);
  }

  // 8. Matches & Outreach
  console.log('  -> Matches & Outreach');
  // Match Dr. Priya & Dr. Anjali to A2 campaign
  await prisma.creatorMatch.create({ data: { organizationId: org.id, projectId: project.id, campaignId: campaignA2.id, creatorId: creators[0].id, matchScore: 92, scoreBreakdown: { rationale: 'Perfect alignment: Nutritionist speaking to exact target audience.' }, status: 'SELECTED' } });
  await prisma.creatorMatch.create({ data: { organizationId: org.id, projectId: project.id, campaignId: campaignA2.id, creatorId: creators[4].id, matchScore: 95, scoreBreakdown: { rationale: 'Pediatrician endorsement is highly trusted.' }, status: 'SHORTLISTED' } });
  
  // Match Sneha to Glass campaign
  await prisma.creatorMatch.create({ data: { organizationId: org.id, projectId: project.id, campaignId: campaignGlass.id, creatorId: creators[2].id, matchScore: 88, scoreBreakdown: { rationale: 'Strong eco-conscious aesthetic.' }, status: 'SUGGESTED' } });

  await prisma.creatorOutreach.create({
    data: { projectId: project.id, organizationId: org.id, creatorId: creators[0].id, campaignId: campaignA2.id, subject: 'Collaboration - The A2 Advantage', messageBody: 'Hi Dr. Priya, we love your content...', pipelineStage: 'NEGOTIATING', approvedToSend: true, contactedAt: new Date(Date.now() - 2 * 86400000), responseAt: new Date(Date.now() - 1 * 86400000), responseText: 'I am interested! What is the budget?', channel: 'EMAIL' }
  });
  
  await prisma.creatorOutreach.create({
    data: { projectId: project.id, organizationId: org.id, creatorId: creators[4].id, campaignId: campaignA2.id, subject: 'Collaboration Inquiry', messageBody: 'Hi Dr. Anjali...', pipelineStage: 'CONTACTED', approvedToSend: true, contactedAt: new Date(), channel: 'INSTAGRAM_DM' }
  });

  // 9. Content Calendar Items
  console.log('  -> Content Calendar');
  await prisma.contentCalendarItem.createMany({
    data: [
      { projectId: project.id, organizationId: org.id, campaignId: campaignA2.id, platform: 'INSTAGRAM', contentType: 'REEL', contentPillar: 'EDUCATIONAL', title: 'Why A2 Milk is Better (Part 1)', status: 'APPROVED', caption: 'Did you know that not all milk is created equal? Our A2 milk is easier to digest because... 👇\\n\\n#Milquufresh #A2Milk #HealthyLiving', hook: 'If you feel bloated after drinking milk, watch this.', hashtags: ['Milquufresh', 'A2Milk', 'HealthyLiving'], scheduledFor: new Date(Date.now() + 1 * 86400000) },
      { projectId: project.id, organizationId: org.id, campaignId: campaignA2.id, platform: 'INSTAGRAM', contentType: 'REEL', contentPillar: 'EDUCATIONAL', title: 'A2 Milk Science (Part 2)', status: 'SCHEDULED', caption: 'Beta-casein proteins explained. #A2Milk', hook: 'What is Beta-casein?', hashtags: ['Milquufresh', 'Science'], scheduledFor: new Date(Date.now() + 3 * 86400000) },
      { projectId: project.id, organizationId: org.id, campaignId: campaignGlass.id, platform: 'INSTAGRAM', contentType: 'REEL', contentPillar: 'LIFESTYLE', title: 'ASMR Morning Routine', status: 'DRAFT', caption: 'Listen to the sound of pure freshness. 🥛✨', hook: '(Sound of bottle opening)', hashtags: ['ASMR', 'Milquufresh'], scheduledFor: new Date(Date.now() + 5 * 86400000) },
      { projectId: project.id, organizationId: org.id, platform: 'LINKEDIN', contentType: 'POST', contentPillar: 'BEHIND_SCENES', title: 'Meet our Farmers', status: 'PUBLISHED', caption: 'Our farmers are the backbone of Milquufresh...', hashtags: ['Farming', 'Sustainability'], publishedAt: new Date(Date.now() - 2 * 86400000) },
      { projectId: project.id, organizationId: org.id, platform: 'YOUTUBE', contentType: 'SHORT', contentPillar: 'PRODUCT', title: 'How to make paneer with A2 Milk', status: 'REVIEW', caption: 'Learn how to make soft paneer at home.', hashtags: ['Recipe', 'Paneer'], scheduledFor: new Date(Date.now() + 7 * 86400000) },
    ]
  });

  console.log('Successfully seeded database for Milquufresh with FULL Demo Data');
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
`;

fs.writeFileSync(path.join(__dirname, 'prisma/seed-test.ts'), seedContent);
console.log('Successfully updated seed-test.ts');
