import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import * as url from 'url';

export interface ExtractedLink {
  targetUrl: string;
  linkType: 'INTERNAL' | 'EXTERNAL';
  anchorText?: string;
  isNofollow: boolean;
  isBrokenAnchor: boolean;
  rawHref: string;
}

export interface LinkAnalysisResult {
  internalLinks: ExtractedLink[];
  externalLinks: ExtractedLink[];
  brokenAnchors: ExtractedLink[];
  nofollowLinks: ExtractedLink[];
  internalCount: number;
  externalCount: number;
  totalCount: number;
}

@Injectable()
export class LinkAnalyzerService {
  private readonly logger = new Logger(LinkAnalyzerService.name);

  /**
   * Analyzes all hyperlinks in HTML for internal/external classification, nofollow attributes, and broken anchor (#) targets
   */
  analyzeLinks(html: string, pageUrl: string): LinkAnalysisResult {
    const $ = cheerio.load(html || '');
    const parsedDomain = url.parse(pageUrl);
    const origin = `${parsedDomain.protocol}//${parsedDomain.host}`;

    // Collect all element IDs and names in the DOM to check for broken anchor targets
    const validAnchorIds = new Set<string>();
    $('[id], [name]').each((_, el) => {
      const id = $(el).attr('id') || $(el).attr('name');
      if (id) validAnchorIds.add(id.trim());
    });

    const internalLinks: ExtractedLink[] = [];
    const externalLinks: ExtractedLink[] = [];
    const brokenAnchors: ExtractedLink[] = [];
    const nofollowLinks: ExtractedLink[] = [];

    $('a[href]').each((_, el) => {
      const rawHref = $(el).attr('href')?.trim();
      if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        return;
      }

      // Check for same-page anchor link (e.g., #section-1)
      if (rawHref.startsWith('#')) {
        const targetId = rawHref.substring(1);
        const isBrokenAnchor = targetId.length > 0 && !validAnchorIds.has(targetId);
        const linkObj: ExtractedLink = {
          targetUrl: pageUrl + rawHref,
          linkType: 'INTERNAL',
          anchorText: $(el).text().replace(/\s+/g, ' ').trim() || undefined,
          isNofollow: false,
          isBrokenAnchor,
          rawHref,
        };
        if (isBrokenAnchor) brokenAnchors.push(linkObj);
        return;
      }

      try {
        const resolvedUrl = url.resolve(pageUrl, rawHref);
        const resolvedParsed = url.parse(resolvedUrl);
        const resolvedOrigin = `${resolvedParsed.protocol}//${resolvedParsed.host}`;

        const isInternal = resolvedOrigin.toLowerCase() === origin.toLowerCase();
        const rel = $(el).attr('rel')?.toLowerCase() || '';
        const isNofollow = rel.includes('nofollow') || rel.includes('ugc') || rel.includes('sponsored');

        // Check if there is an anchor hash attached to an internal URL
        let isBrokenAnchor = false;
        if (isInternal && resolvedParsed.hash && resolvedParsed.pathname === parsedDomain.pathname) {
          const targetId = resolvedParsed.hash.substring(1);
          if (targetId.length > 0 && !validAnchorIds.has(targetId)) {
            isBrokenAnchor = true;
          }
        }

        const linkObj: ExtractedLink = {
          targetUrl: url.format({ ...resolvedParsed, hash: null }), // Clean target without hash for graph tracking
          linkType: isInternal ? 'INTERNAL' : 'EXTERNAL',
          anchorText: $(el).text().replace(/\s+/g, ' ').trim() || undefined,
          isNofollow,
          isBrokenAnchor,
          rawHref,
        };

        if (isInternal) {
          internalLinks.push(linkObj);
        } else {
          externalLinks.push(linkObj);
        }

        if (isNofollow) nofollowLinks.push(linkObj);
        if (isBrokenAnchor) brokenAnchors.push(linkObj);
      } catch (e) {
        // Ignore malformed URIs
      }
    });

    return {
      internalLinks,
      externalLinks,
      brokenAnchors,
      nofollowLinks,
      internalCount: internalLinks.length,
      externalCount: externalLinks.length,
      totalCount: internalLinks.length + externalLinks.length,
    };
  }
}
