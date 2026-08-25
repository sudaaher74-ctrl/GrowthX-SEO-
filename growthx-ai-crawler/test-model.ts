import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ModelRouterService, ModelRole } from './src/modules/market-research/model-router.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const router = app.get(ModelRouterService);
  console.log('Provider:', router.provider());
  
  try {
    const res = await router.generate({
      step: 'test',
      role: ModelRole.WORKER,
      instructions: 'You are a test bot',
      input: 'Say hello'
    });
    console.log('Success:', res.text);
  } catch (e) {
    console.error('Failed:', e);
  }
  await app.close();
}
bootstrap();
