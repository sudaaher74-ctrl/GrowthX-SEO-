import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

/**
 * Turns a stored HTML snapshot into the editable regions of a page.
 *
 * What this can and cannot measure, stated plainly because the Design Fit
 * score depends on it:
 *
 * - Word and character limits ARE measured, from the comparable sections that
 *   already exist on the same page. "As long as the longest section this page
 *   already renders" is a real limit taken from the real design.
 * - Line counts are NOT measured. Lines depend on font metrics and column
 *   width, which only exist once the page is rendered in a browser. Those
 *   fields stay null, the line-based checks stand down, and the score is
 *   computed from the factors that were genuinely measured.
 *
 * The alternative — assuming 90 characters per line — would produce mobile
 * overflow verdicts with nothing behind them, on the one screen whose entire
 * job is to be trusted about whether a change is safe.
 */

export interface ExtractedSlot {
  domSelector: string;
  sectionType: string;
  currentText: string;
  maxWords: number | null;
  maxChars: number | null;
  maxDesktopLines: number | null;
  maxMobileLines: number | null;
  allowedHtml: string[];
  safeToEdit: boolean;
  confidence: number;
}

export interface ExtractedPage {
  slots: ExtractedSlot[];
  /** Ordered section map the preview uses to place new content. */
  sections: Array<{ selector: string; sectionType: string; heading: string | null; index: number }>;
  /** Fonts and colours lifted off inline styles and style attributes. */
  styles: Record<string, string[]>;
}

/** Regions whose content is shared across pages — never auto-editable. */
const GLOBAL_REGIONS = ['nav', 'header', 'footer', 'aside'];

const SECTION_KEYWORDS: Array<[RegExp, string]> = [
  [/\bfaq|frequently asked|questions\b/i, 'FAQ'],
  [/\bspecification|technical data|datasheet|spec\b/i, 'SPECS'],
  [/\bcompare|comparison|vs\b/i, 'COMPARISON'],
  [/\boverview|about|who we are|introduction\b/i, 'OVERVIEW'],
  [/\bcontact|get in touch|request a quote|enquire\b/i, 'CTA'],
  [/\brelated|explore|see also\b/i, 'LINKS'],
];

@Injectable()
export class SlotExtractorService {
  private readonly logger = new Logger(SlotExtractorService.name);

  extract(html: string): ExtractedPage {
    const $ = cheerio.load(html);

    // Strip what is never page content, so it cannot become a slot or skew the
    // measured limits.
    $('script, style, noscript, template, svg').remove();

    const root = $('main').first().length
      ? $('main').first()
      : $('article').first().length
        ? $('article').first()
        : $('body').first();

    const slots: ExtractedSlot[] = [];
    const sections: ExtractedPage['sections'] = [];

    const candidates = root.find('section, article, div').toArray();
    const measured: Array<{ words: number; chars: number }> = [];

    // First pass: collect the lengths of every section that already carries a
    // heading and real prose. These are what the limits are measured against.
    for (const el of candidates) {
      const $el = $(el);
      if (!this.hasOwnHeading($, $el)) continue;
      const text = this.ownText($, $el);
      const words = this.countWords(text);
      if (words >= 20) measured.push({ words, chars: text.length });
    }

    const maxWords = measured.length ? Math.max(...measured.map((m) => m.words)) : null;
    const maxChars = measured.length ? Math.max(...measured.map((m) => m.chars)) : null;

    let index = 0;
    for (const el of candidates) {
      const $el = $(el);
      if (!this.hasOwnHeading($, $el)) continue;

      const heading = $el.find('h1, h2, h3').first().text().trim() || null;
      const selector = this.selectorFor($, $el);
      const sectionType = this.classify(heading, $el.attr('class') ?? '');
      const text = this.ownText($, $el);

      sections.push({ selector, sectionType, heading, index: index++ });

      const inGlobalRegion = GLOBAL_REGIONS.some((tag) => $el.parents(tag).length > 0);
      const classAttr = ($el.attr('class') ?? '').trim();
      // A class used many times is a shared component: editing one instance
      // would visibly change the others too.
      const shared = classAttr ? $(`.${classAttr.split(/\s+/)[0]}`).length > 2 : false;

      slots.push({
        domSelector: selector,
        sectionType,
        currentText: text,
        maxWords,
        maxChars,
        // Deliberately null: see the file comment. A rendered capture fills
        // these in; nothing else may.
        maxDesktopLines: null,
        maxMobileLines: null,
        allowedHtml: this.tagsUsed($, $el),
        safeToEdit: !inGlobalRegion && !shared,
        confidence: this.confidenceFor({ hasHeading: Boolean(heading), shared, inGlobalRegion }),
      });
    }

    return { slots, sections, styles: this.capturedStyles($) };
  }

  /** A heading belonging to this element, not to a nested child section. */
  private hasOwnHeading($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): boolean {
    const heading = $el.find('h1, h2, h3').first();
    if (!heading.length) return false;
    return heading.parents('section, article, div').first().is($el as any);
  }

  /** Text of this element excluding text owned by nested sections. */
  private ownText($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): string {
    const clone = $el.clone();
    clone.find('section, article').remove();
    return clone.text().replace(/\s+/g, ' ').trim();
  }

  private countWords(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  private tagsUsed($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): string[] {
    const tags = new Set<string>();
    $el.find('*').each((_, child) => {
      const name = (child as any).tagName?.toLowerCase();
      if (name) tags.add(name);
    });
    return [...tags].sort();
  }

  /**
   * A selector that survives a re-crawl: an id when the page gives one,
   * otherwise a positional path. Positional paths are why `confidence` exists.
   */
  private selectorFor($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): string {
    const id = $el.attr('id');
    if (id) return `#${id}`;

    const parts: string[] = [];
    let current = $el;
    for (let depth = 0; depth < 5 && current.length; depth++) {
      const tag = (current.get(0) as any)?.tagName?.toLowerCase();
      if (!tag || tag === 'body' || tag === 'html') break;
      const ownId = current.attr('id');
      if (ownId) {
        parts.unshift(`#${ownId}`);
        break;
      }
      const position = current.parent().children(tag).index(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${position})`);
      current = current.parent();
    }
    return parts.join(' > ');
  }

  private classify(heading: string | null, className: string): string {
    const haystack = `${heading ?? ''} ${className}`;
    for (const [pattern, type] of SECTION_KEYWORDS) {
      if (pattern.test(haystack)) return type;
    }
    return 'OTHER';
  }

  private confidenceFor(input: {
    hasHeading: boolean;
    shared: boolean;
    inGlobalRegion: boolean;
  }): number {
    let score = 0.5;
    if (input.hasHeading) score += 0.3;
    if (input.shared) score -= 0.3;
    if (input.inGlobalRegion) score -= 0.3;
    return Math.min(1, Math.max(0, Number(score.toFixed(2))));
  }

  /**
   * Fonts and colours the page declares inline. Enough to tell generated
   * content what it has to sit inside; not a full computed-style capture,
   * which again needs a browser.
   */
  private capturedStyles($: cheerio.CheerioAPI): Record<string, string[]> {
    const fonts = new Set<string>();
    const colors = new Set<string>();

    $('[style]').each((_, el) => {
      const style = $(el).attr('style') ?? '';
      const font = /font-family:\s*([^;]+)/i.exec(style);
      if (font) fonts.add(font[1].trim());
      for (const match of style.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) colors.add(match[0]);
    });

    return { fonts: [...fonts].slice(0, 12), colors: [...colors].slice(0, 24) };
  }
}
