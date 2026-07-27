import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import * as url from 'url';

export interface ExtractedImage {
  imageUrl: string;
  altText?: string;
  width?: number;
  height?: number;
  isLazy: boolean;
  isMissingAlt: boolean;
  isBroken: boolean;
  isLarge: boolean;
}

@Injectable()
export class ImageAnalyzerService {
  private readonly logger = new Logger(ImageAnalyzerService.name);

  /**
   * Analyzes all images in HTML, detecting alt text issues, lazy loading, and dimension properties
   */
  analyzeImages(html: string, pageUrl: string): ExtractedImage[] {
    const $ = cheerio.load(html || '');
    const images: ExtractedImage[] = [];

    $('img').each((_, el) => {
      let src = $(el).attr('src')?.trim() || $(el).attr('data-src')?.trim() || $(el).attr('data-lazy-src')?.trim();
      if (!src || src.startsWith('data:image')) {
        return;
      }

      try {
        const resolvedUrl = url.resolve(pageUrl, src);
        const alt = $(el).attr('alt');
        const isMissingAlt = alt === undefined || alt.trim() === '';

        const widthAttr = $(el).attr('width');
        const heightAttr = $(el).attr('height');
        const width = widthAttr ? parseInt(widthAttr, 10) : undefined;
        const height = heightAttr ? parseInt(heightAttr, 10) : undefined;

        const loadingAttr = $(el).attr('loading')?.toLowerCase();
        const isLazy = loadingAttr === 'lazy' || $(el).attr('data-src') !== undefined;

        // Flag as large if explicit width attribute > 1920 or if file extension implies unoptimized hero
        const isLarge = (width !== undefined && !isNaN(width) && width > 1920) || 
                        resolvedUrl.toLowerCase().endsWith('.bmp') || 
                        resolvedUrl.toLowerCase().endsWith('.tiff');

        images.push({
          imageUrl: resolvedUrl,
          altText: alt !== undefined ? alt.trim() : undefined,
          width: !isNaN(width as number) ? width : undefined,
          height: !isNaN(height as number) ? height : undefined,
          isLazy,
          isMissingAlt,
          isBroken: false, // Verified via network worker or HTTP response code in live crawl
          isLarge,
        });
      } catch (e) {
        // Ignore malformed URLs
      }
    });

    return images;
  }
}
