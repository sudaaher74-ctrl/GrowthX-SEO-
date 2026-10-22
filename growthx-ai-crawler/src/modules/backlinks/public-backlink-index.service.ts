import { Injectable } from "@nestjs/common";
import { createGunzip, gunzipSync } from "zlib";
import { Readable } from "stream";
import { StringDecoder } from "string_decoder";
import { randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { QueueService } from "../queue/queue.service";
import { publicAxios } from "../security/ssrf";
import { ARCHIVE_PATH, PublicEdge, watEdges } from "./public-backlink-index";

const UA = "GrowthXBacklinkBot/1.0 (+https://www.reigel.in/legal/privacy)";
function budget(name: string, fallback: number, max: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0
    ? Math.min(value, max)
    : fallback;
}
type IndexCoverage = {
  edges: number;
  pages: number;
  slices: number;
  lastIndexedAt: Date | string | null;
  capacity: number;
  note: string;
};

@Injectable()
export class PublicBacklinkIndex {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async coverage(): Promise<IndexCoverage> {
    const redis = this.queue.getRedisClient();
    const cached = await redis?.get("backlinks:cc:coverage");
    if (cached) return JSON.parse(cached);
    const [edges, slices, last] = await Promise.all([
      this.prisma.publicBacklinkEdge.count(),
      this.prisma.publicBacklinkSlice.aggregate({
        _sum: { pages: true, bytes: true },
        _count: true,
      }),
      this.prisma.publicBacklinkSlice.findFirst({
        where: { finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true, status: true },
      }),
    ]);
    const result = {
      edges,
      pages: slices._sum.pages ?? 0,
      slices: slices._count,
      lastIndexedAt: last?.finishedAt ?? null,
      capacity: budget("BACKLINK_INDEX_MAX_EDGES", 500000, 50000000),
      note: "Growing sample of public Common Crawl anchor records. Archive candidates require live verification. This is not complete web coverage.",
    };
    await redis?.set("backlinks:cc:coverage", JSON.stringify(result), "EX", 30);
    return result;
  }

  private async manifest(): Promise<string[]> {
    const redis = this.queue.getRedisClient();
    const cached = await redis?.get("backlinks:cc:manifest");
    if (cached) return JSON.parse(cached);
    const config = {
      timeout: 15000,
      signal: AbortSignal.timeout(20000),
      maxRedirects: 0,
      maxContentLength: 2_000_000,
      proxy: false as const,
      headers: { "User-Agent": UA },
    };
    const catalog = await publicAxios.get<Array<{ id: string }>>(
      "https://index.commoncrawl.org/collinfo.json",
      config,
    );
    const id = catalog.data.find((row) =>
      /^CC-MAIN-\d{4}-\d{2}$/.test(row.id),
    )?.id;
    if (!id) throw new Error("Common Crawl catalog has no usable release.");
    const response = await publicAxios.get(
      `https://data.commoncrawl.org/crawl-data/${id}/wat.paths.gz`,
      { ...config, responseType: "arraybuffer" },
    );
    const paths = gunzipSync(Buffer.from(response.data), {
      maxOutputLength: 16_000_000,
    })
      .toString("utf8")
      .split("\n")
      .filter((path) => ARCHIVE_PATH.test(path));
    if (!paths.length) throw new Error("Common Crawl manifest is empty.");
    await redis?.set(
      "backlinks:cc:manifest",
      JSON.stringify(paths),
      "EX",
      86400,
    );
    return paths;
  }

  /** One worker-wide bounded slice, at most four/day, never a per-user full-web scan. */
  async grow() {
    const redis = this.queue.getRedisClient();
    if (!redis)
      return {
        status: "UNAVAILABLE",
        reason: "Archive indexing requires Redis.",
      };
    const token = randomUUID();
    if (
      !(await redis.set("backlinks:cc:index-lock", token, "PX", 300000, "NX"))
    )
      return {
        status: "BUSY",
        reason: "Another archive slice is being indexed.",
      };
    try {
      const [count, today] = await Promise.all([
        this.prisma.publicBacklinkEdge.count(),
        this.prisma.publicBacklinkSlice.count({
          where: { startedAt: { gte: new Date(Date.now() - 86400000) } },
        }),
      ]);
      const capacity = budget("BACKLINK_INDEX_MAX_EDGES", 500000, 50000000);
      if (count >= capacity)
        return {
          status: "CAPACITY",
          reason:
            "Public index capacity reached; existing data remains searchable.",
        };
      if (today >= budget("BACKLINK_ARCHIVE_SLICES_PER_DAY", 4, 1000))
        return {
          status: "DAILY_LIMIT",
          reason:
            "Daily archive budget reached. Existing index and live discovery remain available.",
        };
      const paths = await this.manifest();
      const used = await this.prisma.publicBacklinkSlice.findMany({
        select: { path: true },
        take: 10000,
      });
      const seen = new Set(used.map((row) => row.path));
      const path = paths.find((path) => !seen.has(path));
      if (!path)
        return {
          status: "EXHAUSTED",
          reason: "All current manifest slices have been attempted.",
        };
      await this.prisma.publicBacklinkSlice.create({ data: { path } });
      return await this.ingest(path, capacity - count);
    } finally {
      await redis.eval(
        "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
        1,
        "backlinks:cc:index-lock",
        token,
      );
    }
  }

  private async ingest(path: string, remaining: number) {
    let bytes = 0,
      decoded = 0,
      pages = 0,
      edges = 0,
      buffer = "",
      skipLong = false;
    let status = "COMPLETE",
      reason: string | null = null;
    let pending: PublicEdge[] = [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    timer.unref?.();
    let stream: Readable | undefined;
    const gunzip = createGunzip();
    const decoder = new StringDecoder("utf8");
    const flush = async () => {
      if (!pending.length) return;
      const rows = pending;
      pending = [];
      const saved = await this.prisma.publicBacklinkEdge.createMany({
        data: rows,
        skipDuplicates: true,
      });
      edges += saved.count;
    };
    try {
      const response = await publicAxios.get<Readable>(
        "https://data.commoncrawl.org/" + path,
        {
          responseType: "stream",
          timeout: 15000,
          signal: controller.signal,
          maxRedirects: 0,
          proxy: false,
          headers: { "User-Agent": UA, "Accept-Encoding": "identity" },
        },
      );
      stream = response.data;
      stream.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 64_000_000) {
          reason = "Compressed byte budget reached.";
          controller.abort();
        }
      });
      stream.on("error", (error) => gunzip.destroy(error));
      stream.pipe(gunzip);
      for await (const chunk of gunzip) {
        decoded += chunk.length;
        if (
          decoded > 128_000_000 ||
          pages >= 20000 ||
          edges + pending.length >= Math.min(100000, remaining)
        ) {
          reason =
            "Slice processing budget reached; remaining records were not indexed.";
          status = "PARTIAL";
          break;
        }
        buffer += decoder.write(chunk);
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, "");
          buffer = buffer.slice(newline + 1);
          if (skipLong) {
            skipLong = false;
            continue;
          }
          if (line.length > 1_000_000) continue;
          const record = watEdges(line, path);
          if (record.page) pages++;
          pending.push(
            ...record.edges.slice(
              0,
              Math.max(0, Math.min(100000, remaining) - edges - pending.length),
            ),
          );
          if (pending.length >= 500) await flush();
          if (
            pages >= 20000 ||
            edges + pending.length >= Math.min(100000, remaining)
          ) {
            status = "PARTIAL";
            reason =
              "Slice processing budget reached; remaining records were not indexed.";
            break;
          }
        }
        if (buffer.length > 1_000_000) {
          buffer = "";
          skipLong = true;
        }
      }
      await flush();
    } catch {
      status = pages ? "PARTIAL" : "FAILED";
      reason =
        reason ??
        "Archive transfer could not finish within the bounded request budget.";
      await flush();
    } finally {
      clearTimeout(timer);
      stream?.destroy();
      gunzip.destroy();
    }
    if (controller.signal.aborted && status === "COMPLETE") status = "PARTIAL";
    await this.prisma.publicBacklinkSlice.update({
      where: { path },
      data: { status, reason, pages, edges, bytes, finishedAt: new Date() },
    });
    await this.queue.getRedisClient()?.del("backlinks:cc:coverage");
    return { status, reason, pages, edges, bytes };
  }
}
