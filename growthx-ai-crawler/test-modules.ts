import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  const website = await prisma.website.findUnique({ where: { domain: 'milquufresh.in' } });
  if (!website) return console.log("Website not found");
  const project = await prisma.project.findFirst({ where: { websiteId: website.id } });
  if (!project) return console.log("Project not found");
  
  console.log("=== Testing Modules for", website.domain, "===");
  
  const market = await prisma.marketIntelligence.findUnique({ where: { projectId: project.id } });
  console.log("Market Intelligence:", market ? "EXISTS" : "MISSING");
  
  const integrations = await prisma.integrationConfig.findUnique({ where: { projectId: project.id } });
  console.log("Integrations:", integrations ? "EXISTS" : "MISSING", "(HubSpot:", integrations?.hubspotConnected, ")");
  
  const localRankings = await prisma.localRanking.findMany({ where: { projectId: project.id } });
  console.log("Local Rankings:", localRankings.length > 0 ? `EXISTS (${localRankings.length} records)` : "MISSING");
  
  // Monitoring data is part of Project or IntegrationConfig? Wait, PerformanceScore is in CrawlMetrics.
  const latestCrawl = await prisma.crawlJob.findFirst({ 
    where: { websiteId: website.id },
    orderBy: { startedAt: 'desc' },
    include: { pages: { include: { metrics: true } } }
  });
  console.log("Latest Crawl:", latestCrawl ? `EXISTS (Status: ${latestCrawl.status})` : "MISSING");
  
  if (latestCrawl) {
    const pageWithMetrics = latestCrawl.pages.find(p => p.metrics);
    console.log("Performance Metrics (Monitoring):", pageWithMetrics?.metrics ? "EXISTS" : "MISSING");
  }
}
test().then(() => process.exit(0));
