import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { resolve as resolveUrl } from 'url';

export interface ExtractedHtmlData {
  title?: string;
  /** Every `<title>` element found in the document, in DOM order (used to detect duplicate tags). */
  titles?: string[];
  metaDescription?: string;
  /** Every `<meta name="description">` element found in the document, in DOM order. */
  metaDescriptions?: string[];
  canonicalUrl?: string;
  canonicalUrls?: string[];
  robotsMeta?: string;
  h1: string[];
  h2: string[];
  h3: string[];
  openGraph: Record<string, string>;
  twitterCards: Record<string, string>;
  jsonLd: any[];
  microdataTypes: string[];
  language?: string;
  charset?: string;
  viewport?: string;
  metaKeywords?: string;
  rawStructuredDataCount: number;
}

@Injectable()
export class HtmlExtractorService {
  private readonly logger = new Logger(HtmlExtractorService.name);

  /**
   * Parses raw HTML string and extracts all technical SEO metadata, headers, structured data, and OpenGraph tags.
   */
  extract($: cheerio.CheerioAPI, pageUrl: string): ExtractedHtmlData {

    // 1. Language & Charset
    const language = $('html').attr('lang')?.trim() || $('html').attr('xml:lang')?.trim();
    const charset = $('meta[charset]').attr('charset') || 
                    $('meta[http-equiv="Content-Type"]').attr('content')?.match(/charset=([^\s;]+)/i)?.[1];

    // 2. Title & Meta
    const titles = $('title')
      .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
      .get();
    const title = titles.find(Boolean) || $('meta[property="og:title"]').attr('content')?.trim();
    const metaDescriptions = $('meta[name="description" i]')
      .map((_, el) => ($(el).attr('content') ?? '').trim())
      .get();
    const metaDescription = metaDescriptions.find(Boolean);
    const metaKeywords = $('meta[name="keywords" i]').attr('content')?.trim();
    const viewport = $('meta[name="viewport" i]').attr('content')?.trim();
    // Combine all <meta name="robots"> (and <meta name="googlebot">) tags in document order.
    // Per Google Search Central rules, when multiple robots meta tags exist on a page
    // (common with CMS plugins or React Helmet hydration), directives are merged and
    // the most restrictive rule wins. Reading only `.first()` silently hides a second
    // `noindex` tag or a conflicting `index` + `noindex` pair.
    const robotsDirectives: string[] = [];
    const seenDirectives = new Set<string>();
    $('meta[name="robots" i], meta[name="googlebot" i]').each((_, el) => {
      const content = $(el).attr('content')?.trim();
      if (!content) return;
      for (const part of content.split(/[,;]/)) {
        const cleaned = part.trim();
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (!seenDirectives.has(key)) {
          seenDirectives.add(key);
          robotsDirectives.push(cleaned);
        }
      }
    });
    const robotsMeta = robotsDirectives.length > 0 ? robotsDirectives.join(', ') : undefined;

    // 3. Canonical
    const canonicalUrls = [...new Set($('link[rel="canonical" i]').map((_, el) => {
      const href = $(el).attr('href')?.trim();
      return href ? resolveUrl(pageUrl, href) : null;
    }).get())];
    const canonicalUrl = canonicalUrls[0];

    // 4. Headings
    const h1 = $('h1').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
    const h2 = $('h2').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
    const h3 = $('h3').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);

    // 5. OpenGraph & Twitter Cards
    const openGraph: Record<string, string> = {};
    $('meta[property^="og:" i]').each((_, el) => {
      const prop = $(el).attr('property')?.toLowerCase();
      const content = $(el).attr('content')?.trim();
      if (prop && content) {
        openGraph[prop] = content;
      }
    });

    const twitterCards: Record<string, string> = {};
    $('meta[name^="twitter:" i]').each((_, el) => {
      const name = $(el).attr('name')?.toLowerCase();
      const content = $(el).attr('content')?.trim();
      if (name && content) {
        twitterCards[name] = content;
      }
    });

    // 6. Structured Data (JSON-LD)
    const jsonLd: any[] = [];
    $('script[type="application/ld+json" i]').each((_, el) => {
      try {
        const raw = $(el).html();
        if (raw) {
          const parsed = JSON.parse(raw.trim());
          if (Array.isArray(parsed)) {
            jsonLd.push(...parsed);
          } else {
            jsonLd.push(parsed);
          }
        }
      } catch {
        // Malformed JSON-LD
      }
    });

    // 7. Microdata
    const microdataTypes = $('[itemscope][itemtype]').map((_, el) => {
      return $(el).attr('itemtype')?.trim();
    }).get().filter(Boolean) as string[];

    return {
      title,
      titles,
      metaDescription,
      metaDescriptions,
      canonicalUrl,
      canonicalUrls,
      robotsMeta,
      h1,
      h2,
      h3,
      openGraph,
      twitterCards,
      jsonLd,
      microdataTypes,
      language,
      charset,
      viewport,
      metaKeywords,
      rawStructuredDataCount: jsonLd.length + microdataTypes.length,
    };
  }
}
