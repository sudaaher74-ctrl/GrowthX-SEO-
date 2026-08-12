import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AiVisibilityService } from './src/modules/ai-visibility/ai-visibility.service';
import { PrismaService } from './src/database/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const visibilityService = app.get(AiVisibilityService);
  const prisma = app.get(PrismaService);
  
  const projectId = 'a36737c1-6b14-42d8-b91b-745c525f2ac4'; // aiva
  console.log(`Running sweep for project: ${projectId}`);
  
  // ensure there's at least one prompt
  await prisma.trackedPrompt.upsert({
    where: { projectId_text: { projectId, text: 'Recommend software for tracking SEO growth' } },
    update: {},
    create: { projectId, text: 'Recommend software for tracking SEO growth' }
  });
  
  try {
    const result = await visibilityService.sweepProject(projectId, { skipEntitlementCheck: true });
    console.log('Sweep Result:', result);
  } catch (error) {
    console.error('Sweep Failed:', error);
  }
  
  await app.close();
}
bootstrap();
