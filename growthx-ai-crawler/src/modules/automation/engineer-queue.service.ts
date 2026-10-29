import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Interval } from '@nestjs/schedule';
import { Queue, Worker } from 'bullmq';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../database/prisma.service';

/** Durable job bodies live in the database; Redis contains only a run id. */
@Injectable()
export class EngineerQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EngineerQueueService.name);
  private jobs?: Queue<{ runId: string }>;
  private worker?: Worker<{ runId: string }>;
  private workerConnection?: ReturnType<QueueService['getRedisClient']>;
  private reconciling = false;

  constructor(private readonly connection: QueueService, private readonly prisma: PrismaService, private readonly moduleRef: ModuleRef) {}

  async onModuleInit() {
    await this.connection.ready;
    const redis = this.connection.getRedisClient();
    if (!redis) return;
    this.jobs = new Queue('github-engineer', { connection: redis });
    this.jobs.on('error', () => this.logger.warn('Engineer queue connection unavailable.'));
    // A shared limit applies across all worker processes, not once per replica.
    await this.jobs.setGlobalConcurrency(2);
    if (process.env.WORKER_MODE === 'false' || process.env.DISABLE_WORKERS === 'true') return;
    const { EngineerAgentService } = await import('./engineer-agent.service');
    const workerConnection = redis.duplicate({ maxRetriesPerRequest: null });
    this.workerConnection = workerConnection;
    this.worker = new Worker('github-engineer', async job => {
      return this.moduleRef.get(EngineerAgentService, { strict: false }).executeQueued(job.data.runId);
    }, { connection: workerConnection, concurrency: 2, maxStalledCount: 0 });
    this.worker.on('error', () => this.logger.warn('Engineer worker connection unavailable.'));
    this.worker.on('failed', (job) => {
      if (!job) return;
      // Never automatically replay a job that might already have pushed a PR.
      void this.prisma.automationRun.updateMany({
        where: { id: job.data.runId, status: { in: ['PENDING', 'RUNNING'] } },
        data: { status: 'FAILED', finishedAt: new Date(), error: 'The worker was interrupted. Review repository activity before retrying; this job was not replayed automatically.' },
      }).catch(() => this.logger.error('Could not record interrupted engineer job.'));
    });
    await this.reconcile();
  }

  async enqueue(runId: string) {
    if (!this.jobs) throw new ServiceUnavailableException('Fix Engine queue is unavailable. Your repository has not been changed.');
    if (await this.jobs.getWaitingCount() >= 1000) throw new ServiceUnavailableException('Fix Engine queue is at capacity. Please retry later.');
    await this.jobs.add('engineer', { runId }, { jobId: runId, attempts: 1, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800, count: 1000 } });
  }

  async status() {
    if (!this.jobs) return { available: false, waiting: null, active: null, workers: 0 };
    try {
      const [counts, workers] = await Promise.all([this.jobs.getJobCounts('waiting', 'active'), this.jobs.getWorkers()]);
      return { available: true, waiting: counts.waiting, active: counts.active, workers: workers.length };
    } catch { return { available: false, waiting: null, active: null, workers: 0 }; }
  }

  /** Recover the database→Redis handoff if an API process exits between them. */
  @Interval(30000)
  async reconcile() {
    if (!this.worker || !this.jobs || this.reconciling) return;
    this.reconciling = true;
    try {
      const pending = await this.prisma.automationRun.findMany({ where: { status: 'PENDING', steps: { path: ['0', 'step'], equals: 'engineer_request' } }, orderBy: { startedAt: 'asc' }, take: 100, select: { id: true } });
      for (const run of pending) await this.enqueue(run.id);
    } catch { this.logger.warn('Engineer queue reconciliation will retry.'); }
    finally { this.reconciling = false; }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.workerConnection?.quit();
    await this.jobs?.close();
  }
}
