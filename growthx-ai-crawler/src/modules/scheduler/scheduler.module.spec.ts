import { scheduledJobsEnabled } from './scheduler.module';

describe('scheduledJobsEnabled', () => {
  it('runs schedules on the current single API host by default', () => {
    expect(scheduledJobsEnabled({})).toBe(true);
  });

  it('never runs schedules on a worker', () => {
    expect(scheduledJobsEnabled({ WORKER_MODE: 'true' })).toBe(false);
  });

  it('allows replica API hosts to opt out of schedules', () => {
    expect(scheduledJobsEnabled({ SCHEDULER_ENABLED: 'false' })).toBe(false);
  });
});
