import * as cheerio from "cheerio";
import { getDomainWithoutSuffix } from "tldts";
import { belongsTo, hostOf, linkUrl } from "./backlink-evidence";

/**
 * Deterministic publisher-article analysis. No AI is involved: everything here
 * is parsed from the fetched HTML, so every finding carries the passage it came
 * from. An AI layer may later add INFERRED findings; this module never does.
 */
export const ANALYSIS_VERSION = "article-1";
const MAX_TEXT = 200_000;
const MAX_PASSAGE = 240;

/**
 * CONFIRMED: the publisher states it as a selection criterion.
 * OBSERVED: visible in the article, but not stated as a criterion.
 * INFERRED / UNKNOWN: reserved for later layers; never produced here.
 */
export type EvidenceClass = "CONFIRMED" | "OBSERVED" | "INFERRED" | "UNKNOWN";

export type FeaturedBusiness = {
  name: string;
  host: string | null;
  url: string | null;
  kind: "OWN" | "COMPETITOR";
  /** LISTED: appears as a list/heading entry. MENTIONED: appears in prose only. */
  role: "LISTED" | "MENTIONED";
  linked: boolean;
  rel: string[];
  position: number | null;
  passage: string;
  evidenceClass: EvidenceClass;
};

export type ArticleCriterion = {
  label: string;
  evidenceClass: EvidenceClass;
  passage: string;
};

export type ArticleAnalysis = {
  version: string;
  title: string;
  wordCount: number;
  publishedAt: string | null;
  /** True only when the page has at least three numbered headings or list items. */
  listicle: boolean;
  featured: FeaturedBusiness[];
  ownMentioned: boolean;
  ownLinked: boolean;
  criteria: ArticleCriterion[];
  sponsorship: { state: "DISCLOSED" | "NOT_OBSERVED"; passage: string | null };
  limits: string[];
};

const clip = (value: string, max = MAX_PASSAGE) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/** A brand label like "amul" from amul.com; null when too short to match safely. */
export function brandLabel(host: string): string | null {
  const label = getDomainWithoutSuffix(host)?.toLowerCase() ?? "";
  return label.length >= 4 ? label : null;
}

function readDate($: cheerio.CheerioAPI): string | null {
  const candidates = [
    $('meta[property="article:published_time"]').attr("content"),
    $('meta[name="date"]').attr("content"),
    $("time[datetime]").first().attr("datetime"),
  ];
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) return value.forEach(walk);
        if (value && typeof value === "object") {
          const record = value as Record<string, unknown>;
          if (typeof record.datePublished === "string")
            candidates.push(record.datePublished);
          walk(record["@graph"]);
        }
      };
      walk(JSON.parse($(node).text()));
    } catch {
      /* malformed structured data is ignored */
    }
  });
  for (const value of candidates) {
    const time = value ? Date.parse(value) : NaN;
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  return null;
}

const SELECTION_LANGUAGE =
  /\b(we (?:selected|chose|picked|ranked|rated|evaluated|assessed|judged|considered|looked (?:at|for))|our (?:criteria|methodology|selection)|selection criteria|ranked (?:by|based on)|based on (?:the following|these)|factors we|how we (?:chose|selected|ranked|evaluated|tested|picked))\b/i;
const CRITERIA_HEADING =
  /(criteria|how we (?:chose|selected|ranked|evaluated|picked|tested)|methodology|what to look for|what we looked for|factors|what makes a good)/i;
const SPONSOR_LANGUAGE =
  /\b(sponsored (?:post|content|by)|paid (?:partnership|promotion|placement)|advertorial|this (?:post|article) (?:is|was) sponsored|affiliate (?:links?|commission)|we may earn a commission|in partnership with|promoted content)\b/i;

/** Topic words used only to label OBSERVED mentions; never to claim they drove selection. */
const TOPICS: Array<[string, RegExp]> = [
  ["Pricing", /\b(price|pricing|cost|affordable|per (?:litre|liter|kg|month)|₹|\$)/i],
  ["Coverage / availability", /\b(delivery|deliver(?:s|ed)? to|coverage|serviceable|available in|areas?|pincodes?)\b/i],
  ["Quality", /\b(quality|fresh(?:ness)?|pure|purity|hygien|tested|adulterat|sourced?|sourcing)\w*/i],
  ["Customer reviews", /\b(reviews?|ratings?|testimonials?|customers? (?:say|love|praise)|feedback)\b/i],
  ["Product range", /\b(range|variety|varieties|products? (?:include|line)|offers?|selection of)\b/i],
  ["Packaging / sustainability", /\b(packag\w+|sustainab\w+|eco-?friendly|recycl\w+|organic)\b/i],
  ["Certifications", /\b(certif\w+|fssai|iso ?\d+|haccp|brc|kosher|halal)\b/i],
  ["Experience / credibility", /\b(since \d{4}|years of experience|established|award|trusted|pioneer)\b/i],
];

