import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Queue, Worker } from "bullmq";
import { PrismaService } from "../../database/prisma.service";
import { QueueService } from "../queue/queue.service";
import { BacklinksService } from "./backlinks.service";

type Payload = { projectId: string; sourceId: string };

@Injectable()
export class BacklinkQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BacklinkQueue.name);
  private jobs?: Queue<Payload>;
  private worker?: Worker<Payload>;
  private scheduling = false;

  constructor(
    private readonly connection: QueueService,
    private readonly prisma: PrismaService,
    private readonly backlinks: BacklinksService,
  ) {}

  async onModuleInit() {
    await this.connection.ready;
    const redis = this.connection.getRedisClient();
    if (!redis) return;
    this.jobs = new Queue<Payload>("backlink-verification", {
      connection: redis,
    });
    this.jobs.on("error", (error) => this.logger.warn(error.message));
    if (
      process.env.WORKER_MODE === "false" ||
      process.env.DISABLE_WORKERS === "true"
    )
      return;
    this.worker = new Worker<Payload>(
      "backlink-verification",
      async (job) => {
        await this.backlinks.verifySource(
          job.data.projectId,
          job.data.sourceId,
        );
      },
      {
        connection: redis,
        concurrency: 2,
        limiter: { max: 1, duration: 1500 },
      },
    );
    this.worker.on("error", (error) => this.logger.warn(error.message));
    this.worker.on("failed", (job, error) =>
      this.logger.warn(`Verification ${job?.id} failed: ${error.message}`),
    );
  }

  async status() {
    if (!this.jobs)
      return {
        available: false,
        workers: 0,
        waiting: 0,
        active: 0,
        reason:
          "Redis is unavailable. Imports can be saved, but verification is paused.",
      };
    try {
      const [workers, counts] = await Promise.all([
        this.jobs.getWorkers(),
        this.jobs.getJobCounts("waiting", "active", "delayed"),
      ]);
      return {
        available: workers.length > 0,
        workers: workers.length,
        waiting: counts.waiting + counts.delayed,
        active: counts.active,
        reason: workers.length
          ? null
          : "Start the crawler worker to verify backlink sources.",
      };
    } catch {
      return {
        available: false,
        workers: 0,
        waiting: 0,
        active: 0,
        reason: "Verification queue cannot currently be reached.",
      };
    }
  }

  async enqueue(projectId: string, sourceId?: string) {
    const status = await this.status();
    if (!status.available || !this.jobs)
      throw new ServiceUnavailableException(
        status.reason ?? "Verification is paused.",
      );
    if (status.waiting >= 200)
      throw new ServiceUnavailableException(
        "Verification queue is busy. Saved candidates will be picked up automatically.",
      );
    const cutoff = new Date(Date.now() - 10 * 60_000);
    const sources = await this.prisma.backlinkSource.findMany({
      where: {
        projectId,
        ...(sourceId ? { id: sourceId } : {}),
        OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: cutoff } }],
      },
      take: 25,
      orderBy: [{ nextCheckAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    for (const source of sources)
      await this.add({ projectId, sourceId: source.id });
    return {
      scheduled: sources.length,
      limit: 25,
      message: sources.length
        ? "Sources queued for verification. Existing queued jobs are deduplicated."
        : "No eligible source pages. A source can be checked once every ten minutes.",
    };
  }

  private async add(data: Payload) {
    await this.jobs!.add("verify", data, {
      jobId: `source-${data.sourceId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  @Interval(60_000)
  async scheduleDue() {
    if (!this.worker || !this.jobs || this.scheduling) return;
    this.scheduling = true;
    try {
      const counts = await this.jobs.getJobCounts(
        "waiting",
        "active",
        "delayed",
      );
      if (counts.waiting + counts.active + counts.delayed >= 100) return;
      // Interleave projects rather than filling the queue from one large import.
      const projects = await this.prisma.backlinkSource.findMany({
        where: { nextCheckAt: { lte: new Date() } },
        distinct: ["projectId"],
        orderBy: { nextCheckAt: "asc" },
        take: 10,
        select: { projectId: true },
      });
      for (const project of projects) {
        const sources = await this.prisma.backlinkSource.findMany({
          where: {
            projectId: project.projectId,
            nextCheckAt: { lte: new Date() },
          },
          orderBy: { nextCheckAt: "asc" },
          take: 5,
          select: { id: true },
        });
        for (const source of sources)
          await this.add({ projectId: project.projectId, sourceId: source.id });
      }
    } catch (error) {
      this.logger.warn(
        `Backlink scheduling deferred: ${(error as Error).message}`,
      );
    } finally {
      this.scheduling = false;
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.jobs?.close();
  }
}
