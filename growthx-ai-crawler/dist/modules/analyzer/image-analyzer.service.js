"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ImageAnalyzerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageAnalyzerService = void 0;
const common_1 = require("@nestjs/common");
const cheerio = require("cheerio");
const url = require("url");
let ImageAnalyzerService = ImageAnalyzerService_1 = class ImageAnalyzerService {
    constructor() {
        this.logger = new common_1.Logger(ImageAnalyzerService_1.name);
    }
    /**
     * Analyzes all images in HTML, detecting alt text issues, lazy loading, and dimension properties
     */
    analyzeImages(html, pageUrl) {
        const $ = cheerio.load(html || '');
        const images = [];
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
                    width: !isNaN(width) ? width : undefined,
                    height: !isNaN(height) ? height : undefined,
                    isLazy,
                    isMissingAlt,
                    isBroken: false, // Verified via network worker or HTTP response code in live crawl
                    isLarge,
                });
            }
            catch {
                // Ignore malformed URLs
            }
        });
        return images;
    }
};
exports.ImageAnalyzerService = ImageAnalyzerService;
exports.ImageAnalyzerService = ImageAnalyzerService = ImageAnalyzerService_1 = __decorate([
    (0, common_1.Injectable)()
], ImageAnalyzerService);
//# sourceMappingURL=image-analyzer.service.js.map