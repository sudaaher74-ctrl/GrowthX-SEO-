import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const p = await prisma.project.findFirst({ where: { name: 'Milquufresh SEO' }, include: { website: true } });
  if (!p) { console.log('No project'); return; }
  console.log('Project ID:', p.id, 'Website:', p.website?.domain);
  
  const m = await prisma.marketIntelligence.findUnique({ where: { projectId: p.id } });
  console.log('Market Intelligence:', m !== null ? 'EXISTS (TAM: ' + m.tamSize + ')' : 'MISSING');

  const i = await prisma.integrationConfig.findUnique({ where: { projectId: p.id } });
  console.log('Integrations:', i !== null ? 'EXISTS (Hubspot: ' + i.hubspotConnected + ')' : 'MISSING');

  if (p.website) {
    const crawls = await prisma.crawlJob.findMany({ where: { websiteId: p.website.id }, orderBy: { startedAt: 'desc' }, include: { pages: { include: { metrics: true } } } });
    if (crawls.length > 0) {
        console.log('Crawls:', crawls.length, 'Latest Status:', crawls[0].status);
        const pagesWithMetrics = crawls[0].pages.filter(p => p.metrics);
        console.log('Pages with metrics (Monitoring):', pagesWithMetrics.length);
        if (pagesWithMetrics.length > 0) {
            console.log('Sample score:', pagesWithMetrics[0].metrics?.performanceScore);
        }
    } else {
        console.log('Crawls: MISSING');
    }
  }
}
run().catch(console.error);
