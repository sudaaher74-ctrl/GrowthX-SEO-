import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ModelRouterService, ModelRole } from './src/modules/market-research/model-router.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const router = app.get(ModelRouterService);
  
  try {
    const res = await router.generate({
      step: 'test-json',
      role: ModelRole.WORKER,
      instructions: 'Return a JSON object with a "name" string and "age" number.',
      input: 'John is 30',
      jsonSchema: {
        name: 'person',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' }
          },
          required: ['name', 'age'],
          additionalProperties: false
        }
      }
    });
    console.log('Success:', res.text);
  } catch (e: any) {
    console.error('Failed:', e.message);
    if (e.response) console.error('Response:', e.response.data);
  }
  await app.close();
}
bootstrap();
