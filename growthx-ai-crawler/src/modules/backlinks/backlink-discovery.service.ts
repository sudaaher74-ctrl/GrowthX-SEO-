import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Queue, Worker } from "bullmq";
import { PrismaService } from "../../database/prisma.service";
import { QueueService } from "../queue/queue.service";
import { publicAxios } from "../security/ssrf";
import { BacklinksService } from "./backlinks.service";
import { BacklinkFetcher } from "./backlink-fetcher.service";
import { BacklinkQueue } from "./backlink-queue.service";
import { PublicBacklinkIndex } from "./public-backlink-index.service";
import { belongsTo, hostOf, kindOf, linkUrl } from "./backlink-evidence";
import { referringDomain } from "./backlink-analytics.helpers";
import { footprintLinks } from "./public-backlink-index";
import { randomUUID } from "crypto";

type Detail = {
  provider: string;
  status: string;
  candidates: number;
  reason?: string;
};

@Injectable()
export class BacklinkDiscovery implements OnModuleInit, OnModuleDestroy {
  private jobs?: Queue<{ runId: string }>;
  private worker?: Worker<{ runId: string }>;
  private readonly logger = new Logger(BacklinkDiscovery.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly connection: QueueService,
    private readonly backlinks: BacklinksService,
    private readonly fetcher: BacklinkFetcher,
    private readonly verification: BacklinkQueue,
    private readonly index: PublicBacklinkIndex,
  ) {}

  async onModuleInit() {
    await this.connection.ready;
    const redis = this.connection.getRedisClient();
    if (!redis) return;
    this.jobs = new Queue("backlink-discovery", { connection: redis });
    this.jobs.on("error", (error) => this.logger.warn(error.message));
    await this.jobs.setGlobalConcurrency(1);
    if (
      process.env.WORKER_MODE === "false" ||
      process.env.DISABLE_WORKERS === "true"
    )
      return;
    this.worker = new Worker(
      "backlink-discovery",
      (job) => this.run(job.data.runId),
      {
        connection: redis,
        concurrency: 1,
        limiter: { max: 1, duration: 10000 },
        lockDuration: 60000,
      },
    );
    this.worker.on("error", (error) => this.logger.warn(error.message));
    this.worker.on("failed", (job, error) => {
      this.logger.warn(`Discovery ${job?.id} failed: ${error.message}`);
      if (job)
        void this.prisma.backlinkDiscoveryRun
          .updateMany({
            where: {
              id: job.data.runId,
              status: { in: ["QUEUED", "RUNNING"] },
            },
            data: {
              status: "FAILED",
              stage: "Discovery interrupted",
              error:
                "The discovery worker could not finish. Saved candidates are retained; you can retry.",
              finishedAt: new Date(),
            },
          })
          .catch(() => undefined);
    });
  }

  async status(projectId: string) {
    const run = await this.prisma.backlinkDiscoveryRun.findFirst({
      where: { projectId },
      orderBy: { startedAt: "desc" },
    });
    const [coverage, workers] = await Promise.all([
      this.index.coverage(),
      this.jobs?.getWorkers().catch(() => []) ?? [],
    ]);
    const progress = run?.sourceIds.length
      ? await this.prisma.backlinkSource.findMany({
          where: { projectId, id: { in: run.sourceIds } },
          select: {
            lastAttemptAt: true,
            links: {
              where: {
                targetKind: "OWN",
                status: "VERIFIED",
                lastVerifiedAt: { gte: new Date(Date.now() - 7 * 86400000) },
              },
              select: { id: true },
            },
          },
        })
      : [];
    return {
      run: run
        ? {
            ...run,
            sourceIds: undefined,
            checked: progress.filter(
              (source) =>
                source.lastAttemptAt &&
                source.lastAttemptAt >=
                  new Date(run.startedAt.getTime() - 10 * 60000),
            ).length,
            verified: progress.reduce(
              (sum, source) => sum + source.links.length,
              0,
            ),
          }
        : null,
      index: coverage,
      available: workers.length > 0,
      coverage:
        "Discovery searches a growing public archive index, Wikimedia external links, and your public web footprint. No paid data API or complete web coverage is claimed.",
    };
  }

