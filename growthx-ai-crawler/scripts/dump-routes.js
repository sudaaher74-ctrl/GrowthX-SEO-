// Boots the Nest app in-memory (no listen) and prints every registered route.
// Used to verify controller mount paths without deploying.
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');

(async () => {
  const app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
  await app.init();
  const server = app.getHttpAdapter().getInstance();
  const routes = [];
  for (const layer of server._router.stack) {
    if (layer.route) {
      for (const m of Object.keys(layer.route.methods)) {
        routes.push(`${m.toUpperCase().padEnd(6)} ${layer.route.path}`);
      }
    }
  }
  routes.sort().forEach((r) => console.log(r));
  console.log(`\nTOTAL ${routes.length}`);
  await app.close();
  process.exit(0);
})().catch((e) => {
  console.error('BOOT FAILED:', e.message);
  process.exit(1);
});
