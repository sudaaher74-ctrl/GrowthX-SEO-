import * as cheerio from 'cheerio';
import { normalizeUrl } from './url/url-normalizer';
import { sameRegistrableDomain } from './url/registrable-domain';

export interface HeadingNode {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ExtractedPageLink {
  href: string;
  absoluteUrl: string;
  anchorText: string;
  rel?: string;
  isNofollow: boolean;
  isInternal: boolean;
  location?: 'navigation' | 'footer' | 'header' | 'main' | 'other';
}

export interface ExtractedPageImage {
  src: string;
  alt?: string;
  width?: string;
  height?: string;
  loading?: string;
}

export interface ExtractedPage {
  title?: string;
  titleLength: number;
  metaDescription?: string;
  metaDescriptionLength: number;
  canonicalUrl?: string;
  canonicalIsSelfReferential?: boolean;
  metaRobots?: string;
  headings: HeadingNode[];
  h1: string[];
  h2: string[];
  h3: string[];
  /** Main content only: navigation, header and footer removed. */
  wordCount: number;
  /**
   * Every word in <body>, boilerplate included.
   *
   * Kept alongside wordCount because the two answer different questions and
   * quoting one as the other is how a thin-content finding becomes an
   * argument. A page can carry 427 words of which 103 are its own navigation.
   */
  bodyWordCount: number;
  internalLinks: ExtractedPageLink[];
  externalLinks: ExtractedPageLink[];
  paginationUrls: string[];
  structuredDataUrls: string[];
  images: ExtractedPageImage[];
  jsonLd: unknown[];
  microdataTypes: string[];
  hreflang: Array<{ hreflang: string; href: string }>;
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  language?: string;
  mainText: string;
}


/**
 * Serialized HTML has no word boundaries at block edges.
 *
 * `<h1>Archery</h1><p>Coaching</p>` is two words to a reader and one token to
 * `textContent`, which runs them together as "ArcheryCoaching". A browser's
 * `innerText` inserts the break; cheerio does not, and the difference showed up
 * as a word count 18% below the browser's on a real page - enough to push a
 * page across the thin-content threshold in the wrong direction.
 */
const BLOCK_BOUNDARY = /<\/?(?:address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

function separateBlocks(html: string): string {
  return (html || '').replace(BLOCK_BOUNDARY, (tag) => ` ${tag} `);
}

/** Chrome that is on every page and is not what the page is about. */
const BOILERPLATE_SELECTORS =
  'script, style, noscript, svg, canvas, iframe, template, nav, header, footer, [role="navigation"], [role="contentinfo"], [role="banner"], [aria-hidden="true"], [hidden]';

/**
 * Reads every SEO signal off one DOM.
 *
 * Fed the rendered HTML whenever the render tier ran, which is the whole point:
 * on a client-rendered site the title, description, JSON-LD, headings and links
 * do not exist in the bytes the origin served, and reading them from there
 * yields a page with no title and no words — which is then reported as four
 * separate content defects.
 */
export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html || '');

  const title = $('title').first().text().trim() || $('meta[property="og:title"]').attr('content')?.trim() || undefined;
  const metaDescription = $('meta[name="description" i]').attr('content')?.trim() || undefined;
  const metaRobots = $('meta[name="robots" i]').attr('content')?.trim() || $('meta[name="googlebot" i]').attr('content')?.trim() || undefined;

  const rawCanonical = $('link[rel="canonical" i]').attr('href')?.trim();
  let canonicalUrl: string | undefined;
  let canonicalIsSelfReferential: boolean | undefined;
  if (rawCanonical) {
    try {
      canonicalUrl = new URL(rawCanonical, pageUrl).toString();
      canonicalIsSelfReferential = normalizeUrl(canonicalUrl) === normalizeUrl(pageUrl);
    } catch {
      // A canonical we cannot parse is reported as its own issue; it is not
      // evidence that the page points elsewhere.
      canonicalUrl = rawCanonical;
      canonicalIsSelfReferential = undefined;
    }
  }

