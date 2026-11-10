import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { DatabaseModule } from '../../database/database.module';
import { OrgContextService } from './org-context.service';
import { SubscriptionQuotaService } from './subscription-quota.service';

@Module({
  imports: [DatabaseModule],
  providers: [OrganizationsService, OrgContextService, SubscriptionQuotaService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService, OrgContextService, SubscriptionQuotaService],
})
export class OrganizationsModule {}
