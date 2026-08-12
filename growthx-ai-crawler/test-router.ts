import { NestFactory } from '@nestjs/core';
import { AiSearchModule } from './src/modules/ai-search/ai-search.module';
import { MultiAiRouterService, AiTask, AiProvider } from './src/modules/ai-search/multi-ai-router/multi-ai-router.service';
import { ConfigModule } from '@nestjs/config';
import { EntitlementsService } from './src/modules/billing/entitlements.service';
import { PrismaService } from './src/database/prisma.service';

import { AppModule } from './src/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    AppModule,
  );
  
  const router = app.get(MultiAiRouterService);
  
  try {
    console.log('Testing STRATEGY (Reasoning) generation...');
    const result = await router.generate({
      task: AiTask.REASONING,
      provider: AiProvider.OPENROUTER,
      prompt: 'Say hello world in 3 words.'
    });
    console.log('Success! Result:', result.text);
    console.log('Provider used:', result.provider);
  } catch (err) {
    console.error('Failed!', err);
  }
  
  await app.close();
}
bootstrap();
