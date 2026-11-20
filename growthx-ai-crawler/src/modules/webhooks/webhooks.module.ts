import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SecurityModule } from '../security/security.module';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhooksController } from './webhooks.controller';

@Global()
@Module({
  imports: [DatabaseModule, SecurityModule],
  controllers: [WebhooksController],
  providers: [WebhookDispatcherService],
  exports: [WebhookDispatcherService],
})
export class WebhooksModule {}
