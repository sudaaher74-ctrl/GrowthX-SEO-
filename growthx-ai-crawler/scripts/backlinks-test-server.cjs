/* Local-only browser test harness. Never imported by the application. */
const path = require('path');
process.env.TS_NODE_PROJECT = path.resolve(__dirname, '../tsconfig.json');
require('ts-node/register/transpile-only');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { createServer } = require('http');
const { Module, ValidationPipe } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { PassportModule } = require('@nestjs/passport');
const { JwtService } = require('@nestjs/jwt');
const Redis = require('ioredis');
const { PrismaService } = require('../src/database/prisma.service');
const { JwtStrategy } = require('../src/modules/auth/jwt.strategy');
const { JwtAuthGuard } = require('../src/modules/auth/jwt-auth.guard');
const { CsrfGuard } = require('../src/modules/auth/csrf.guard');
const { QueueService } = require('../src/modules/queue/queue.service');
const { BacklinkFetcher } = require('../src/modules/backlinks/backlink-fetcher.service');
const { BacklinkQueue } = require('../src/modules/backlinks/backlink-queue.service');
const { BacklinksController } = require('../src/modules/backlinks/backlinks.controller');
const { BacklinksService } = require('../src/modules/backlinks/backlinks.service');
const { BacklinkAnalyticsService } = require('../src/modules/backlinks/backlink-analytics.service');
const { BacklinkDiscovery } = require('../src/modules/backlinks/backlink-discovery.service');
const { PublicBacklinkIndex } = require('../src/modules/backlinks/public-backlink-index.service');
const { publicAxios } = require('../src/modules/security/ssrf');