  async start(projectId: string) {
    const context = await this.backlinks.context(projectId);
    if (!context.own.length)
      throw new BadRequestException("Add a website to this project first.");
    if (!this.jobs || !(await this.jobs.getWorkers()).length)
      throw new ServiceUnavailableException(
        "Discovery worker is unavailable. Please retry when it is running.",
      );
    const redis = this.connection.getRedisClient()!;
    const lock = `backlinks:discover:${projectId}`;
    const token = randomUUID();
    if (!(await redis.set(lock, token, "PX", 10000, "NX")))
      throw new BadRequestException("Discovery is already being requested.");
    try {
      const previous = await this.prisma.backlinkDiscoveryRun.findFirst({
        where: { projectId },
        orderBy: { startedAt: "desc" },
      });
      if (previous && ["QUEUED", "RUNNING"].includes(previous.status)) {
        const job = await this.jobs.getJob(previous.id);
        if (
          job &&
          ["active", "waiting", "delayed", "waiting-children"].includes(
            await job.getState(),
          )
        )
          return {
            message: "Discovery is already running.",
            runId: previous.id,
          };
        await this.prisma.backlinkDiscoveryRun.update({
          where: { id: previous.id },
          data: {
            status: "FAILED",
            error:
              "Previous discovery was interrupted. Start again to continue.",
            finishedAt: new Date(),
          },
        });
      }
      if (
        previous?.finishedAt &&
        previous.status !== "FAILED" &&
        Date.now() - previous.finishedAt.getTime() < 6 * 3600000
      )
        return {
          message:
            "Discovery ran recently. Existing candidates continue live verification; discovery can run again after six hours.",
          runId: previous.id,
        };
      if ((await this.jobs.getWaitingCount()) >= 20)
        throw new ServiceUnavailableException(
          "Discovery is busy. Retry after existing projects finish.",
        );
      const run = await this.prisma.backlinkDiscoveryRun.create({
        data: { projectId },
      });
      try {
        await this.jobs.add(
          "discover",
          { runId: run.id },
          {
            jobId: run.id,
            attempts: 1,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      } catch (error) {
        await this.prisma.backlinkDiscoveryRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            error: "Could not queue discovery.",
            finishedAt: new Date(),
          },
        });
        throw error;
      }
      return {
        message:
          "Discovery started. Candidates will be verified automatically as they arrive.",
        runId: run.id,
      };
    } finally {
      await redis.eval(
        "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
        1,
        lock,
        token,
      );
    }
  }

  async run(runId: string) {
    const run = await this.prisma.backlinkDiscoveryRun.findUnique({
      where: { id: runId },
    });
    if (!run || !["QUEUED", "RUNNING"].includes(run.status)) return;
    const details: Detail[] = [];
    const candidates = new Map<string, string>();
    const stage = async (text: string) =>
      this.prisma.backlinkDiscoveryRun.update({
        where: { id: runId },
        data: {
          status: "RUNNING",
          stage: text,
          details,
          candidates: candidates.size,
        },
      });
    try {
      const context = await this.backlinks.context(run.projectId);
      const roots = [
        ...new Set(
          [...context.own, ...context.competitors].map((host) =>
            referringDomain("https://" + host),
          ),
        ),
      ];
      const add = (url: string, provider: string) => {
        try {
          const source = linkUrl(url);
          if (candidates.size < 100 && !belongsTo(hostOf(source), context.own))
            if (!candidates.has(source)) candidates.set(source, provider);
        } catch {
          /* Reject unsafe URLs. */
        }
      };
      await stage("Looking up the public backlink index");
      const readIndex = async () => {
        const rows = await this.prisma.publicBacklinkEdge.findMany({
          where: { targetRoot: { in: roots } },
          orderBy: { indexedAt: "desc" },
          take: 1000,
        });
        for (const row of rows)
          if (kindOf(row.targetUrl, context.own, context.competitors))
            add(row.sourceUrl, "COMMON_CRAWL");
      };
      await readIndex();
      details.push({
        provider: "Public reverse index",
        status: "SEARCHED",
        candidates: candidates.size,
      });

      await stage("Finding pages in Wikimedia external-link indexes");
      const beforeWiki = candidates.size;
      let wikiFailures = 0,
        wikiLimited = false;
      for (const host of [
        ...context.own.slice(0, 2),
        ...context.competitors.slice(0, 1),
      ]) {
        for (const query of [host, "*." + host]) {
          try {
            const response = await publicAxios.get(
              "https://en.wikipedia.org/w/api.php",
              {
                params: {
                  action: "query",
                  list: "exturlusage",
                  euquery: query,
                  eulimit: 50,
                  euprop: "ids|title|url",
                  format: "json",
                  maxlag: 5,
                },
                timeout: 8000,
                signal: AbortSignal.timeout(10000),
                maxRedirects: 0,
                maxContentLength: 1_000_000,
                proxy: false,
                headers: {
                  "User-Agent":
                    "GrowthXBacklinkBot/1.0 (+https://www.reigel.in/legal/privacy)",
                },
              },
            );
            if (
              response.data.error ||
              !Array.isArray(response.data.query?.exturlusage)
            )
              throw new Error("Wikimedia lookup unavailable.");
            wikiLimited ||= !!response.data.continue;
            for (const row of response.data.query.exturlusage) {
              if (
                typeof row.url === "string" &&
                kindOf(row.url, context.own, context.competitors) &&
                typeof row.title === "string"
              )
                add(
                  "https://en.wikipedia.org/wiki/" +
                    encodeURIComponent(row.title.replace(/ /g, "_")),
                  "WIKIMEDIA",
                );
            }
          } catch {
            wikiFailures++;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      details.push({
        provider: "Wikimedia external links",
        status: wikiFailures ? "PARTIAL" : wikiLimited ? "LIMITED" : "SEARCHED",
        candidates: candidates.size - beforeWiki,
        reason: wikiFailures
          ? "Some public lookups were unavailable."
          : wikiLimited
            ? "More matching Wikimedia pages exist beyond this run’s lookup budget."
            : undefined,
      });

      await stage("Checking existing project crawl evidence");
      const local = await this.backlinks.discover(run.projectId);
      details.push({
        provider: "Project crawl evidence",
        status: "SEARCHED",
        candidates: local.added,
        reason: local.message,
      });

      await stage("Following your public website footprint");
      const beforeFootprint = candidates.size;
      for (const host of context.own.slice(0, 2)) {
        const homepage = await this.fetcher.fetch("https://" + host + "/");
        if (homepage.outcome === "READ" && homepage.html) {
          for (const url of footprintLinks(
            homepage.html,
            homepage.finalUrl ?? "https://" + host + "/",
            context.own,
            10,
          ))
            add(url, "PUBLIC_FOOTPRINT");
        } else
          details.push({
            provider: "Public footprint " + host,
            status: homepage.outcome,
            candidates: 0,
            reason: homepage.reason,
          });
      }
      details.push({
        provider: "Public website footprint",
        status: "CANDIDATES",
        candidates: candidates.size - beforeFootprint,
        reason:
          "Outbound profile and partner pages are leads only; live checks determine whether they link back.",
      });

      // The first lookup is immediate; a bounded archive slice then expands the
      // independent index for every project, even when this domain is absent.
      await stage(
        "Growing the public archive index within the shared daily budget",
      );
      try {
        const archive = await this.index.grow();
        const beforeArchive = candidates.size;
        await readIndex();
        details.push({
          provider: "Common Crawl archive ingestion",
          status: archive.status,
          candidates: candidates.size - beforeArchive,
          reason: archive.reason ?? undefined,
        });
      } catch {
        details.push({
          provider: "Common Crawl archive ingestion",
          status: "UNAVAILABLE",
          candidates: 0,
          reason:
            "The public archive could not be reached. Other discovery sources were still searched.",
        });
      }

      await stage("Saving discovered pages and scheduling live verification");
      let added = local.added;
      for (const provider of [
        "COMMON_CRAWL",
        "WIKIMEDIA",
        "PUBLIC_FOOTPRINT",
      ]) {
        const urls = [...candidates]
          .filter(([, origin]) => origin === provider)
          .map(([url]) => url);
        if (urls.length)
          added += (
            await this.backlinks.import(
              run.projectId,
              urls.join("\n"),
              provider,
            )
          ).added;
      }
      const sources = await this.prisma.backlinkSource.findMany({
        where: {
          projectId: run.projectId,
          OR: [
            { sourceUrl: { in: [...candidates.keys()] } },
            { createdAt: { gte: run.startedAt }, discovery: "PROJECT_CRAWL" },
          ],
        },
        select: { id: true },
        take: 200,
      });
      const sourceIds = sources.map((source) => source.id);
      try {
        const queue = await this.verification.enqueue(run.projectId);
        details.push({
          provider: "Live verification",
          status: "QUEUED",
          candidates: sourceIds.length,
          reason: queue.message,
        });
      } catch {
        details.push({
          provider: "Live verification",
          status: "PARTIAL",
          candidates: sourceIds.length,
          reason:
            "Candidates were saved. Verification is busy or unavailable; the source scheduler will retry when capacity returns.",
        });
      }
      const partial = details.some((detail) =>
        [
          "UNAVAILABLE",
          "PARTIAL",
          "LIMITED",
          "FAILED",
          "BLOCKED",
          "UNKNOWN",
          "CAPACITY",
          "DAILY_LIMIT",
          "BUSY",
          "EXHAUSTED",
        ].includes(detail.status),
      );
      await this.prisma.backlinkDiscoveryRun.update({
        where: { id: runId },
        data: {
          status: partial ? "PARTIAL" : "COMPLETED",
          stage:
            "Discovery finished; live verification continues automatically",
          candidates: sourceIds.length,
          sourceIds,
          added,
          details,
          finishedAt: new Date(),
        },
      });
      // Keep a bounded project history; deleting runs never deletes sources.
      const old = await this.prisma.backlinkDiscoveryRun.findMany({
        where: {
          projectId: run.projectId,
          status: { in: ["COMPLETED", "PARTIAL", "FAILED"] },
        },
        orderBy: { startedAt: "desc" },
        skip: 20,
        take: 100,
        select: { id: true },
      });
      if (old.length)
        await this.prisma.backlinkDiscoveryRun.deleteMany({
          where: { id: { in: old.map((row) => row.id) } },
        });
    } catch {
      await this.prisma.backlinkDiscoveryRun.updateMany({
        where: { id: runId },
        data: {
          status: "FAILED",
          stage: "Discovery interrupted",
          error:
            "Discovery could not finish. Any saved candidates remain available for verification.",
          details,
          finishedAt: new Date(),
        },
      });
    }
  }

  @Interval(3600000)
  async schedule() {
    if (!this.worker) return;
    // Only projects that opted into discovery are refreshed. No private project
    // data is added to the shared archive index.
    const runs = await this.prisma.backlinkDiscoveryRun.groupBy({
      by: ["projectId"],
      _max: { startedAt: true },
      having: { startedAt: { _max: { lt: new Date(Date.now() - 86400000) } } },
      orderBy: { _max: { startedAt: "asc" } },
      take: 10,
    });
    for (const run of runs) {
      try {
        await this.start(run.projectId);
      } catch {
        /* Next hourly pass retries. */
      }
    }
  }

  @Interval(60000)
  async repairInterrupted() {
    if (!this.worker || !this.jobs) return;
    const runs = await this.prisma.backlinkDiscoveryRun.findMany({
      where: {
        status: { in: ["QUEUED", "RUNNING"] },
        startedAt: { lt: new Date(Date.now() - 60000) },
      },
      orderBy: { startedAt: "asc" },
      take: 10,
    });
    for (const run of runs) {
      const job = await this.jobs.getJob(run.id);
      if (
        job &&
        ["active", "waiting", "delayed", "waiting-children"].includes(
          await job.getState(),
        )
      )
        continue;
      await this.prisma.backlinkDiscoveryRun.updateMany({
        where: { id: run.id, status: { in: ["QUEUED", "RUNNING"] } },
        data: {
          status: "FAILED",
          stage: "Discovery interrupted",
          error:
            "The previous discovery job was interrupted. Saved candidates are retained; start discovery again.",
          finishedAt: new Date(),
        },
      });
    }
  }
  async onModuleDestroy() {
    await this.worker?.close();
    await this.jobs?.close();
  }
}
