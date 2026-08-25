import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { DatabaseModule } from '../../database/database.module';
import { OrgContextService } from './org-context.service';

@Module({
  imports: [DatabaseModule],
  providers: [OrganizationsService, OrgContextService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService, OrgContextService],
})
export class OrganizationsModule {}