async function main() {
  const database = new URL(process.env.DATABASE_URL || 'http://missing');
  if (database.hostname !== '127.0.0.1' || database.port !== '55439' || !database.pathname.endsWith('_test') || process.env.REDIS_URL !== 'redis://127.0.0.1:56389' || !process.env.BACKLINKS_TEST_MANIFEST) {
    throw new Error('Use only the disposable database, Redis and explicit manifest path documented in docs/backlink-intelligence.md.');
  }
  const secret = randomUUID() + randomUUID();
  process.env.JWT_SECRET = secret;
  process.env.AUTH_DEV_BYPASS = 'false';
  process.env.ALLOW_PRIVATE_CRAWL_TARGETS = 'true';
  process.env.CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:3211';
  const db = new PrismaService(); await db.$connect();
  const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null, db: 2 });
  const tag = randomUUID();
  const organization = await db.organization.create({ data: { name: 'Backlink browser test', slug: `backlinks-browser-${tag}` } });
  const user = await db.user.create({ data: { email: `backlinks-browser-${tag}@example.test`, passwordHash: 'unused-test-hash' } });
  await db.organizationMember.create({ data: { organizationId: organization.id, userId: user.id, role: 'OWNER' } });
  const project = await db.project.create({ data: { name: 'Backlink browser test', organizationId: organization.id } });
  const website = await db.website.create({ data: { projectId: project.id, domain: 'client.example', url: 'https://client.example/', scope: 'own' } });
  await db.competitorDomain.create({ data: { projectId: project.id, domain: 'rival.example' } });
  const job = await db.crawlJob.create({ data: { websiteId: website.id, status: 'COMPLETED', finishedAt: new Date() } });
  const targetUrl = 'https://client.example/service';
  const page = await db.page.create({ data: { crawlJobId: job.id, url: targetUrl, finalUrl: targetUrl, statusCode: 404, indexability: 'NOT_INDEXABLE', responseTimeMs: 1 } });
  let earned = false;
  const sourceHtml = (own) => `<html><head><title>Independent publisher</title></head><body><p>An editorial resource for the browser integration test.</p><a href="https://rival.example/product">Rival product</a>${own ? `<a href="${targetUrl}" rel="nofollow">Client service</a>` : ''}</body></html>`;
  function fixture(own) { return createServer((req, res) => {
    if (req.url === '/robots.txt') return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(sourceHtml(own || earned));
  }); }
  const ownServer = fixture(true), competitorServer = fixture(false);
  await new Promise((resolve) => ownServer.listen(0, '127.0.0.1', resolve));
  await new Promise((resolve) => competitorServer.listen(0, '::1', resolve));
  const ownSource = `http://127.0.0.1:${ownServer.address().port}/resource`;
  const competitorSource = `http://[::1]:${competitorServer.address().port}/resource`;
  class BrowserTestModule {}
  Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })], controllers: [BacklinksController],
    providers: [
      { provide: PrismaService, useValue: db },
      { provide: QueueService, useValue: { ready: Promise.resolve(), getRedisClient: () => redis } },
      { provide: JwtStrategy, useFactory: () => new JwtStrategy({}, { findById: (id) => db.user.findUnique({ where: { id } }) }, db) },
      JwtAuthGuard, BacklinksService, BacklinkFetcher, BacklinkQueue, BacklinkAnalyticsService, BacklinkDiscovery, PublicBacklinkIndex,
    ],
  })(BrowserTestModule);
  const app = await NestFactory.create(BrowserTestModule, { logger: false });
  // External discovery boundaries are deterministic fixtures; publisher checks,
  // authentication, persistence and queue processing remain real.
  app.get(PublicBacklinkIndex).grow=async()=>({status:'PARTIAL',reason:'Isolated browser-test archive fixture.'});
  const actualGet=publicAxios.get.bind(publicAxios);
  publicAxios.get=(url,config)=>url==='https://en.wikipedia.org/w/api.php'?Promise.resolve({data:{query:{exturlusage:[]}}}):actualGet(url,config);
  const fetcher=app.get(BacklinkFetcher),actualFetch=fetcher.fetch.bind(fetcher);
  fetcher.fetch=(url)=>url==='https://client.example/'?Promise.resolve({outcome:'READ',html:'<html><body>Fixture website</body></html>',finalUrl:url,reason:'Isolated footprint fixture.'}):actualFetch(url);
  const discoveryEdgeId='browser-discovery-'+tag;
  app.use(require('cookie-parser')());
  app.useGlobalGuards(new CsrfGuard());
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const accessToken = new JwtService({ secret }).sign({ sub: user.id, email: user.email, organizationId: organization.id }, { expiresIn: '30m' });
  let closing = false;
  async function close() {
    if (closing) return; closing = true;
    clearTimeout(expiry);
    await app.close(); ownServer.close(); competitorServer.close();
    await db.publicBacklinkEdge.deleteMany({where:{id:discoveryEdgeId}});
    await db.organization.delete({ where: { id: organization.id } }); await db.user.delete({ where: { id: user.id } });
    await redis.quit(); await db.$disconnect();
  }
  const expiry = setTimeout(() => close().then(() => process.exit(0)), 20 * 60_000);
  const server = app.getHttpAdapter().getInstance();
  server.get('/organizations', (_req, res) => res.json([organization]));
  server.get(`/projects/org/${organization.id}`, (_req, res) => res.json([project]));
  server.post('/__test__/reset', async (req, res) => {
    if (req.headers.authorization !== `Bearer ${accessToken}`) return res.sendStatus(403);
    earned = false;
    await db.growthOpportunity.deleteMany({ where: { projectId: project.id, source: 'BACKLINKS' } });
    await db.backlinkSource.deleteMany({ where: { projectId: project.id } });
    await db.backlinkDiscoveryRun.deleteMany({where:{projectId:project.id}});
    await db.publicBacklinkEdge.deleteMany({where:{id:discoveryEdgeId}});
    await db.page.update({ where: { id: page.id }, data: { statusCode: 404, indexability: 'NOT_INDEXABLE', crawledAt: new Date() } });
    res.json({ ok: true });
  });
  server.post('/__test__/audit-fixed', async (req, res) => {
    if (req.headers.authorization !== `Bearer ${accessToken}`) return res.sendStatus(403);
    await db.page.update({ where: { id: page.id }, data: { statusCode: 200, indexability: 'INDEXABLE', crawledAt: new Date() } }); res.json({ ok: true });
  });
  server.post('/__test__/prepare-discovery',async(req,res)=>{
    if(req.headers.authorization!==`Bearer ${accessToken}`) return res.sendStatus(403);
    await db.publicBacklinkEdge.upsert({where:{id:discoveryEdgeId},update:{},create:{id:discoveryEdgeId,sourceUrl:ownSource.replace('/resource','/discovered'),targetUrl,targetHost:'client.example',targetRoot:'client.example',archivePath:'isolated-browser-fixture',archivedAt:new Date()}});
    res.json({ok:true});
  });
  server.post('/__test__/publisher-link', async (req, res) => {
    if (req.headers.authorization !== `Bearer ${accessToken}`) return res.sendStatus(403);
    earned = true;
    await db.backlinkSource.updateMany({ where: { projectId: project.id }, data: { lastAttemptAt: new Date(Date.now() - 11 * 60_000) } });
    res.json({ ok: true });
  });
  server.post('/__test__/shutdown', (req, res) => {
    if (req.headers.authorization !== `Bearer ${accessToken}`) return res.sendStatus(403);
    res.json({ ok: true }); setImmediate(() => close().then(() => process.exit(0)));
  });
  await app.listen(3412, '127.0.0.1');
  fs.writeFileSync(process.env.BACKLINKS_TEST_MANIFEST, JSON.stringify({ apiBase: await app.getUrl(), organizationId: organization.id, projectId: project.id, token: accessToken, csrfToken: randomUUID(), ownSource, competitorSource, targetUrl }));
  console.log('Backlink browser test API ready at http://127.0.0.1:3412 (disposable local data).');
}
main().catch((error) => { console.error(error.message); process.exit(1); });