export function analyzeArticle(
  html: string,
  pageUrl: string,
  own: string[],
  competitors: string[],
): ArticleAnalysis {
  const $ = cheerio.load(html);
  const limits: string[] = [];
  const title = clip(
    $("h1").first().text() || $("title").first().text() || "Untitled",
    200,
  );
  const publishedAt = readDate($);

  $("script, style, noscript, template, svg, form, iframe").remove();
  const chrome = "nav, header, footer, aside";
  const root = $("article").length
    ? $("article").first()
    : $("main").length
      ? $("main").first()
      : $("body");
  root.find(chrome).remove();
  // cheerio's text() fuses adjacent blocks ("DelightCountry"), which breaks
  // word-boundary matching. Add a separator after every block-level element.
  root
    .find("p, li, h1, h2, h3, h4, h5, h6, div, section, br, td, th, tr, dd, dt, blockquote")
    .append(" ");

  const fullText = root.text().replace(/\s+/g, " ").trim();
  const text = fullText.slice(0, MAX_TEXT);
  if (fullText.length > MAX_TEXT)
    limits.push("Article text was truncated before analysis.");
  const wordCount = text ? text.split(" ").length : 0;
  if (wordCount < 150)
    limits.push(
      "Very little article text was readable; findings may be incomplete (the page may rely on JavaScript).",
    );

  // Numbered entries: headings like "3. Brand" or ordered-list items.
  const entries: Array<{ element: cheerio.Cheerio<any>; text: string; position: number }> = [];
  root.find("h2, h3, h4").each((_, node) => {
    const value = $(node).text().replace(/\s+/g, " ").trim();
    const match = /^#?(\d{1,2})[.)\s:-]+(.+)$/.exec(value);
    if (match) entries.push({ element: $(node), text: match[2], position: Number(match[1]) });
  });
  if (entries.length < 3) {
    entries.length = 0;
    root.find("ol > li").each((index, node) => {
      entries.push({
        element: $(node),
        text: $(node).text().replace(/\s+/g, " ").trim(),
        position: index + 1,
      });
    });
  }
  const listicle = entries.length >= 3;

  // Observed links to the project's own site or saved competitors.
  const found = new Map<string, FeaturedBusiness>();
  const remember = (business: FeaturedBusiness) => {
    const key = `${business.kind}:${business.host ?? business.name.toLowerCase()}`;
    const existing = found.get(key);
    // Prefer linked, then listed evidence over a weaker earlier record.
    const score = (item: FeaturedBusiness) =>
      (item.linked ? 2 : 0) + (item.role === "LISTED" ? 1 : 0);
    if (!existing || score(business) > score(existing)) found.set(key, business);
  };
  const entryFor = (element: cheerio.Cheerio<any>) => {
    const direct = entries.find(
      (entry) =>
        entry.element.is(element) ||
        entry.element.has(element).length > 0 ||
        element.closest("li").is(entry.element),
    );
    if (direct) return direct;
    // A link in the prose under "2. Brand" belongs to that numbered section.
    // Stop at the first heading found: if it is not a numbered entry, the
    // link sits in an ordinary section and must not inherit a position.
    let current = element;
    while (current.length && !current.is(root)) {
      const heading = current.prevAll("h2, h3, h4").first();
      if (heading.length)
        return entries.find((entry) => entry.element.is(heading));
      current = current.parent();
    }
    return undefined;
  };

  root.find("a[href]").each((_, node) => {
    try {
      const url = linkUrl($(node).attr("href")!, pageUrl);
      const host = hostOf(url);
      const kind = belongsTo(host, own)
        ? "OWN"
        : belongsTo(host, competitors)
          ? "COMPETITOR"
          : null;
      if (!kind || host === hostOf(pageUrl)) return;
      const anchor = $(node);
      const entry = entryFor(anchor) ?? entryFor(anchor.parent());
      const label = brandLabel(host);
      remember({
        name: clip(anchor.text() || label || host, 120),
        host,
        url,
        kind,
        role: entry ? "LISTED" : "MENTIONED",
        linked: true,
        rel: ($(node).attr("rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean),
        position: entry?.position ?? null,
        passage: clip(entry?.text ?? anchor.parent().text()),
        evidenceClass: "OBSERVED",
      });
    } catch {
      /* unsafe or malformed URLs are not evidence */
    }
  });

  // Unlinked brand mentions. Short brand labels are skipped: they would
  // false-match common words, and no claim is better than a wrong one.
  const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 4000);
  const skipped: string[] = [];
  for (const [kind, hosts] of [["OWN", own], ["COMPETITOR", competitors]] as const) {
    for (const host of hosts) {
      const label = brandLabel(host);
      if (!label) {
        skipped.push(host);
        continue;
      }
      const key = `${kind}:${host}`;
      if (found.has(key)) continue;
      // "countrydelight.in" is written "Country Delight" in prose, so allow one
      // optional space or hyphen between letters while keeping word boundaries.
      const letters = label.replace(/[^a-z0-9]/g, "").split("");
      const pattern = new RegExp(
        `(?:^|[^a-z0-9])${letters.join("[\\s-]?")}(?![a-z0-9])`,
        "i",
      );
      const sentence = sentences.find((candidate) => pattern.test(candidate));
      if (!sentence) continue;
      const entry = entries.find((item) => pattern.test(item.text));
      remember({
        name: label,
        host,
        url: null,
        kind,
        role: entry ? "LISTED" : "MENTIONED",
        linked: false,
        rel: [],
        position: entry?.position ?? null,
        passage: clip(entry?.text ?? sentence),
        evidenceClass: "OBSERVED",
      });
    }
  }
  if (skipped.length)
    limits.push(
      `Brand names for ${skipped.join(", ")} are too short to match in text; only links were checked for them.`,
    );

  // Criteria: explicit selection sections are CONFIRMED verbatim; topic
  // discussion elsewhere is only OBSERVED.
  const criteria: ArticleCriterion[] = [];
  root.find("h2, h3, h4, p, strong").each((_, node) => {
    const heading = $(node).text().replace(/\s+/g, " ").trim();
    if (!/^(h[2-4])$/i.test(node.tagName) && !/^(p|strong)$/i.test(node.tagName)) return;
    if (heading.length > 160 || !CRITERIA_HEADING.test(heading)) return;
    const list = $(node).nextAll("ul, ol").first().length
      ? $(node).nextAll("ul, ol").first()
      : $(node).parent().nextAll("ul, ol").first();
    list.find("li").slice(0, 12).each((_, item) => {
      const value = clip($(item).text());
      if (value) criteria.push({ label: value, evidenceClass: "CONFIRMED", passage: `${heading}: ${value}` });
    });
  });
  const confirmedSentences = sentences.filter((sentence) => SELECTION_LANGUAGE.test(sentence));
  for (const [label, pattern] of TOPICS) {
    const stated = confirmedSentences.find((sentence) => pattern.test(sentence));
    const seen = stated ?? sentences.find((sentence) => pattern.test(sentence));
    if (!seen) continue;
    if (criteria.some((item) => item.label.toLowerCase().includes(label.split(" ")[0].toLowerCase())) && !stated) continue;
    criteria.push({
      label,
      evidenceClass: stated ? "CONFIRMED" : "OBSERVED",
      passage: clip(seen),
    });
  }
  if (!criteria.some((item) => item.evidenceClass === "CONFIRMED"))
    limits.push(
      "The publisher does not state selection criteria in readable text. Topics listed as observed were discussed, not confirmed as criteria.",
    );

  const sponsorSentence = sentences.find((sentence) => SPONSOR_LANGUAGE.test(sentence));
  const sponsoredRel = root.find('a[rel~="sponsored"]').length > 0;
  const featured = [...found.values()].sort(
    (a, b) => (a.position ?? 999) - (b.position ?? 999),
  );
  return {
    version: ANALYSIS_VERSION,
    title,
    wordCount,
    publishedAt,
    listicle,
    featured,
    ownMentioned: featured.some((item) => item.kind === "OWN"),
    ownLinked: featured.some((item) => item.kind === "OWN" && item.linked),
    criteria: criteria.slice(0, 20),
    sponsorship: sponsorSentence || sponsoredRel
      ? { state: "DISCLOSED", passage: sponsorSentence ? clip(sponsorSentence) : "Links on this page carry rel=sponsored." }
      : { state: "NOT_OBSERVED", passage: null },
    limits,
  };
}
