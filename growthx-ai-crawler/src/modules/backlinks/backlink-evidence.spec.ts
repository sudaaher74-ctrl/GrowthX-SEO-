import {
  absenceState,
  DAY,
  extractBacklinks,
  hostOf,
  kindOf,
  linkUrl,
  parseImport,
} from "./backlink-evidence";

describe("backlink evidence", () => {
  it("imports GSC source-only CSV and quoted fields, without claiming targets exist", () => {
    expect(
      parseImport(
        '\uFEFF"Linking page","First detected"\r\n"https://publisher.example/article?a=1,b=2","2026-10-01"',
      ),
    ).toEqual([
      {
        sourceUrl: "https://publisher.example/article?a=1,b=2",
        targetUrl: undefined,
      },
    ]);
    expect(
      parseImport(
        "source_url,target_url\nhttps://publisher.example/,https://client.example/service",
      ),
    ).toEqual([
      {
        sourceUrl: "https://publisher.example/",
        targetUrl: "https://client.example/service",
      },
    ]);
  });

  it("accepts plain URLs, rejects oversize and malformed imports", () => {
    expect(
      parseImport("https://one.example/\nhttps://two.example/"),
    ).toHaveLength(2);
    expect(parseImport("https://one.example/article?tags=seo,growth")).toEqual([
      { sourceUrl: "https://one.example/article?tags=seo,growth" },
    ]);
    expect(() => parseImport('"unclosed')).toThrow("unclosed");
    expect(() =>
      parseImport(Array(201).fill("https://one.example/").join("\n")),
    ).toThrow("200");
    expect(() => parseImport("a".repeat(500001))).toThrow("500 KB");
  });

  it("preserves distinct destinations and strips fragments without broad URL rewriting", () => {
    expect(linkUrl("https://CLIENT.example/path/?item=1#top")).toBe(
      "https://client.example/path/?item=1",
    );
    expect(linkUrl("https://client.example/path")).not.toBe(
      linkUrl("https://client.example/path/"),
    );
    expect(() => linkUrl("javascript:alert(1)")).toThrow();
    expect(() => linkUrl("https://user:password@public.example/")).toThrow();
  });

  it("blocks private targets using the production SSRF rules", () => {
    const previous = process.env.ALLOW_PRIVATE_CRAWL_TARGETS;
    process.env.ALLOW_PRIVATE_CRAWL_TARGETS = "false";
    try {
      for (const url of [
        "http://127.0.0.1/",
        "http://169.254.169.254/",
        "http://[::1]/",
        "http://server.internal/",
      ])
        expect(() => linkUrl(url)).toThrow();
    } finally {
      process.env.ALLOW_PRIVATE_CRAWL_TARGETS = previous;
    }
  });

  it("recognizes owned subdomains without matching lookalike hosts", () => {
    expect(hostOf("https://www.client.example/")).toBe("client.example");
    expect(kindOf("https://shop.client.example/", ["client.example"], [])).toBe(
      "OWN",
    );
    expect(
      kindOf(
        "https://client.example.attacker.example/",
        ["client.example"],
        [],
      ),
    ).toBeNull();
  });

  it("extracts actual anchors, base URLs, image alt text and per-occurrence rel evidence", () => {
    const found = extractBacklinks(
      `<html><head><base href="https://client.example/"></head><body>
      <a href="/service#top" rel="nofollow sponsored"><img alt="Service"></a>
      <a href="https://client.example/service">Read service</a>
      <a href="https://rival.example/product" rel="UGC">Rival</a>
      <script>const fake = 'https://client.example/fake'</script>
      <a href="https://client.example.evil.example/">Fake</a></body></html>`,
      "https://publisher.example/article",
      ["client.example"],
      ["rival.example"],
    );
    expect(found).toHaveLength(3);
    expect(found[0]).toMatchObject({
      targetUrl: "https://client.example/service",
      anchorText: "Service",
      rel: ["nofollow", "sponsored"],
    });
    expect(found[1].rel).toEqual([]);
    expect(found[2].targetKind).toBe("COMPETITOR");
    expect(
      extractBacklinks(
        '<a href="https://client.example/service">Internal</a>',
        "https://www.client.example/",
        ["client.example"],
        [],
      ),
    ).toEqual([]);
  });

  it("never treats truncated extraction as evidence of missing links", () => {
    const html = Array.from(
      { length: 501 },
      (_, i) => `<a href="https://client.example/${i}">Link ${i}</a>`,
    ).join("");
    expect(() =>
      extractBacklinks(
        html,
        "https://publisher.example/",
        ["client.example"],
        [],
      ),
    ).toThrow("cannot establish absence");
  });

  it("requires a previously verified link and two successful absences at least a day apart", () => {
    const now = new Date();
    const initial = {
      lastVerifiedAt: new Date(now.getTime() - 2 * DAY),
      firstMissingAt: null,
      missingChecks: 0,
    };
    const first = absenceState(initial, now);
    expect(first.status).toBe("MISSING");
    expect(
      absenceState({ ...initial, ...first }, new Date(now.getTime() + 600000))
        .status,
    ).toBe("MISSING");
    expect(
      absenceState({ ...initial, ...first }, new Date(now.getTime() + DAY))
        .status,
    ).toBe("LOST");
    expect(
      absenceState(
        { ...initial, ...first, lastVerifiedAt: null },
        new Date(now.getTime() + DAY),
      ).status,
    ).toBe("MISSING");
  });
});
