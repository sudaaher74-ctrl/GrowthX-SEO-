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
}

@Injectable()
export class ContentAnalyzerService {
  private readonly logger = new Logger(ContentAnalyzerService.name);

  /**
   * Evaluates textual content quality, word count, reading time, heading hierarchy, and computes hash fingerprints
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

    // Strip scripts, styles, and nav elements to get clean text
    $('script, style, nav, footer, header, noscript, svg').remove();
    const cleanText = $('body').text().replace(/\s+/g, ' ').trim();

    const words = cleanText.split(' ').filter((w) => w.length > 0);
    const wordCount = words.length;
    const readingTimeMin = parseFloat((wordCount / 200).toFixed(2)); // Standard 200 WPM

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
      const tagName = el.tagName?.toLowerCase();
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
    };
  }

  /**
   * Computes a 64-bit SimHash representation of word tokens for near-duplicate identification.
   * Two documents with Hamming distance <= 3 are considered near-duplicates.
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

  /**
   * Calculates Hamming distance between two hex SimHashes (returns difference bit count 0-64)
   */
  calculateHammingDistance(hashA: string, hashB: string): number {
    try {
      const a = BigInt('0x' + hashA);
      const b = BigInt('0x' + hashB);
      let xor = a ^ b;
      let dist = 0;
      while (xor > BigInt(0)) {
        if ((xor & BigInt(1)) === BigInt(1)) dist++;
        xor >>= BigInt(1);
      }
      return dist;
    } catch {
      return 64;
    }
  }
}
