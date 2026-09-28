import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SavedPlansController } from './saved-plans.controller';
import { SavedPlansService } from './saved-plans.service';

/** Saved plans and action-plan ticks, kept per project on the server. */
@Module({
  imports: [DatabaseModule],
  controllers: [SavedPlansController],
  providers: [SavedPlansService],
})
export class SavedPlansModule {}
