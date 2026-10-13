import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';

export function scheduledJobsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  // A worker consumes BullMQ jobs. Running every API cron again on each worker
  // duplicates maintenance and customer-facing syncs when hosts are scaled out.
  return env.WORKER_MODE !== 'true' && env.SCHEDULER_ENABLED !== 'false';
}

@Global()
@Module({
  imports: [ScheduleModule.forRootAsync({
    useFactory: () => ({
      cronJobs: scheduledJobsEnabled(),
      intervals: scheduledJobsEnabled(),
      timeouts: scheduledJobsEnabled(),
    }),
  })],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class CrawlerSchedulerModule {}
