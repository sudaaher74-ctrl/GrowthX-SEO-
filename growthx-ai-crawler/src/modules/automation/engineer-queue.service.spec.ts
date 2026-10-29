import { EngineerQueueService } from './engineer-queue.service';

describe('Engineer queue admission and durable handoff', () => {
  const setup = () => {
    const prisma = { automationRun: { findMany: jest.fn().mockResolvedValue([{ id: 'persisted-run' }]) } };
    const service = new EngineerQueueService({} as any, prisma as any, {} as any);
    const jobs = { getWaitingCount: jest.fn().mockResolvedValue(0), add: jest.fn().mockResolvedValue({}), getJobCounts: jest.fn().mockResolvedValue({ waiting: 2, active: 1 }), getWorkers: jest.fn().mockResolvedValue([{}]) };
    (service as any).jobs = jobs;
    return { service, jobs, prisma };
  };
  it('deduplicates job delivery by the persisted run id and never queues credentials', async () => {
    const { service, jobs } = setup();
    await service.enqueue('run-1');
    expect(jobs.add).toHaveBeenCalledWith('engineer', { runId: 'run-1' }, expect.objectContaining({ jobId: 'run-1', attempts: 1 }));
  });
  it('rejects overload instead of spawning unbounded API work', async () => {
    const { service, jobs } = setup(); jobs.getWaitingCount.mockResolvedValue(1000);
    await expect(service.enqueue('run')).rejects.toThrow('capacity');
    expect(jobs.add).not.toHaveBeenCalled();
  });
  it('fails explicitly when Redis is unavailable', async () => {
    const service = new EngineerQueueService({} as any, {} as any, {} as any);
    await expect(service.enqueue('run')).rejects.toThrow('unavailable');
    expect(await service.status()).toMatchObject({ available: false, waiting: null });
  });
  it('recovers the API crash window between a persisted request and queue insertion', async () => {
    const { service, jobs } = setup(); (service as any).worker = {};
    await service.reconcile();
    expect(jobs.add).toHaveBeenCalledWith('engineer', { runId: 'persisted-run' }, expect.objectContaining({ jobId: 'persisted-run' }));
  });
});
