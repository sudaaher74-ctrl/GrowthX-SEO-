import { Readable } from "stream";
import { gzipSync } from "zlib";
import { PublicBacklinkIndex } from "./public-backlink-index.service";
import { publicAxios } from "../security/ssrf";

jest.mock("../security/ssrf", () => ({
  ...jest.requireActual("../security/ssrf"),
  publicAxios: { get: jest.fn() },
}));
const path =
  "crawl-data/CC-MAIN-2026-39/segments/1759000000.12/wat/CC-MAIN-20260901000000-20260902000000-00000.warc.wat.gz";
const wat = (target: string) =>
  JSON.stringify({
    Envelope: {
      "WARC-Header-Metadata": {
        "WARC-Type": "response",
        "WARC-Target-URI": "https://publisher.example/café",
        "WARC-Date": "2026-09-01T00:00:00Z",
      },
      "Payload-Metadata": {
        "HTTP-Response-Metadata": {
          "HTML-Metadata": {
            Links: [
              { path: "A@/href", url: target },
              { path: "IMG@/src", url: "https://image.example/image.png" },
            ],
          },
        },
      },
    },
  }) + "\n";

describe("bounded Common Crawl index ingestion", () => {
  const get = publicAxios.get as jest.Mock;
  let db: any, redis: any, service: PublicBacklinkIndex;
  beforeEach(() => {
    get.mockReset();
    db = {
      publicBacklinkEdge: {
        count: jest.fn().mockResolvedValue(0),
        createMany: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ count: data.length }),
          ),
      },
      publicBacklinkSlice: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify([path])),
      set: jest.fn().mockResolvedValue("OK"),
      eval: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };
    service = new PublicBacklinkIndex(db, {
      getRedisClient: () => redis,
    } as any);
  });
  it("streams real gzip WAT into reverse lookup records with deduplication and provenance", async () => {
    const compressed = gzipSync(
      "WARC/1.0\n" + wat("https://customer.example/service"),
    );
    get.mockResolvedValue({
      data: Readable.from([
        compressed.subarray(0, 23),
        compressed.subarray(23),
      ]),
    });
    expect(await service.grow()).toMatchObject({
      status: "COMPLETE",
      pages: 1,
      edges: 1,
      bytes: compressed.length,
    });
    expect(db.publicBacklinkEdge.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          sourceUrl: "https://publisher.example/caf%C3%A9",
          targetUrl: "https://customer.example/service",
          targetRoot: "customer.example",
          archivePath: path,
        }),
      ],
    });
    expect(get).toHaveBeenCalledWith(
      "https://data.commoncrawl.org/" + path,
      expect.objectContaining({
        maxRedirects: 0,
        responseType: "stream",
        proxy: false,
      }),
    );
    expect(redis.eval).toHaveBeenCalled();
  });
  it("respects remaining index capacity and marks a sampled archive as partial", async () => {
    db.publicBacklinkEdge.count.mockResolvedValue(499999);
    get.mockResolvedValue({
      data: Readable.from([
        gzipSync(wat("https://one.example/") + wat("https://two.example/")),
      ]),
    });
    expect(await service.grow()).toMatchObject({ status: "PARTIAL", edges: 1 });
    expect(db.publicBacklinkEdge.createMany.mock.calls[0][0].data).toHaveLength(
      1,
    );
  });
  it("does no network work when the shared daily budget or capacity is exhausted", async () => {
    db.publicBacklinkSlice.count.mockResolvedValue(4);
    expect(await service.grow()).toMatchObject({ status: "DAILY_LIMIT" });
    db.publicBacklinkEdge.count.mockResolvedValue(500000);
    expect(await service.grow()).toMatchObject({ status: "CAPACITY" });
    expect(get).not.toHaveBeenCalled();
  });
  it("records a failed fetch without inventing link records", async () => {
    get.mockRejectedValue(new Error("network unavailable"));
    expect(await service.grow()).toMatchObject({
      status: "FAILED",
      pages: 0,
      edges: 0,
    });
    expect(db.publicBacklinkSlice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          finishedAt: expect.any(Date),
        }),
      }),
    );
    expect(db.publicBacklinkEdge.createMany).not.toHaveBeenCalled();
  });
  it("uses only validated official release paths from a bounded gzip manifest", async () => {
    redis.get.mockResolvedValue(null);
    get
      .mockResolvedValueOnce({
        data: [{ id: "../evil" }, { id: "CC-MAIN-2026-39" }],
      })
      .mockResolvedValueOnce({
        data: gzipSync(
          path +
            "\nhttps://evil.example/archive.gz\ncrawl-data/../../secret.gz\n",
        ),
      })
      .mockResolvedValueOnce({
        data: Readable.from([gzipSync(wat("https://customer.example/"))]),
      });
    expect(await service.grow()).toMatchObject({
      status: "COMPLETE",
      edges: 1,
    });
    expect(get.mock.calls.map((call) => call[0])).toEqual([
      "https://index.commoncrawl.org/collinfo.json",
      "https://data.commoncrawl.org/crawl-data/CC-MAIN-2026-39/wat.paths.gz",
      "https://data.commoncrawl.org/" + path,
    ]);
  });
});
