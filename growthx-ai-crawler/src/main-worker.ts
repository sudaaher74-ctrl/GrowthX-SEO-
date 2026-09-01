import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

// Force the worker mode before bootstrapping
process.env.WORKER_MODE = 'true';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  logger.log('Starting GrowthX Crawler Worker headlessly...');

  // We use createApplicationContext for background tasks.
  // It boots the module tree but does not start an HTTP server.
  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();
  
  logger.log('🚀 Crawler Worker running and listening for jobs on BullMQ!');
}

const bootLogger = new Logger('WorkerBootstrap');

process.on('unhandledRejection', (reason) => {
  bootLogger.error(`Unhandled promise rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
});

process.on('uncaughtException', (error) => {
  bootLogger.error(`Uncaught exception: ${error.stack ?? error.message}`);
});

bootstrap().catch((error) => {
  bootLogger.error(
    `The Worker failed to start: ${error instanceof Error ? error.stack : String(error)}`,
  );
  process.exit(1);
});
