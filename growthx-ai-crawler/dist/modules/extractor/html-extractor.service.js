"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HtmlExtractorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlExtractorService = void 0;
const common_1 = require("@nestjs/common");
const cheerio = require("cheerio");
let HtmlExtractorService = HtmlExtractorService_1 = class HtmlExtractorService {
    constructor() {
        this.logger = new common_1.Logger(HtmlExtractorService_1.name);
    }
    /**
     * Parses raw HTML string and extracts all technical SEO metadata, headers, structured data, and OpenGraph tags.
     */
    extract(html, pageUrl) {
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
            }
            catch (e) { }
        }
        // 4. Headings
        const h1 = $('h1').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
        const h2 = $('h2').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
        const h3 = $('h3').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
        // 5. OpenGraph & Twitter Cards
        const openGraph = {};
        $('meta[property^="og:" i]').each((_, el) => {
            const prop = $(el).attr('property')?.toLowerCase();
            const content = $(el).attr('content')?.trim();
            if (prop && content) {
                openGraph[prop] = content;
            }
        });
        const twitterCards = {};
        $('meta[name^="twitter:" i]').each((_, el) => {
            const name = $(el).attr('name')?.toLowerCase();
            const content = $(el).attr('content')?.trim();
            if (name && content) {
                twitterCards[name] = content;
            }
        });
        // 6. Structured Data (JSON-LD)
        const jsonLd = [];
        $('script[type="application/ld+json" i]').each((_, el) => {
            try {
                const raw = $(el).html();
                if (raw) {
                    const parsed = JSON.parse(raw.trim());
                    if (Array.isArray(parsed)) {
                        jsonLd.push(...parsed);
                    }
                    else {
                        jsonLd.push(parsed);
                    }
                }
            }
            catch (err) {
                // Malformed JSON-LD
            }
        });
        // 7. Microdata
        const microdataTypes = $('[itemscope][itemtype]').map((_, el) => {
            return $(el).attr('itemtype')?.trim();
        }).get().filter(Boolean);
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
};
exports.HtmlExtractorService = HtmlExtractorService;
exports.HtmlExtractorService = HtmlExtractorService = HtmlExtractorService_1 = __decorate([
    (0, common_1.Injectable)()
], HtmlExtractorService);
//# sourceMappingURL=html-extractor.service.js.map