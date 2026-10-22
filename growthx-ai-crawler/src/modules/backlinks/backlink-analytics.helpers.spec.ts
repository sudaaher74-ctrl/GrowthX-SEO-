import {
  csvCell,
  csvDocument,
  referringDomain,
  summarizeOccurrences,
} from "./backlink-analytics.helpers";
import { extractBacklinks } from "./backlink-evidence";

describe("backlink analytics evidence", () => {
  it("groups registrable domains without collapsing independent hosted sites", () => {
    expect(referringDomain("https://news.example.co.uk/article")).toBe(
      "example.co.uk",
    );
    expect(referringDomain("https://www.example.co.uk/")).toBe("example.co.uk");
    expect(referringDomain("https://alice.github.io/")).toBe("alice.github.io");
    expect(referringDomain("https://bob.github.io/")).toBe("bob.github.io");
    expect(referringDomain("http://127.0.0.1:4000/")).toBe("127.0.0.1");
  });

  it("preserves mixed occurrences and observed placement/type", () => {
    const occurrences = extractBacklinks(
      '<main><a href="https://client.example/page">Editorial link</a></main><footer><a rel="nofollow" href="https://client.example/page"><img alt="Image" /></a></footer>',
      "https://publisher.example/",
      ["client.example"],
      [],
    );
    expect(summarizeOccurrences(occurrences)).toEqual({
      anchorText: "Editorial link",
      rel: ["nofollow"],
      linkTypes: ["IMAGE", "TEXT"],
      placements: ["CONTENT", "FOOTER"],
      followState: "MIXED",
    });
  });

  it("includes page-level nofollow and sponsored/UGC qualification", () => {
    const meta = extractBacklinks(
      '<meta name="robots" content="index,nofollow"><main><a href="https://client.example/page">Link</a></main>',
      "https://publisher.example/",
      ["client.example"],
      [],
    );
    expect(summarizeOccurrences(meta).followState).toBe("QUALIFIED");
    const header = extractBacklinks(
      '<a href="https://client.example/page">Link</a>',
      "https://publisher.example/",
      ["client.example"],
      [],
      true,
    );
    expect(summarizeOccurrences(header).followState).toBe("QUALIFIED");
    for (const rel of ["sponsored", "ugc", "nofollow"])
      expect(
        summarizeOccurrences(
          extractBacklinks(
            `<a rel="${rel}" href="https://client.example/page">Link</a>`,
            "https://publisher.example/",
            ["client.example"],
            [],
          ),
        ).followState,
      ).toBe("QUALIFIED");
  });

  it("exports quoted CSV and neutralizes untrusted spreadsheet formulas", () => {
    expect(csvCell('"quoted", value\nnext')).toBe('"""quoted"", value\nnext"');
    for (const value of [
      '=HYPERLINK("bad")',
      " +SUM(1,2)",
      "@command",
      "-1+2",
      "\tformula",
    ])
      expect(csvCell(value)).toMatch(/^"'/);
    expect(csvCell("https://example.com/?a=1&b=2")).toBe(
      '"https://example.com/?a=1&b=2"',
    );
    expect(
      csvDocument([
        ["Column", "Value"],
        ["anchor", 2],
      ]),
    ).toBe('\uFEFF"Column","Value"\r\n"anchor","2"');
  });
});
