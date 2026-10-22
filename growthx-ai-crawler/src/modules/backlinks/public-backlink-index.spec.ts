import {
  ARCHIVE_PATH,
  footprintLinks,
  watEdges,
} from "./public-backlink-index";

const path =
  "crawl-data/CC-MAIN-2026-39/segments/1759000000.12/wat/CC-MAIN-20260901000000-20260902000000-00000.warc.wat.gz";
function record(
  links: unknown[],
  source = "https://publisher.example/article",
) {
  return JSON.stringify({
    Envelope: {
      "WARC-Header-Metadata": {
        "WARC-Type": "response",
        "WARC-Target-URI": source,
        "WARC-Date": "2026-09-01T00:00:00Z",
      },
      "Payload-Metadata": {
        "HTTP-Response-Metadata": { "HTML-Metadata": { Links: links } },
      },
    },
  });
}
describe("public reverse-index extraction", () => {
  const privateSetting = process.env.ALLOW_PRIVATE_CRAWL_TARGETS;
  beforeAll(() => {
    process.env.ALLOW_PRIVATE_CRAWL_TARGETS = "false";
  });
  afterAll(() => {
    process.env.ALLOW_PRIVATE_CRAWL_TARGETS = privateSetting;
  });
  it("extracts only external public anchor hrefs with archive provenance, never resource URLs", () => {
    const result = watEdges(
      record([
        { path: "A@/href", url: "https://client.co.uk/service#proof" },
        { path: "A@/href", url: "https://client.co.uk/service" },
        { path: "IMG@/src", url: "https://images.example/image.png" },
        { path: "SCRIPT@/src", url: "https://scripts.example/app.js" },
        { path: "A@/href", url: "/internal" },
        { path: "A@/href", url: "https://127.0.0.1/private" },
        { path: "A@/href", url: "javascript:alert(1)" },
      ]),
      path,
    );
    expect(result.page).toBe(true);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      sourceUrl: "https://publisher.example/article",
      targetUrl: "https://client.co.uk/service",
      targetHost: "client.co.uk",
      targetRoot: "client.co.uk",
      archivePath: path,
    });
    expect(result.edges[0].archivedAt?.toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });
  it("rejects private source pages, malformed records and arbitrary archive locations", () => {
    expect(
      watEdges(
        record(
          [{ path: "A@/href", url: "https://client.example" }],
          "http://localhost/private",
        ),
        path,
      ).edges,
    ).toEqual([]);
    expect(watEdges("{broken", path).page).toBe(false);
    expect(watEdges(record([]), "https://evil.example/file.gz").page).toBe(
      false,
    );
    expect(ARCHIVE_PATH.test("crawl-data/../../secret.gz")).toBe(false);
  });
  it("keeps private suffix domains distinct and stable across archive releases", () => {
    const line = record([
      { path: "A@/href", url: "https://customer.github.io/page" },
    ]);
    const edge = watEdges(line, path).edges[0];
    expect(edge.targetRoot).toBe("customer.github.io");
    expect(watEdges(line, path.replace("2026-39", "2026-34")).edges[0].id).toBe(
      edge.id,
    );
  });
  it("bounds footprint leads and rejects internal, credential and private-network seeds", () => {
    expect(
      footprintLinks(
        '<a href="/about">Internal</a><a href="https://private:secret@partner.example">Credential</a><a href="http://127.0.0.1">Private</a><a href="https://profile.example/client">Profile</a><a href="https://profile.example/client">Duplicate</a><a href="https://second.example">Other</a>',
        "https://client.example/",
        ["client.example"],
        1,
      ),
    ).toEqual(["https://profile.example/client"]);
  });
});
