import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ImpactController } from './impact.controller';
import { ImpactService } from './impact.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ImpactController],
  providers: [ImpactService],
  exports: [ImpactService],
})
export class ImpactModule {}