  const headings: HeadingNode[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = (el as { tagName?: string }).tagName || '';
    const level = Number(tag.replace(/\D/g, '')) as HeadingNode['level'];
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (level && text) headings.push({ level, text });
  });

  const internalLinks: ExtractedPageLink[] = [];
  const externalLinks: ExtractedPageLink[] = [];
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href) return;
    const absolute = normalizeUrl(href, { base: pageUrl });
    if (!absolute) return;
    const rel = $(el).attr('rel')?.trim();
    const $el = $(el);
    let location: ExtractedPageLink['location'] = 'other';
    if ($el.closest('header').length > 0) {
      location = 'header';
    } else if ($el.closest('nav, [role="navigation"]').length > 0) {
      location = 'navigation';
    } else if ($el.closest('footer, [role="contentinfo"]').length > 0) {
      location = 'footer';
    } else if ($el.closest('main, article, [role="main"]').length > 0) {
      location = 'main';
    }

    const link: ExtractedPageLink = {
      href,
      absoluteUrl: absolute,
      anchorText: $el.text().replace(/\s+/g, ' ').trim(),
      rel,
      isNofollow: /(^|\s)nofollow(\s|$)/i.test(rel || ''),
      isInternal: sameRegistrableDomain(absolute, pageUrl),
      location,
    };
    (link.isInternal ? internalLinks : externalLinks).push(link);
  });

  const paginationUrls: string[] = [];
  const addPagination = (rawHref?: string) => {
    if (!rawHref) return;
    const abs = normalizeUrl(rawHref, { base: pageUrl });
    if (abs && sameRegistrableDomain(abs, pageUrl) && !paginationUrls.includes(abs)) {
      paginationUrls.push(abs);
    }
  };
  $('link[rel="next" i], link[rel="prev" i]').each((_, el) => {
    addPagination($(el).attr('href'));
  });
  $('a[rel~="next" i], a[rel~="prev" i]').each((_, el) => {
    addPagination($(el).attr('href'));
  });

  const images: ExtractedPageImage[] = [];
  $('img').each((_, el) => {
    const src = ($(el).attr('src') || $(el).attr('data-src') || '').trim();
    if (!src) return;
    images.push({
      src: (() => {
        try {
          return new URL(src, pageUrl).toString();
        } catch {
          return src;
        }
      })(),
      alt: $(el).attr('alt') ?? undefined,
      width: $(el).attr('width') ?? undefined,
      height: $(el).attr('height') ?? undefined,
      loading: $(el).attr('loading') ?? undefined,
    });
  });

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json" i]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw.trim());
      if (Array.isArray(parsed)) jsonLd.push(...parsed);
      else jsonLd.push(parsed);
    } catch {
      // Malformed JSON-LD is reported by the schema validator, not silently
      // counted as absent.
      jsonLd.push({ '@type': 'INVALID_JSON_LD', raw: raw.slice(0, 200) });
    }
  });

  const structuredDataUrls = extractUrlsFromJsonLd(jsonLd, pageUrl);

  const microdataTypes = $('[itemscope][itemtype]')
    .map((_, el) => $(el).attr('itemtype')?.trim())
    .get()
    .filter(Boolean) as string[];

  const hreflang: Array<{ hreflang: string; href: string }> = [];
  $('link[rel="alternate" i][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang')?.trim();
    const href = $(el).attr('href')?.trim();
    if (lang && href) {
      try {
        hreflang.push({ hreflang: lang, href: new URL(href, pageUrl).toString() });
      } catch {
        hreflang.push({ hreflang: lang, href });
      }
    }
  });

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:" i]').each((_, el) => {
    const key = $(el).attr('property')?.toLowerCase();
    const content = $(el).attr('content')?.trim();
    if (key && content) openGraph[key] = content;
  });

  const twitterCard: Record<string, string> = {};
  $('meta[name^="twitter:" i]').each((_, el) => {
    const key = $(el).attr('name')?.toLowerCase();
    const content = $(el).attr('content')?.trim();
    if (key && content) twitterCard[key] = content;
  });

  // Word count is taken from the main content with navigation and footers
  // removed, on a throwaway parse so the link and image extraction above still
  // sees the whole page.
  const $body = cheerio.load(separateBlocks(html));
  $body('script, style, noscript, template').remove();
  const bodyText = $body('body').text().replace(/\s+/g, ' ').trim();

  const $content = cheerio.load(separateBlocks(html));
  $content(BOILERPLATE_SELECTORS).remove();
  const main = $content('main').first().length ? $content('main').first() : $content('article').first().length ? $content('article').first() : $content('body');
  const mainText = main.text().replace(/\s+/g, ' ').trim();

  return {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonicalUrl,
    canonicalIsSelfReferential,
    metaRobots,
    headings,
    h1: headings.filter((h) => h.level === 1).map((h) => h.text),
    h2: headings.filter((h) => h.level === 2).map((h) => h.text),
    h3: headings.filter((h) => h.level === 3).map((h) => h.text),
    wordCount: mainText ? mainText.split(' ').filter(Boolean).length : 0,
    bodyWordCount: bodyText ? bodyText.split(' ').filter(Boolean).length : 0,
    internalLinks,
    externalLinks,
    paginationUrls,
    structuredDataUrls,
    images,
    jsonLd,
    microdataTypes,
    hreflang,
    openGraph,
    twitterCard,
    language: $('html').attr('lang')?.trim() || undefined,
    mainText,
  };
}

/** Recursively extracts internal URLs from JSON-LD structures (ItemLists, Products, Breadcrumbs, etc.) */
export function extractUrlsFromJsonLd(items: unknown[], baseUrl: string): string[] {
  const discovered = new Set<string>();

  const inspectValue = (val: unknown) => {
    if (!val) return;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // Skip non-URLs, data URLs, Javascript, etc.
      if (
        (trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
        !trimmed.startsWith('//') &&
        !trimmed.includes('{') &&
        !trimmed.includes('}')
      ) {
        const normalized = normalizeUrl(trimmed, { base: baseUrl });
        if (normalized && sameRegistrableDomain(normalized, baseUrl)) {
          discovered.add(normalized);
        }
      }
    } else if (Array.isArray(val)) {
      for (const item of val) inspectValue(item);
    } else if (typeof val === 'object') {
      for (const [key, propVal] of Object.entries(val as Record<string, unknown>)) {
        if (
          ['@id', 'url', 'item', 'contentUrl', 'sameAs', 'mainEntityOfPage', 'significantLink', 'target'].includes(key) ||
          typeof propVal === 'string' ||
          typeof propVal === 'object'
        ) {
          inspectValue(propVal);
        }
      }
    }
  };

  for (const item of items) {
    inspectValue(item);
  }

  return [...discovered];
}
