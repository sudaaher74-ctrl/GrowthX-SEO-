import type { CrawlPage } from "@/lib/api-client";

/** Stopwords and web generic boilerplate to exclude from keyword extraction */
export const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "did", "do",
  "does", "doing", "don't", "down", "during", "each", "few", "for", "from",
  "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it",
  "its", "itself", "let's", "me", "more", "most", "my", "myself", "no", "nor",
  "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
  "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", "such",
  "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there",
  "these", "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "we", "were", "what", "when", "where", "which", "while", "who",
  "whom", "why", "with", "would", "you", "your", "yours", "yourself", "yourselves",
  // Common website structure boilerplate
  "home", "page", "welcome", "index", "ltd", "inc", "llp", "pvt", "limited", "company",
  "official", "website", "site", "best", "top", "services", "service", "products",
  "product", "solutions", "solution", "overview", "contact", "about", "privacy",
  "policy", "terms", "conditions", "copyright", "rights", "reserved", "login",
  "register", "signup", "signin", "cart", "checkout", "blog", "posts", "read",
  "click", "view", "more", "learn", "menu", "search", "filter", "close", "open"
]);

export interface ExtractedKeywordProfile {
  keyword: string;
  tokensCount: number;
  totalOccurrences: number;
  placements: {
    inH1: number;
    inTitle: number;
    inH2: number;
    inMeta: number;
    inSlug: number;
  };
  pages: Array<{
    url: string;
    title: string;
    pageType: string;
    foundIn: string[];
  }>;
  primaryPageType: string;
  searchIntent: "COMMERCIAL" | "TRANSACTIONAL" | "INFORMATIONAL";
}

/** Tokenize text into clean 1-word and 2-word key phrases */
export function extractPhrasesFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const clean = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = clean.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  
  const phrases: string[] = [];
  // 1-grams
  for (const w of words) {
    if (w.length >= 3) phrases.push(w);
  }
  // 2-grams
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (!STOPWORDS.has(words[i]) && !STOPWORDS.has(words[i + 1])) {
      phrases.push(bigram);
    }
  }
  return phrases;
}

/** Determine likely search intent */
export function inferIntent(keyword: string): "COMMERCIAL" | "TRANSACTIONAL" | "INFORMATIONAL" {
  const kw = keyword.toLowerCase();
  if (/buy|price|cost|quote|order|purchase|hire|export|supplier|manufacturer|vendor/i.test(kw)) {
    return "TRANSACTIONAL";
  }
  if (/best|top|vs|comparison|review|service|solution|agency|company|enterprise|custom/i.test(kw)) {
    return "COMMERCIAL";
  }
  return "INFORMATIONAL";
}

/** Capitalize words for clean presentation */
export function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export type KeywordSourcePage = Pick<CrawlPage, "url" | "title" | "metaDescription" | "pageType" | "h1"> &
  Partial<Pick<CrawlPage, "h2">>;

/** Aggregate extracted page data into structured keyword profiles */
export function buildKeywordProfiles(pages: KeywordSourcePage[]): Map<string, ExtractedKeywordProfile> {
  const map = new Map<string, ExtractedKeywordProfile>();

  pages.forEach((page) => {
    const rawUrl = page.url || "";
    let slug = "";
    try {
      const p = new URL(rawUrl).pathname.split("/").filter(Boolean);
      slug = p.pop() || "";
    } catch {
      slug = rawUrl;
    }

    const titlePhrases: string[] = extractPhrasesFromText(page.title);
    const h1Phrases: string[] = Array.isArray(page.h1)
      ? page.h1.flatMap((h: string) => extractPhrasesFromText(h))
      : extractPhrasesFromText(page.h1);
    const h2Phrases: string[] = Array.isArray(page.h2)
      ? page.h2.flatMap((h: string) => extractPhrasesFromText(h))
      : extractPhrasesFromText(page.h2);
    const metaPhrases: string[] = extractPhrasesFromText(page.metaDescription);
    const slugPhrases: string[] = extractPhrasesFromText(slug.replace(/[-_]+/g, " "));

    const pageType = (page.pageType || "PAGE").toUpperCase();

    const uniquePhrasesOnPage = new Set([
      ...titlePhrases,
      ...h1Phrases,
      ...h2Phrases,
      ...metaPhrases,
      ...slugPhrases,
    ]);

    uniquePhrasesOnPage.forEach((phrase) => {
      // Focus on meaningful keywords (at least 4 chars or 2 words)
      if (phrase.length < 4 && !phrase.includes(" ")) return;

      const inH1Count = h1Phrases.filter((p: string) => p === phrase).length;
      const inTitleCount = titlePhrases.filter((p: string) => p === phrase).length;
      const inH2Count = h2Phrases.filter((p: string) => p === phrase).length;
      const inMetaCount = metaPhrases.filter((p: string) => p === phrase).length;
      const inSlugCount = slugPhrases.filter((p: string) => p === phrase).length;

      const foundLocations: string[] = [];
      if (inH1Count > 0) foundLocations.push("H1");
      if (inTitleCount > 0) foundLocations.push("Title");
      if (inH2Count > 0) foundLocations.push("H2");
      if (inMetaCount > 0) foundLocations.push("Meta");
      if (inSlugCount > 0) foundLocations.push("URL");

      if (!map.has(phrase)) {
        map.set(phrase, {
          keyword: phrase,
          tokensCount: phrase.split(" ").length,
          totalOccurrences: 0,
          placements: { inH1: 0, inTitle: 0, inH2: 0, inMeta: 0, inSlug: 0 },
          pages: [],
          primaryPageType: pageType,
          searchIntent: inferIntent(phrase),
        });
      }

      const existing = map.get(phrase)!;
      existing.totalOccurrences += 1;
      existing.placements.inH1 += inH1Count;
      existing.placements.inTitle += inTitleCount;
      existing.placements.inH2 += inH2Count;
      existing.placements.inMeta += inMetaCount;
      existing.placements.inSlug += inSlugCount;
      existing.pages.push({
        url: rawUrl,
        title: page.title || slug || "Page",
        pageType,
        foundIn: foundLocations,
      });
    });
  });

  return map;
}
