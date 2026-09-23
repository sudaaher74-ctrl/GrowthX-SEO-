import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ArmAssignmentService } from './arm-assignment.service';
import { ImpactController } from './impact.controller';
import { ImpactService } from './impact.service';
import { OutcomeMeasurementService } from './outcome-measurement.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ImpactController],
  providers: [ImpactService, ArmAssignmentService, OutcomeMeasurementService],
  exports: [ImpactService, ArmAssignmentService, OutcomeMeasurementService],
})
export class ImpactModule {}
