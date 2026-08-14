import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const p = await prisma.project.findFirst({ where: { name: 'Milquufresh SEO' } });
  if (!p) { console.log('No project'); return; }
  console.log('Project ID:', p.id);
  
  const m = await prisma.marketIntelligence.findUnique({ where: { projectId: p.id } });
  console.log('Market Intelligence:', m !== null ? 'EXISTS' : 'MISSING');

  const i = await prisma.integrationConfig.findUnique({ where: { projectId: p.id } });
  console.log('Integrations:', i !== null ? 'EXISTS' : 'MISSING');

  const r = await prisma.localRanking.findMany({ where: { projectId: p.id } });
  console.log('Local Rankings:', r.length);
}
run().catch(console.error);
