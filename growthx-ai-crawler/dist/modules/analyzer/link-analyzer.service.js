"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var LinkAnalyzerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkAnalyzerService = void 0;
const common_1 = require("@nestjs/common");
const cheerio = require("cheerio");
const url = require("url");
let LinkAnalyzerService = LinkAnalyzerService_1 = class LinkAnalyzerService {
    constructor() {
        this.logger = new common_1.Logger(LinkAnalyzerService_1.name);
    }
    /**
     * Analyzes all hyperlinks in HTML for internal/external classification, nofollow attributes, and broken anchor (#) targets
     */
    analyzeLinks(html, pageUrl) {
        const $ = cheerio.load(html || '');
        const parsedDomain = url.parse(pageUrl);
        const origin = `${parsedDomain.protocol}//${parsedDomain.host}`;
        // Collect all element IDs and names in the DOM to check for broken anchor targets
        const validAnchorIds = new Set();
        $('[id], [name]').each((_, el) => {
            const id = $(el).attr('id') || $(el).attr('name');
            if (id)
                validAnchorIds.add(id.trim());
        });
        const internalLinks = [];
        const externalLinks = [];
        const brokenAnchors = [];
        const nofollowLinks = [];
        $('a[href]').each((_, el) => {
            const rawHref = $(el).attr('href')?.trim();
            if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
                return;
            }
            // Check for same-page anchor link (e.g., #section-1)
            if (rawHref.startsWith('#')) {
                const targetId = rawHref.substring(1);
                const isBrokenAnchor = targetId.length > 0 && !validAnchorIds.has(targetId);
                const linkObj = {
                    targetUrl: pageUrl + rawHref,
                    linkType: 'INTERNAL',
                    anchorText: $(el).text().replace(/\s+/g, ' ').trim() || undefined,
                    isNofollow: false,
                    isBrokenAnchor,
                    rawHref,
                };
                if (isBrokenAnchor)
                    brokenAnchors.push(linkObj);
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
                const linkObj = {
                    targetUrl: url.format({ ...resolvedParsed, hash: null }), // Clean target without hash for graph tracking
                    linkType: isInternal ? 'INTERNAL' : 'EXTERNAL',
                    anchorText: $(el).text().replace(/\s+/g, ' ').trim() || undefined,
                    isNofollow,
                    isBrokenAnchor,
                    rawHref,
                };
                if (isInternal) {
                    internalLinks.push(linkObj);
                }
                else {
                    externalLinks.push(linkObj);
                }
                if (isNofollow)
                    nofollowLinks.push(linkObj);
                if (isBrokenAnchor)
                    brokenAnchors.push(linkObj);
            }
            catch {
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
};
exports.LinkAnalyzerService = LinkAnalyzerService;
exports.LinkAnalyzerService = LinkAnalyzerService = LinkAnalyzerService_1 = __decorate([
    (0, common_1.Injectable)()
], LinkAnalyzerService);
//# sourceMappingURL=link-analyzer.service.js.map