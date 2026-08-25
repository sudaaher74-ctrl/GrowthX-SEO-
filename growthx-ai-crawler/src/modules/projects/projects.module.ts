import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { DatabaseModule } from '../../database/database.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
