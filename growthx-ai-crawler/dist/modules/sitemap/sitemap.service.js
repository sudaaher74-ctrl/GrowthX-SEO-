"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SitemapService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SitemapService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const fast_xml_parser_1 = require("fast-xml-parser");
const url = require("url");
let SitemapService = SitemapService_1 = class SitemapService {
    constructor() {
        this.logger = new common_1.Logger(SitemapService_1.name);
        this.xmlParser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            removeNSPrefix: true, // Strips prefixes like image:loc -> loc, video:video -> video
            isArray: (name) => {
                return ['sitemap', 'url', 'image', 'video'].indexOf(name) !== -1;
            },
        });
    }
    /**
     * Automatically discovers and recursively parses all XML sitemaps for a website.
     * Supports Sitemap Index, standard sitemaps, and embedded Image/Video sitemaps.
     */
    async discoverAndParseSitemaps(domainOrUrl, knownSitemapUrls = []) {
        let baseUrl = domainOrUrl.trim();
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrl = `https://${baseUrl}`;
        }
        const parsedUrl = url.parse(baseUrl);
        const domain = `${parsedUrl.protocol}//${parsedUrl.host}`;
        const candidateUrls = new Set(knownSitemapUrls);
        candidateUrls.add(`${domain}/sitemap.xml`);
        candidateUrls.add(`${domain}/sitemap_index.xml`);
        const result = {
            sitemapsDiscovered: [],
            urls: [],
        };
        const visitedSitemaps = new Set();
        for (const sitemapUrl of candidateUrls) {
            await this.fetchAndParseSitemapRecursive(sitemapUrl, visitedSitemaps, result);
        }
        // Deduplicate extracted URLs by loc
        const uniqueMap = new Map();
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
    async fetchAndParseSitemapRecursive(sitemapUrl, visited, result, depth = 0) {
        if (depth > 5 || visited.has(sitemapUrl))
            return;
        visited.add(sitemapUrl);
        try {
            this.logger.debug(`Fetching sitemap [Depth ${depth}]: ${sitemapUrl}`);
            const response = await axios_1.default.get(sitemapUrl, {
                timeout: 10000,
                validateStatus: (status) => status === 200,
                headers: {
                    'User-Agent': process.env.USER_AGENT || 'GrowthX-AI-Bot/1.0 (+https://growthx.ai/bot)',
                    'Accept': 'application/xml, text/xml, */*;q=0.8',
                },
            });
            if (!response.data || typeof response.data !== 'string')
                return;
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
                    if (!u || !u.loc)
                        continue;
                    const entry = {
                        loc: u.loc.trim(),
                        lastmod: u.lastmod ? String(u.lastmod) : undefined,
                        changefreq: u.changefreq ? String(u.changefreq) : undefined,
                        priority: u.priority ? parseFloat(u.priority) : undefined,
                    };
                    // Extract image sitemap extensions
                    if (u.image && Array.isArray(u.image)) {
                        entry.images = u.image.map((img) => ({
                            loc: img.loc ? String(img.loc).trim() : '',
                            title: img.title ? String(img.title) : undefined,
                            caption: img.caption ? String(img.caption) : undefined,
                        })).filter((i) => i.loc);
                    }
                    // Extract video sitemap extensions
                    if (u.video && Array.isArray(u.video)) {
                        entry.videos = u.video.map((vid) => ({
                            title: vid.title ? String(vid.title) : undefined,
                            thumbnail_loc: vid.thumbnail_loc ? String(vid.thumbnail_loc) : undefined,
                            description: vid.description ? String(vid.description) : undefined,
                        }));
                    }
                    result.urls.push(entry);
                }
            }
        }
        catch (error) {
            this.logger.warn(`Failed to parse sitemap at ${sitemapUrl}: ${error.message}`);
        }
    }
};
exports.SitemapService = SitemapService;
exports.SitemapService = SitemapService = SitemapService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SitemapService);
//# sourceMappingURL=sitemap.service.js.map