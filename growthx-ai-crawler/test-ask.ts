import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { MarketResearchService } from './src/modules/market-research/market-research.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(MarketResearchService);
  try {
    // we need a valid orgId and projectId in the local DB. Let's create them or find the first one.
    const { PrismaService } = require('./src/database/prisma.service');
    const prisma = app.get(PrismaService);
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({ data: { name: 'Test Org' } });
    }
    let project = await prisma.project.findFirst({ where: { organizationId: org.id } });
    if (!project) {
      project = await prisma.project.create({ data: { name: 'Test Project', organizationId: org.id } });
    }

    console.log('Testing ask...');
    const result = await service.ask({
      organizationId: org.id,
      projectId: project.id,
      question: "How does this market compare to last year?"
    });
    console.log('Result:', result);
  } catch (error) {
    console.error('Error during ask:', error);
  }
  await app.close();
}
bootstrap();
