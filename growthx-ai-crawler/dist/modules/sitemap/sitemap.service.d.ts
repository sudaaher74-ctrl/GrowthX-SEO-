export interface SitemapUrlEntry {
    loc: string;
    lastmod?: string;
    changefreq?: string;
    priority?: number;
    images?: Array<{
        loc: string;
        title?: string;
        caption?: string;
    }>;
    videos?: Array<{
        title?: string;
        thumbnail_loc?: string;
        description?: string;
    }>;
}
export interface SitemapResult {
    sitemapsDiscovered: string[];
    urls: SitemapUrlEntry[];
    error?: string;
}
export declare class SitemapService {
    private readonly logger;
    private readonly xmlParser;
    constructor();
    /**
     * Automatically discovers and recursively parses all XML sitemaps for a website.
     * Supports Sitemap Index, standard sitemaps, and embedded Image/Video sitemaps.
     */
    discoverAndParseSitemaps(domainOrUrl: string, knownSitemapUrls?: string[]): Promise<SitemapResult>;
    /**
     * Recursively fetches an XML sitemap or sitemap index and extracts URL entries
     */
    private fetchAndParseSitemapRecursive;
}
