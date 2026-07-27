import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import * as url from 'url';

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  images?: Array<{ loc: string; title?: string; caption?: string }>;
  videos?: Array<{ title?: string; thumbnail_loc?: string; description?: string }>;
}

export interface SitemapResult {
  sitemapsDiscovered: string[];
  urls: SitemapUrlEntry[];
  error?: string;
}

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);
  private readonly xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: true, // Strips prefixes like image:loc -> loc, video:video -> video
      isArray: (name, jpath, isLeafNode, isAttribute) => {
        return ['sitemap', 'url', 'image', 'video'].indexOf(name) !== -1;
      },
    });
  }

  /**
   * Automatically discovers and recursively parses all XML sitemaps for a website.
   * Supports Sitemap Index, standard sitemaps, and embedded Image/Video sitemaps.
   */
  async discoverAndParseSitemaps(domainOrUrl: string, knownSitemapUrls: string[] = []): Promise<SitemapResult> {
    let baseUrl = domainOrUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    const parsedUrl = url.parse(baseUrl);
    const domain = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const candidateUrls = new Set<string>(knownSitemapUrls);
    candidateUrls.add(`${domain}/sitemap.xml`);
    candidateUrls.add(`${domain}/sitemap_index.xml`);

    const result: SitemapResult = {
      sitemapsDiscovered: [],
      urls: [],
    };

    const visitedSitemaps = new Set<string>();

    for (const sitemapUrl of candidateUrls) {
      await this.fetchAndParseSitemapRecursive(sitemapUrl, visitedSitemaps, result);
    }

    // Deduplicate extracted URLs by loc
    const uniqueMap = new Map<string, SitemapUrlEntry>();
    for (const entry of result.urls) {
      if (entry.loc && !uniqueMap.has(entry.loc)) {
        uniqueMap.set(entry.loc, entry);
      }
    }
    result.urls = Array.from(uniqueMap.values());

    this.logger.log(`Sitemap discovery complete for ${domain}: Found ${result.sitemapsDiscovered.length} sitemaps and ${result.urls.length} unique URLs.`);
    return result;
  }

  /**
   * Recursively fetches an XML sitemap or sitemap index and extracts URL entries
   */
  private async fetchAndParseSitemapRecursive(
    sitemapUrl: string,
    visited: Set<string>,
    result: SitemapResult,
    depth: number = 0
  ): Promise<void> {
    if (depth > 5 || visited.has(sitemapUrl)) return;
    visited.add(sitemapUrl);

    try {
      this.logger.debug(`Fetching sitemap [Depth ${depth}]: ${sitemapUrl}`);
      const response = await axios.get(sitemapUrl, {
        timeout: 10000,
        validateStatus: (status) => status === 200,
        headers: {
          'User-Agent': process.env.USER_AGENT || 'GrowthX-AI-Bot/1.0 (+https://growthx.ai/bot)',
          'Accept': 'application/xml, text/xml, */*;q=0.8',
        },
      });

      if (!response.data || typeof response.data !== 'string') return;

      const jsonObj = this.xmlParser.parse(response.data);

      // 1. Check if it's a sitemapindex
      if (jsonObj.sitemapindex && jsonObj.sitemapindex.sitemap) {
        result.sitemapsDiscovered.push(sitemapUrl);
        const childSitemaps = jsonObj.sitemapindex.sitemap;
        for (const child of childSitemaps) {
          if (child && child.loc) {
            await this.fetchAndParseSitemapRecursive(child.loc.trim(), visited, result, depth + 1);
          }
        }
        return;
      }

      // 2. Check if it's a urlset (standard sitemap)
      if (jsonObj.urlset && jsonObj.urlset.url) {
        result.sitemapsDiscovered.push(sitemapUrl);
        const urlEntries = jsonObj.urlset.url;

        for (const u of urlEntries) {
          if (!u || !u.loc) continue;

          const entry: SitemapUrlEntry = {
            loc: u.loc.trim(),
            lastmod: u.lastmod ? String(u.lastmod) : undefined,
            changefreq: u.changefreq ? String(u.changefreq) : undefined,
            priority: u.priority ? parseFloat(u.priority) : undefined,
          };

          // Extract image sitemap extensions
          if (u.image && Array.isArray(u.image)) {
            entry.images = u.image.map((img: any) => ({
              loc: img.loc ? String(img.loc).trim() : '',
              title: img.title ? String(img.title) : undefined,
              caption: img.caption ? String(img.caption) : undefined,
            })).filter((i: any) => i.loc);
          }

          // Extract video sitemap extensions
          if (u.video && Array.isArray(u.video)) {
            entry.videos = u.video.map((vid: any) => ({
              title: vid.title ? String(vid.title) : undefined,
              thumbnail_loc: vid.thumbnail_loc ? String(vid.thumbnail_loc) : undefined,
              description: vid.description ? String(vid.description) : undefined,
            }));
          }

          result.urls.push(entry);
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to parse sitemap at ${sitemapUrl}: ${error.message}`);
    }
  }
}
