import { PrismaClient, JobStatus, IssueSeverity, IssueStatus, FixStatus, PlanType, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting demo data seed for milquufresh.in...');

  // 1. Clean up existing demo data to ensure idempotency
  const demoDomain = 'milquufresh.in';
  
  console.log('🧹 Purging existing demo data...');
  const existingWebsite = await prisma.website.findUnique({
    where: { domain: demoDomain },
  });

  if (existingWebsite) {
    if (existingWebsite.projectId) {
      await prisma.project.delete({ where: { id: existingWebsite.projectId } });
    }
  }

  const demoOrgSlug = 'milquu-fresh-hq';
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: demoOrgSlug },
  });

  if (existingOrg) {
    await prisma.organization.delete({ where: { id: existingOrg.id } });
  }

  // 2. Create Organization & Project
  console.log('🏢 Creating Organization and Project...');
  const org = await prisma.organization.create({
    data: {
      name: 'Milquu Fresh HQ',
      slug: demoOrgSlug,
      subscription: {
        create: {
          plan: PlanType.PRO,
          status: SubscriptionStatus.ACTIVE,
          amountPaise: 699900,
        }
      }
    },
  });

  const project = await prisma.project.create({
    data: {
      name: 'Milquu Fresh Main Site',
      organizationId: org.id,
      tier: 'Pro',
    },
  });

  // 3. Create Website & CrawlJob
  console.log('🌐 Creating Website and Crawl Job...');
  const website = await prisma.website.create({
    data: {
      domain: demoDomain,
      url: `https://${demoDomain}`,
      projectId: project.id,
      isVerified: true,
      verifiedAt: new Date(),
    },
  });

  const crawlJob = await prisma.crawlJob.create({
    data: {
      websiteId: website.id,
      status: JobStatus.COMPLETED,
      pagesCrawled: 24,
      issuesFound: 3,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5),
    },
  });

  // 4. Create Pages & Performance Data
  console.log('📄 Creating Pages and Performance Metrics...');
  
  const pageHome = await prisma.page.create({
    data: {
      crawlJobId: crawlJob.id,
      url: `https://${demoDomain}/`,
      finalUrl: `https://${demoDomain}/`,
      statusCode: 200,
      responseTimeMs: 120,
      title: 'Milquu Fresh | Premium Dairy & Grocery Delivery',
      metaDescription: 'Order fresh milk, groceries, and premium dairy products delivered straight to your door.',
      h1: ['Welcome to Milquu Fresh'],
      wordCount: 850,
      performance: {
        create: {
          performanceScore: 82,
          accessibilityScore: 90,
          bestPracticesScore: 100,
          seoScore: 92,
          lcpMs: 2500,
          inpMs: 150,
          clsScore: 0.1,
        }
      }
    },
  });

  const pageProducts = await prisma.page.create({
    data: {
      crawlJobId: crawlJob.id,
      url: `https://${demoDomain}/products`,
      finalUrl: `https://${demoDomain}/products`,
      statusCode: 200,
      responseTimeMs: 180,
      title: 'Our Products - Milquu Fresh',
      h1: ['Fresh Products Daily'],
      wordCount: 1200,
      performance: {
        create: {
          performanceScore: 75,
          accessibilityScore: 85,
          bestPracticesScore: 95,
          seoScore: 80,
          lcpMs: 3200,
          inpMs: 200,
          clsScore: 0.25, // Needs improvement
        }
      }
    },
  });

  const pageAbout = await prisma.page.create({
    data: {
      crawlJobId: crawlJob.id,
      url: `https://${demoDomain}/about-us`,
      finalUrl: `https://${demoDomain}/about-us`,
      statusCode: 200,
      responseTimeMs: 95,
      title: 'About Us', // Suboptimal title
      metaDescription: '', // Missing meta description
      h1: ['About Milquu Fresh'],
      wordCount: 500,
      performance: {
        create: {
          performanceScore: 95,
          accessibilityScore: 100,
          bestPracticesScore: 100,
          seoScore: 65, // Low due to missing SEO tags
          lcpMs: 1200,
          inpMs: 50,
          clsScore: 0.05,
        }
      }
    },
  });

  // 5. Create Issues & AI Recommendations
  console.log('🚨 Creating Issues and AI Fixes...');

  // Issue 1: Missing Meta Description on About page
  const issue1 = await prisma.issue.create({
    data: {
      crawlJobId: crawlJob.id,
      pageId: pageAbout.id,
      issueType: 'MISSING_META_DESCRIPTION',
      severity: IssueSeverity.HIGH,
      affectedUrl: pageAbout.url,
      description: 'The about-us page is missing a meta description tag.',
      recommendation: 'Add a compelling meta description under 160 characters to improve CTR.',
      status: IssueStatus.OPEN,
      aiFixAvailable: true,
      aiRecommendation: {
        create: {
          whyItMatters: 'Meta descriptions act as organic ad copy in search results. Without one, Google will pick random text from the page, which often lowers click-through rates (CTR).',
          seoImpact: 'Directly impacts Click-Through Rate (CTR) from SERPs, which is a ranking signal.',
          businessImpact: 'Lower CTR means fewer visitors and potential customers discovering your brand story.',
          priorityScore: 85,
          generatedByModel: 'claude-opus-5',
          expectedOutcome: '15-20% increase in organic click-through rate for the About Us page.',
          recommendedFixPatch: JSON.stringify({
            target: 'nextjs-metadata',
            key: 'description',
            value: 'Learn about Milquu Fresh, our commitment to quality dairy, and how we bring farm-fresh products directly to your doorstep every morning.'
          })
        }
      }
    }
  });

  // Issue 2: Poor CLS on Products Page
  const issue2 = await prisma.issue.create({
    data: {
      crawlJobId: crawlJob.id,
      pageId: pageProducts.id,
      issueType: 'POOR_CORE_WEB_VITALS_CLS',
      severity: IssueSeverity.CRITICAL,
      affectedUrl: pageProducts.url,
      description: 'Cumulative Layout Shift (CLS) is 0.25, which exceeds the recommended 0.1 threshold.',
      recommendation: 'Ensure all product images have explicit width and height attributes to prevent layout shifting during load.',
      status: IssueStatus.OPEN,
      aiFixAvailable: true,
      aiRecommendation: {
        create: {
          whyItMatters: 'High CLS frustrates users because the page content jumps around as they try to click or read. This is a key Core Web Vital metric.',
          seoImpact: 'Google uses Core Web Vitals as a ranking factor. A poor score will suppress rankings across all product pages.',
          businessImpact: 'High layout shift directly correlates with higher bounce rates and lower conversion rates.',
          priorityScore: 95,
          generatedByModel: 'gemini-2.5-pro',
          expectedOutcome: 'Passing Core Web Vitals assessment and improved mobile conversion rates.',
          recommendedFixPatch: JSON.stringify({
            strategy: 'Find all <img> tags in the ProductGrid component and add explicit width={300} and height={300} attributes, or use next/image with fill layout and aspect ratio.'
          })
        }
      }
    }
  });

  // Issue 3: Duplicate H1
  const issue3 = await prisma.issue.create({
    data: {
      crawlJobId: crawlJob.id,
      pageId: pageHome.id,
      issueType: 'DUPLICATE_H1',
      severity: IssueSeverity.MEDIUM,
      affectedUrl: pageHome.url,
      description: 'Multiple H1 tags found on the homepage.',
      recommendation: 'Ensure only one H1 tag is present per page. Change secondary headings to H2.',
      status: IssueStatus.OPEN,
      aiFixAvailable: false,
    }
  });

  console.log('✅ Demo data seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
