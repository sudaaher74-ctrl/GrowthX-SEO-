import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';

export interface ContentMetrics {
  wordCount: number;
  readingTimeMin: number;
  contentHash: string;
  simHash: string;
  headingStructureErrors: string[];
  imageCount: number;
  internalLinkDensity: number; // Links per 100 words
  externalLinkDensity: number;
  extractionMethod: 'semantic_region' | 'body_cleaned';
  mainContentSelector: string;
  boilerplatePercentage: number;
  rawWordCount?: number;
}

@Injectable()
export class ContentAnalyzerService {
  private readonly logger = new Logger(ContentAnalyzerService.name);

  /**
   * Evaluates textual content quality, word count, reading time, heading hierarchy, and computes hash fingerprints.
   * Employs semantic content extraction to strip navigation, footers, cookie banners, and hidden elements.
   */
  analyzeContent(
    html: string,
    h1: string[],
    h2: string[],
    h3: string[],
    imageCount: number,
    internalLinkCount: number,
    externalLinkCount: number
  ): ContentMetrics {
    const $ = cheerio.load(html || '');

    // 1. Measure raw body text for boilerplate calculation
    const rawBodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const rawWords = rawBodyText.split(' ').filter((w) => w.length > 0);
    const rawWordCount = rawWords.length;

    // 2. Strip scripts, styles, media, and structural boilerplate
    $('script, style, noscript, svg, canvas, iframe, audio, video').remove();
    $('nav, header, .nav, .navbar, .menu, .header, [role="navigation"]').remove();
    $('footer, .footer, [role="contentinfo"]').remove();
    $('.cookie, #cookie, [class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]').remove();
    $('[hidden], [aria-hidden="true"], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]').remove();
    $('.modal, .dialog, .popup, [role="dialog"], [role="alertdialog"]').remove();

    // 3. Attempt extraction from dedicated content containers
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '#content',
      '#main-content',
      '.content',
      '.main-content',
      '.post-content',
      '.page-content',
    ];

    let cleanText = '';
    let extractionMethod: 'semantic_region' | 'body_cleaned' = 'body_cleaned';
    let mainContentSelector = 'body';

    for (const selector of contentSelectors) {
      const el = $(selector);
      if (el.length > 0) {
        const text = el.text().replace(/\s+/g, ' ').trim();
        const words = text.split(' ').filter((w) => w.length > 0);
        // Only use the region if it contains substantial text (> 30 words)
        if (words.length >= 30) {
          cleanText = text;
          extractionMethod = 'semantic_region';
          mainContentSelector = selector;
          break;
        }
      }
    }

    // Fallback to cleaned body
    if (!cleanText) {
      cleanText = $('body').text().replace(/\s+/g, ' ').trim();
      extractionMethod = 'body_cleaned';
      mainContentSelector = 'body';
    }

    const words = cleanText.split(' ').filter((w) => w.length > 0);
    const wordCount = words.length;
    const readingTimeMin = parseFloat((wordCount / 200).toFixed(2)); // Standard 200 WPM

    // Boilerplate percentage
    const boilerplatePercentage =
      rawWordCount > 0
        ? Math.max(0, Math.min(100, Math.round(((rawWordCount - wordCount) / rawWordCount) * 100)))
        : 0;

    // Compute exact MD5 content hash for strict duplicate detection
    const contentHash = crypto.createHash('md5').update(cleanText.toLowerCase()).digest('hex');

    // Compute 64-bit SimHash for Near Duplicate Detection (shingling / word frequencies)
    const simHash = this.computeSimHash(words);

    // Evaluate Heading Structure Hierarchy
    const headingStructureErrors: string[] = [];
    if (h1.length === 0) {
      headingStructureErrors.push('Missing H1 heading on page');
    } else if (h1.length > 1) {
      headingStructureErrors.push(`Multiple H1 headings detected (${h1.length} instances)`);
    }

    // Check heading level jumps in raw DOM order
    let lastLevel = 0;
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tagName = (el as any).tagName?.toLowerCase();
      if (!tagName) return;
      const level = parseInt(tagName.substring(1), 10);
      if (!isNaN(level)) {
        if (lastLevel > 0 && level - lastLevel > 1) {
          headingStructureErrors.push(`Improper heading hierarchy jump from H${lastLevel} directly to H${level}`);
        }
        lastLevel = level;
      }
    });

    // Link densities (links per 100 words)
    const internalLinkDensity = wordCount > 0 ? parseFloat(((internalLinkCount / wordCount) * 100).toFixed(2)) : 0;
    const externalLinkDensity = wordCount > 0 ? parseFloat(((externalLinkCount / wordCount) * 100).toFixed(2)) : 0;

    return {
      wordCount,
      readingTimeMin,
      contentHash,
      simHash,
      headingStructureErrors: Array.from(new Set(headingStructureErrors)),
      imageCount,
      internalLinkDensity,
      externalLinkDensity,
      extractionMethod,
      mainContentSelector,
      boilerplatePercentage,
      rawWordCount,
    };
  }

  /**
   * Computes a 64-bit SimHash representation of word tokens for near-duplicate identification.
   */
  computeSimHash(words: string[]): string {
    if (!words || words.length === 0) return '0000000000000000';

    const v = new Array<number>(64).fill(0);

    for (const word of words) {
      const hash = crypto.createHash('md5').update(word.toLowerCase()).digest('hex').substring(0, 16);
      const bigIntHash = BigInt('0x' + hash);

      for (let i = 0; i < 64; i++) {
        const bit = (bigIntHash >> BigInt(i)) & BigInt(1);
        if (bit === BigInt(1)) {
          v[i] += 1;
        } else {
          v[i] -= 1;
        }
      }
    }

    let fingerprint = BigInt(0);
    for (let i = 0; i < 64; i++) {
      if (v[i] > 0) {
        fingerprint |= BigInt(1) << BigInt(i);
      }
    }

    return fingerprint.toString(16).padStart(16, '0');
  }
}
