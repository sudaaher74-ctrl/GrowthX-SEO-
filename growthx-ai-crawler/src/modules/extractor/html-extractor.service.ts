import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ExtractedHtmlData {
  title?: string;
  metaDescription?: string;
  canonicalUrl?: string;
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
  extract(html: string, pageUrl: string): ExtractedHtmlData {
    const $ = cheerio.load(html || '');

    // 1. Language & Charset
    const language = $('html').attr('lang')?.trim() || $('html').attr('xml:lang')?.trim();
    const charset = $('meta[charset]').attr('charset') || 
                    $('meta[http-equiv="Content-Type"]').attr('content')?.match(/charset=([^\s;]+)/i)?.[1];

    // 2. Title & Meta
    const title = $('title').first().text().trim() || $('meta[property="og:title"]').attr('content')?.trim();
    const metaDescription = $('meta[name="description" i]').attr('content')?.trim();
    const metaKeywords = $('meta[name="keywords" i]').attr('content')?.trim();
    const viewport = $('meta[name="viewport" i]').attr('content')?.trim();
    const robotsMeta = $('meta[name="robots" i]').attr('content')?.trim() || $('meta[name="googlebot" i]').attr('content')?.trim();

    // 3. Canonical
    let canonicalUrl = $('link[rel="canonical" i]').attr('href')?.trim();
    if (canonicalUrl && !canonicalUrl.startsWith('http')) {
      try {
        const { resolve } = require('url');
        canonicalUrl = resolve(pageUrl, canonicalUrl);
      } catch (e) {}
    }

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
      } catch (err) {
        // Malformed JSON-LD
      }
    });

    // 7. Microdata
    const microdataTypes = $('[itemscope][itemtype]').map((_, el) => {
      return $(el).attr('itemtype')?.trim();
    }).get().filter(Boolean) as string[];

    return {
      title,
      metaDescription,
      canonicalUrl,
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
