import * as cheerio from 'cheerio';
import { coverage, questionTerms, vocabulary } from './question-terms';

/** The fields of a crawled page that matching and signals read. */
export interface CandidatePage {
  id: string;
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  pageType: string;
  wordCount: number;
}

/**
 * What a page offers an AI assistant looking to answer one question. Each is
 * read from the crawled page itself; none is estimated.
 */
export interface PageSignals {
  /** A short, self-contained paragraph near the top that uses the question's terms. */
  directAnswer: boolean;
  directAnswerText: string | null;
  /** FAQPage markup, or at least two question-style headings. */
  faq: boolean;
  faqSource: 'SCHEMA' | 'HEADINGS' | null;
  /** Structured-data types found on the page, e.g. ["ORGANIZATION", "FAQ"]. */
  schemaTypes: string[];
  /** Share of the question's terms the page uses anywhere, 0..1. */
  termCoverage: number;
  /** The question's terms the page never uses. */
  missingTerms: string[];
  wordCount: number;
  /** False when no HTML was stored for the page, so text signals could not be read. */
  htmlAvailable: boolean;
}

const MATCH_THRESHOLD = 0.5;

/**
 * How well a page's title, headings, description and URL cover a question,
 * 0..1. Titles and H1s are weighted over body headings: a page *about* the
 * topic outranks one that merely mentions it in a subsection.
 */
export function matchScore(terms: string[], page: CandidatePage): number {
  if (terms.length === 0) return 0;
  const strong = vocabulary([page.title, ...page.h1, urlWords(page.url)].join(' '));
  const weak = vocabulary([page.metaDescription, ...page.h2, ...page.h3].join(' '));
  let score = 0;
  for (const term of terms) {
    if (strong.has(term)) score += 1;
    else if (weak.has(term)) score += 0.5;
  }
  return score / terms.length;
}

/**
 * The page that should answer `question`, or null when none covers at least
 * half its terms — which is itself the finding: there is no page for this.
 */
export function bestPage<T extends CandidatePage>(
  question: string,
  pages: T[],
): { page: T; score: number } | null {
  const terms = questionTerms(question);
  let best: { page: T; score: number } | null = null;
  for (const page of pages) {
    const score = matchScore(terms, page);
    if (!best || score > best.score || (score === best.score && page.wordCount > best.page.wordCount)) {
      best = { page, score };
    }
  }
  return best && best.score >= MATCH_THRESHOLD ? best : null;
}

export function pageSignals(
  question: string,
  page: CandidatePage,
  html: string | null,
  schemaTypes: string[],
): PageSignals {
  const terms = questionTerms(question);
  const types = [...new Set(schemaTypes)].sort();
  const questionHeadings = [...page.h2, ...page.h3].filter((h) => h.trim().endsWith('?')).length;

  let text = [page.title, page.metaDescription, ...page.h1, ...page.h2, ...page.h3].join(' ');
  let directAnswerText: string | null = null;

  if (html) {
    const $ = cheerio.load(html);
    $('script, style, noscript, nav, header, footer').remove();
    text = `${text} ${$('body').text()}`;

    // The first few paragraphs are where an answer engine looks for a quotable
    // passage. One that is short enough to lift whole and uses most of the
    // question's terms counts as a direct answer.
    const paragraphs = $('p')
      .toArray()
      .slice(0, 6)
      .map((p) => $(p).text().replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    for (const paragraph of paragraphs) {
      const count = paragraph.split(' ').length;
      if (count >= 15 && count <= 90 && coverage(terms, vocabulary(paragraph)) >= 0.5) {
        directAnswerText = paragraph.length > 280 ? `${paragraph.slice(0, 277)}...` : paragraph;
        break;
      }
    }
  }

  const vocab = vocabulary(text);
  const faqFromSchema = types.includes('FAQ');
  return {
    directAnswer: directAnswerText !== null,
    directAnswerText,
    faq: faqFromSchema || questionHeadings >= 2,
    faqSource: faqFromSchema ? 'SCHEMA' : questionHeadings >= 2 ? 'HEADINGS' : null,
    schemaTypes: types,
    termCoverage: Math.round(coverage(terms, vocab) * 100) / 100,
    missingTerms: terms.filter((t) => !vocab.has(t)),
    wordCount: page.wordCount,
    htmlAvailable: Boolean(html),
  };
}

function urlWords(url: string): string {
  try {
    return new URL(url).pathname.replace(/[/_-]+/g, ' ');
  } catch {
    return '';
  }
}
