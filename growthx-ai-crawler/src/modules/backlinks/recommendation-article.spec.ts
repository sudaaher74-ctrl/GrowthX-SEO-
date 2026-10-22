import { analyzeArticle, brandLabel } from "./recommendation-article";

const OWN = ["milquufresh.in"];
const COMPETITORS = ["countrydelight.in", "akshayakalpa.org", "amul.com", "mm.com"];
const PAGE = "https://guide.example.org/best-milk-delivery";

const LISTICLE = `<html><head><title>Best Milk Delivery Services</title>
<meta property="article:published_time" content="2026-03-02T10:00:00Z"></head><body>
<header><a href="https://countrydelight.in/nav">Nav ad</a></header>
<article><h1>Best Milk Delivery Services in Mumbai</h1>
<p>${"Filler sentence about daily dairy needs. ".repeat(40)}</p>
<h2>How we chose these brands</h2>
<p>We evaluated each service on the following factors.</p>
<ul><li>Delivery coverage across Mumbai pincodes</li><li>Transparent pricing</li><li>Milk testing and sourcing</li></ul>
<h2>1. Country Delight</h2>
<p>Visit <a href="https://countrydelight.in/milk" rel="nofollow">Country Delight</a>. Prices start at ₹60 per litre.</p>
<h2>2. Akshayakalpa</h2>
<p>Akshayakalpa offers organic milk with recycled packaging.</p>
<h2>3. Amul</h2>
<p>Amul has the widest delivery coverage.</p>
</article><footer>Affiliate links may earn us a commission.</footer></body></html>`;

describe("analyzeArticle", () => {
  it("finds linked and unlinked featured competitors and keeps them separate", () => {
    const result = analyzeArticle(LISTICLE, PAGE, OWN, COMPETITORS);
    expect(result.listicle).toBe(true);
    expect(result.publishedAt).toBe("2026-03-02T10:00:00.000Z");
    const byHost = Object.fromEntries(result.featured.map((item) => [item.host, item]));
    expect(byHost["countrydelight.in"]).toMatchObject({ linked: true, role: "LISTED", position: 1, rel: ["nofollow"] });
    expect(byHost["akshayakalpa.org"]).toMatchObject({ linked: false, role: "LISTED", position: 2, url: null });
    expect(byHost["amul.com"]).toMatchObject({ linked: false, position: 3 });
    expect(result.featured.every((item) => item.evidenceClass === "OBSERVED")).toBe(true);
  });

  it("does not count header navigation links as article evidence", () => {
    const result = analyzeArticle(LISTICLE, PAGE, OWN, COMPETITORS);
    expect(result.featured.filter((item) => item.host === "countrydelight.in")).toHaveLength(1);
    expect(result.featured[0].passage).not.toContain("Nav ad");
  });

  it("reports the customer as absent, not as lacking anything", () => {
    const result = analyzeArticle(LISTICLE, PAGE, OWN, COMPETITORS);
    expect(result.ownMentioned).toBe(false);
    expect(result.ownLinked).toBe(false);
  });

  it("distinguishes a mention without a link from a backlink", () => {
    const html = LISTICLE.replace("Amul has the widest", "MilquuFresh and Amul have the widest");
    const withMention = analyzeArticle(html, PAGE, OWN, COMPETITORS);
    expect(withMention.ownMentioned).toBe(true);
    expect(withMention.ownLinked).toBe(false);
    const withLink = analyzeArticle(
      html.replace("MilquuFresh and", '<a href="https://www.milquufresh.in/">MilquuFresh</a> and'),
      PAGE, OWN, COMPETITORS,
    );
    expect(withLink.ownLinked).toBe(true);
  });

  it("marks explicitly stated criteria CONFIRMED and merely discussed topics OBSERVED", () => {
    const result = analyzeArticle(LISTICLE, PAGE, OWN, COMPETITORS);
    const confirmed = result.criteria.filter((item) => item.evidenceClass === "CONFIRMED");
    expect(confirmed.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Delivery coverage across Mumbai pincodes", "Transparent pricing"]),
    );
    const packaging = result.criteria.find((item) => /packaging/i.test(item.label));
    expect(packaging?.evidenceClass).toBe("OBSERVED");
    expect(result.criteria.some((item) => item.evidenceClass === "INFERRED")).toBe(false);
  });

  it("states that criteria are unknown when the publisher gives none", () => {
    const plain = `<article><h1>Dairy brands</h1><p>${"Milk is popular. ".repeat(60)} Amul sells milk.</p></article>`;
    const result = analyzeArticle(plain, PAGE, OWN, COMPETITORS);
    expect(result.criteria.filter((item) => item.evidenceClass === "CONFIRMED")).toHaveLength(0);
    expect(result.limits.join(" ")).toMatch(/does not state selection criteria/);
    expect(result.listicle).toBe(false);
    expect(result.featured[0]).toMatchObject({ host: "amul.com", role: "MENTIONED" });
  });

  it("detects observable sponsorship disclosure only", () => {
    expect(analyzeArticle(LISTICLE, PAGE, OWN, COMPETITORS).sponsorship.state).toBe("NOT_OBSERVED");
    const sponsored = LISTICLE.replace("</article>", "<p>This article is sponsored.</p></article>");
    expect(analyzeArticle(sponsored, PAGE, OWN, COMPETITORS).sponsorship.state).toBe("DISCLOSED");
  });

  it("flags near-empty pages instead of inventing findings", () => {
    const result = analyzeArticle("<html><body><div id=app></div></body></html>", PAGE, OWN, COMPETITORS);
    expect(result.featured).toEqual([]);
    expect(result.limits.join(" ")).toMatch(/Very little article text/);
  });

  it("skips short brand labels rather than false-matching them", () => {
    expect(brandLabel("mm.com")).toBeNull();
    const result = analyzeArticle(`<article><p>${"mm hmm ".repeat(100)}</p></article>`, PAGE, OWN, COMPETITORS);
    expect(result.featured).toEqual([]);
    expect(result.limits.join(" ")).toMatch(/too short to match/);
  });

  it("ignores script content and links to unrelated sites", () => {
    const html = `<article><h1>T</h1><script>var x="amul";</script><p>${"word ".repeat(200)} <a href="https://other.example/">Other</a></p></article>`;
    expect(analyzeArticle(html, PAGE, OWN, COMPETITORS).featured).toEqual([]);
  });
});
