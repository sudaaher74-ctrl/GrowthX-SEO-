import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { GoogleBusinessService } from './google-business.service';
import { GoogleBusinessController } from './google-business.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [IntegrationsService, GoogleBusinessService],
  controllers: [IntegrationsController, GoogleBusinessController],
  exports: [GoogleBusinessService]
})
export class IntegrationsModule {}
