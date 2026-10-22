import { BacklinkFetcher } from "./backlink-fetcher.service";
import { publicAxios } from "../security/ssrf";

jest.mock("../security/ssrf", () => ({
  ...jest.requireActual("../security/ssrf"),
  publicAxios: { get: jest.fn() },
}));

describe("backlink fetch policy", () => {
  const get = publicAxios.get as jest.Mock;
  const response = (
    status: number,
    data: string,
    headers: Record<string, string> = {},
  ) => ({ status, data, headers });
  const fetcher = () =>
    new BacklinkFetcher({
      getRedisClient: () => ({ set: jest.fn().mockResolvedValue("OK") }),
    } as any);
  beforeEach(() => get.mockReset());

  it("checks robots before fetching a source", async () => {
    get.mockResolvedValueOnce(
      response(200, "User-agent: *\nDisallow: /private"),
    );
    const result = await fetcher().fetch("https://publisher.example/private");
    expect(result.outcome).toBe("BLOCKED");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("checks robots again at redirected destinations, without following redirects automatically", async () => {
    get
      .mockResolvedValueOnce(response(404, ""))
      .mockResolvedValueOnce(
        response(302, "", { location: "https://other.example/hidden" }),
      )
      .mockResolvedValueOnce(response(200, "User-agent: *\nDisallow: /hidden"));
    expect((await fetcher().fetch("https://publisher.example/")).outcome).toBe(
      "BLOCKED",
    );
    expect(get).toHaveBeenNthCalledWith(
      3,
      "https://other.example/robots.txt",
      expect.objectContaining({ maxRedirects: 0, proxy: false }),
    );
  });

  it("does not turn unreadable robots, transient errors, challenges or JS shells into link loss", async () => {
    const cases = [
      response(503, "down"),
      response(200, '<html><script src="app.js"></script></html>'.repeat(3), {
        "content-type": "text/html",
      }),
      response(
        200,
        "<html><title>Just a moment...</title><a>Checking your browser</a></html>".repeat(
          2,
        ),
        { "content-type": "text/html" },
      ),
    ];
    for (const page of cases) {
      get
        .mockReset()
        .mockResolvedValueOnce(response(404, ""))
        .mockResolvedValueOnce(page);
      expect(
        (await fetcher().fetch("https://publisher.example/")).outcome,
      ).toBe("UNKNOWN");
    }
    get.mockReset().mockResolvedValueOnce(response(503, "down"));
    expect((await fetcher().fetch("https://publisher.example/")).outcome).toBe(
      "UNKNOWN",
    );
  });

  it("distinguishes inaccessible sources from successfully confirmed deleted pages", async () => {
    get
      .mockResolvedValueOnce(response(404, ""))
      .mockResolvedValueOnce(response(403, "denied"));
    expect((await fetcher().fetch("https://publisher.example/")).outcome).toBe(
      "BLOCKED",
    );
    get
      .mockReset()
      .mockResolvedValueOnce(response(404, ""))
      .mockResolvedValueOnce(response(410, "gone"));
    expect((await fetcher().fetch("https://publisher.example/")).outcome).toBe(
      "ABSENT",
    );
  });

  it("records only successful HTML as readable evidence", async () => {
    const html =
      '<html><body><a href="https://client.example/">Client</a><p>A public resource with useful editorial content.</p></body></html>';
    get
      .mockResolvedValueOnce(response(404, ""))
      .mockResolvedValueOnce(
        response(200, html, { "content-type": "text/html; charset=utf-8" }),
      );
    expect(await fetcher().fetch("https://publisher.example/")).toMatchObject({
      outcome: "READ",
      html,
      statusCode: 200,
    });
  });
});
