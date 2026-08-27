import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

/**
 * Browser origins allowed to call this API with credentials.
 *
 * Reflecting every origin (`origin: true`) alongside `credentials: true` means
 * any site can drive the API as a logged-in user, so the allowlist is explicit.
 * In development we default to the local Next.js ports; in production an unset
 * list means "same-origin only" rather than "everyone".
 */
function corsOrigins(): string[] {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length > 0) return configured;
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://localhost:3001'];
  }
  return [];
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // rawBody is required to verify the Razorpay webhook HMAC, which is computed
  // over the exact bytes sent rather than the re-serialised JSON.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Render terminates TLS at its own proxy. Without this, `req.ip` is the
  // proxy's address for every caller, so the rate limiter would put all traffic
  // in a single shared bucket — one busy client would lock everyone out.
  app.set('trust proxy', 1);

  const allowedOrigins = corsOrigins();
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  logger.log(
    allowedOrigins.length > 0
      ? `CORS allowed origins: ${allowedOrigins.join(', ')}`
      : 'CORS: no cross-origin requests allowed (set CORS_ALLOWED_ORIGINS)',
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger enumerates every route and payload shape, so it stays off in
  // production unless someone deliberately opts in.
  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER_DOCS === 'true';

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('GrowthX AI Enterprise Crawler API')
      .setDescription('Production-grade technical SEO audit engine and automated website crawler for GrowthX AI.')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 GrowthX AI Enterprise Crawler API running on port: ${port}`);
  logger.log(
    swaggerEnabled
      ? `📚 Swagger documentation available at: http://localhost:${port}/api/docs`
      : '📚 Swagger documentation disabled (set ENABLE_SWAGGER_DOCS=true to enable)',
  );
}

/**
 * Boot failures have to explain themselves.
 *
 * `bootstrap()` was called bare. Node treats an unhandled rejection as fatal, so
 * anything thrown on the way to `app.listen` — a module that cannot initialise,
 * a dependency that will not resolve — ended the process with no message the
 * platform log could attribute, surfacing only as "Application exited early"
 * and "No open ports detected".
 *
 * The listeners below cover the same gap for failures after the server is up: a
 * rejected promise in a request handler or a background job should be recorded,
 * not silently take down an API that is otherwise serving.
 */
const bootLogger = new Logger('Bootstrap');

process.on('unhandledRejection', (reason) => {
  bootLogger.error(`Unhandled promise rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
});

process.on('uncaughtException', (error) => {
  bootLogger.error(`Uncaught exception: ${error.stack ?? error.message}`);
});

bootstrap().catch((error) => {
  bootLogger.error(
    `The API failed to start and never reached app.listen(): ${error instanceof Error ? error.stack : String(error)}`,
  );
  // Exit non-zero so the platform restarts rather than holding a dead container
  // open while it scans for a port that will never be bound.
  process.exit(1);
});
