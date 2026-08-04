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
var IssueEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueEngineService = void 0;
const common_1 = require("@nestjs/common");
const cheerio = require("cheerio");
const prisma_service_1 = require("../../database/prisma.service");
const url = require("url");
let IssueEngineService = IssueEngineService_1 = class IssueEngineService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(IssueEngineService_1.name);
    }
    /**
     * Executes 25+ automated Technical SEO checks for a crawled page and persists detected issues to PostgreSQL
     */
    async evaluateAndPersistIssues(crawlJobId, pageId, pageUrl, statusCode, redirectChain, html, htmlData, images, links, content, schemas, inSitemap, robotsTxtExists) {
        const issues = [];
        // 1. Missing Title
        if (!htmlData.title) {
            issues.push({
                issueType: 'MISSING_TITLE',
                severity: 'CRITICAL',
                affectedUrl: pageUrl,
                description: 'Page does not have an HTML <title> tag.',
                recommendation: 'Add a unique, descriptive <title> tag between 30 and 60 characters containing targeted keywords.',
                aiFixAvailable: true,
            });
        }
        else {
            // 3. Long Title
            if (htmlData.title.length > 60) {
                issues.push({
                    issueType: 'LONG_TITLE',
                    severity: 'MEDIUM',
                    affectedUrl: pageUrl,
                    description: `Title tag is too long (${htmlData.title.length} characters). Search engines may truncate it in SERPs.`,
                    recommendation: 'Rewrite title tag to be under 60 characters while keeping important keywords at the front.',
                    aiFixAvailable: true,
                });
            }
            // 4. Short Title
            if (htmlData.title.length < 30) {
                issues.push({
                    issueType: 'SHORT_TITLE',
                    severity: 'LOW',
                    affectedUrl: pageUrl,
                    description: `Title tag is very short (${htmlData.title.length} characters) and may lack descriptive keyword depth.`,
                    recommendation: 'Expand title tag to 30-60 characters to better describe page content and capture long-tail queries.',
                    aiFixAvailable: true,
                });
            }
        }
        // 5. Missing Meta Description
        if (!htmlData.metaDescription) {
            issues.push({
                issueType: 'MISSING_META_DESCRIPTION',
                severity: 'HIGH',
                affectedUrl: pageUrl,
                description: 'Page is missing the meta description tag.',
                recommendation: 'Add a compelling meta description (120-160 characters) summarizing page content to boost SERP click-through rates.',
                aiFixAvailable: true,
            });
        }
        // 7. Missing Canonical
        if (!htmlData.canonicalUrl) {
            issues.push({
                issueType: 'MISSING_CANONICAL',
                severity: 'HIGH',
                affectedUrl: pageUrl,
                description: 'Page does not specify a self-referencing or preferred canonical URL.',
                recommendation: 'Add a <link rel="canonical" href="..." /> tag in the <head> to prevent duplicate content indexing.',
                aiFixAvailable: true,
            });
        }
        else {
            // 8. Broken Canonical (if canonical URL points to a different domain or mismatched protocol)
            if (htmlData.canonicalUrl.startsWith('http://') && pageUrl.startsWith('https://')) {
                issues.push({
                    issueType: 'BROKEN_CANONICAL',
                    severity: 'HIGH',
                    affectedUrl: pageUrl,
                    description: `Canonical URL uses insecure HTTP protocol (${htmlData.canonicalUrl}) while page is on HTTPS.`,
                    recommendation: 'Update canonical tag to use secure https:// protocol matching the actual page location.',
                    aiFixAvailable: true,
                });
            }
        }
        // 9. Missing H1
        if (htmlData.h1.length === 0) {
            issues.push({
                issueType: 'MISSING_H1',
                severity: 'HIGH',
                affectedUrl: pageUrl,
                description: 'Page does not contain any H1 heading.',
                recommendation: 'Add exactly one H1 heading that clearly introduces the primary topic of the page.',
                aiFixAvailable: true,
            });
        }
        // 10. Multiple H1
        else if (htmlData.h1.length > 1) {
            issues.push({
                issueType: 'MULTIPLE_H1',
                severity: 'MEDIUM',
                affectedUrl: pageUrl,
                description: `Page contains ${htmlData.h1.length} H1 headings. HTML5 allows this, but SEO best practice recommends a single primary H1 per page.`,
                recommendation: 'Consolidate headings so there is exactly one H1, and demote secondary section headers to H2 or H3.',
                aiFixAvailable: true,
            });
        }
        // 11. Thin Content
        if (content.wordCount < 300 && statusCode === 200) {
            issues.push({
                issueType: 'THIN_CONTENT',
                severity: 'HIGH',
                affectedUrl: pageUrl,
                description: `Page has low word count (${content.wordCount} words). Search engines may view this as low-value or doorway content.`,
                recommendation: 'Expand page copy with comprehensive, high-quality content that thoroughly answers visitor intent.',
                aiFixAvailable: true,
            });
        }
        // 12. Large HTML (> 100 KB)
        const htmlSizeKb = Buffer.byteLength(html || '', 'utf8') / 1024;
        if (htmlSizeKb > 100) {
            issues.push({
                issueType: 'LARGE_HTML',
                severity: 'MEDIUM',
                affectedUrl: pageUrl,
                description: `Raw HTML size is ${htmlSizeKb.toFixed(1)} KB (exceeds 100 KB guideline), which slows down DOM parsing and crawler efficiency.`,
                recommendation: 'Minify HTML, remove excessive inline scripts/styles, and reduce DOM depth.',
                aiFixAvailable: false,
            });
        }
        // 13. Missing Alt
        const missingAltCount = images.filter((i) => i.isMissingAlt).length;
        if (missingAltCount > 0) {
            issues.push({
                issueType: 'MISSING_ALT_TEXT',
                severity: 'HIGH',
                affectedUrl: pageUrl,
                description: `${missingAltCount} image(s) are missing alt text attributes.`,
                recommendation: 'Add descriptive alt text to all informative images for accessibility and image search ranking.',
                aiFixAvailable: true,
            });
        }
        // 14. Broken Images
        const brokenImgCount = images.filter((i) => i.isBroken).length;
        if (brokenImgCount > 0) {
            issues.push({
                issueType: 'BROKEN_IMAGE',
                severity: 'CRITICAL',
                affectedUrl: pageUrl,
                description: `${brokenImgCount} image(s) on this page returned 4xx or 5xx errors.`,
                recommendation: 'Fix image source URLs or replace missing media files on the server.',
                aiFixAvailable: false,
            });
        }
        // 15. Broken Internal Links / 4xx / 5xx Status
        if (statusCode >= 400) {
            issues.push({
                issueType: statusCode >= 500 ? 'SERVER_ERROR_5XX' : 'BROKEN_LINK_4XX',
                severity: 'CRITICAL',
                affectedUrl: pageUrl,
                description: `Page returned HTTP status code ${statusCode}. Visitors and crawlers cannot access content.`,
                recommendation: 'Resolve server errors, restore missing content, or set up a 301 redirect to an appropriate live page.',
                aiFixAvailable: false,
            });
        }
        // 16. Redirect Chains
        if (redirectChain.length > 2) {
            issues.push({
                issueType: 'REDIRECT_CHAIN',
                severity: 'HIGH',
                affectedUrl: pageUrl,
                description: `Page involves a redirect chain of ${redirectChain.length - 1} hops (${redirectChain.join(' -> ')}). This wastes crawl budget and delays page rendering.`,
                recommendation: 'Update internal links to point directly to the final destination URL.',
                aiFixAvailable: true,
            });
        }
        // 17. Loops
        const uniqueHops = new Set(redirectChain);
        if (uniqueHops.size < redirectChain.length) {
            issues.push({
                issueType: 'REDIRECT_LOOP',
                severity: 'CRITICAL',
                affectedUrl: pageUrl,
                description: `Infinite redirect loop detected in sequence: ${redirectChain.join(' -> ')}`,
                recommendation: 'Break redirect loop in server configuration (.htaccess, nginx, or routing rules).',
                aiFixAvailable: false,
            });
        }
        // 18. Noindex
        if (htmlData.robotsMeta && htmlData.robotsMeta.toLowerCase().includes('noindex')) {
            issues.push({
                issueType: 'NOINDEX_DETECTED',
                severity: 'HIGH',
                affectedUrl: pageUrl,
                description: `Page contains robots meta directive "noindex". Search engines are instructed not to index this page.`,
                recommendation: 'If this page should be searchable, remove the "noindex" directive from HTML head or X-Robots-Tag header.',
                aiFixAvailable: true,
            });
        }
        // 19. Incorrect Robots (conflicting directives)
        if (htmlData.robotsMeta) {
            const lower = htmlData.robotsMeta.toLowerCase();
            if (lower.includes('index') && lower.includes('noindex')) {
                issues.push({
                    issueType: 'INCORRECT_ROBOTS',
                    severity: 'HIGH',
                    affectedUrl: pageUrl,
                    description: `Conflicting robots directives found: "${htmlData.robotsMeta}". Search engines may default to restrictive behavior.`,
                    recommendation: 'Ensure robots meta tag contains unambiguous directives (e.g., "index, follow").',
                    aiFixAvailable: true,
                });
            }
        }
        // 20. Pagination issues
        if (pageUrl.includes('?page=') || pageUrl.includes('/page/')) {
            if (!htmlData.canonicalUrl) {
                issues.push({
                    issueType: 'PAGINATION_ISSUE',
                    severity: 'MEDIUM',
                    affectedUrl: pageUrl,
                    description: 'Paginated page lacks a canonical tag, which can lead to indexation bloat and keyword cannibalization.',
                    recommendation: 'Ensure paginated series uses self-referencing canonical tags or canonicalizes to a view-all page.',
                    aiFixAvailable: true,
                });
            }
        }
        // 21. HTTPS Issues
        if (pageUrl.startsWith('http://')) {
            issues.push({
                issueType: 'HTTPS_ISSUE',
                severity: 'CRITICAL',
                affectedUrl: pageUrl,
                description: 'Page is served over insecure HTTP protocol.',
                recommendation: 'Enforce sitewide 301 redirects from HTTP to HTTPS and install a valid SSL/TLS certificate.',
                aiFixAvailable: false,
            });
        }
        // 22. Mixed Content
        if (pageUrl.startsWith('https://')) {
            const $ = cheerio.load(html || '');
            let mixedCount = 0;
            $('img[src^="http://"], script[src^="http://"], link[rel="stylesheet"][href^="http://"]').each(() => {
                mixedCount++;
            });
            if (mixedCount > 0) {
                issues.push({
                    issueType: 'MIXED_CONTENT',
                    severity: 'CRITICAL',
                    affectedUrl: pageUrl,
                    description: `HTTPS page loads ${mixedCount} insecure HTTP resource(s) (images, scripts, or stylesheets). Browsers will block these assets.`,
                    recommendation: 'Update all asset URLs to use relative paths or secure https:// protocol.',
                    aiFixAvailable: true,
                });
            }
        }
        // 23. URL Structure
        if (pageUrl.length > 115 || /[A-Z]/.test(pageUrl) || pageUrl.includes('_') || /[^a-zA-Z0-9\-._/~:?#@!$&'()*+,;=]/.test(pageUrl)) {
            issues.push({
                issueType: 'URL_STRUCTURE_ISSUE',
                severity: 'LOW',
                affectedUrl: pageUrl,
                description: `URL contains uppercase letters, underscores, special characters, or exceeds 115 characters.`,
                recommendation: 'Use clean, lowercase URLs with hyphens separating words and keep path lengths concise.',
                aiFixAvailable: false,
            });
        }
        // 24. Trailing Slash Consistency
        try {
            const parsed = url.parse(pageUrl);
            if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname.endsWith('/') && !htmlData.canonicalUrl?.endsWith('/')) {
                issues.push({
                    issueType: 'TRAILING_SLASH_INCONSISTENCY',
                    severity: 'LOW',
                    affectedUrl: pageUrl,
                    description: `Page URL ends with a trailing slash but its canonical URL format is inconsistent.`,
                    recommendation: 'Standardize on either trailing slash or non-trailing slash across all internal links and canonical tags.',
                    aiFixAvailable: true,
                });
            }
        }
        catch { }
        // 25. XML Sitemap Presence
        if (!inSitemap && statusCode === 200) {
            issues.push({
                issueType: 'NOT_IN_SITEMAP',
                severity: 'MEDIUM',
                affectedUrl: pageUrl,
                description: `Page is discoverable via internal links but is missing from the website's sitemap.xml.`,
                recommendation: 'Add this URL to sitemap.xml to ensure search engines discover and recrawl it efficiently.',
                aiFixAvailable: true,
            });
        }
        // 26. Robots.txt Presence
        if (!robotsTxtExists) {
            issues.push({
                issueType: 'MISSING_ROBOTS_TXT',
                severity: 'MEDIUM',
                affectedUrl: pageUrl,
                description: `No robots.txt file was detected at the root of the domain.`,
                recommendation: 'Create a standard /robots.txt file specifying user-agent rules and sitemap locations.',
                aiFixAvailable: true,
            });
        }
        // Check Schema errors
        for (const schema of schemas) {
            if (!schema.isValid) {
                issues.push({
                    issueType: `SCHEMA_ERROR_${schema.schemaType}`,
                    severity: 'HIGH',
                    affectedUrl: pageUrl,
                    description: `Structured data error in ${schema.schemaType}: ${schema.errors.join('; ')}`,
                    recommendation: `Fix JSON-LD properties to conform with Schema.org specifications for ${schema.schemaType}.`,
                    aiFixAvailable: true,
                });
            }
        }
        // 2. Duplicate Title / Meta check against already crawled pages in job
        if (htmlData.title && statusCode === 200) {
            const dupTitle = await this.prisma.page.findFirst({
                where: { crawlJobId, title: htmlData.title, NOT: { id: pageId } },
            });
            if (dupTitle) {
                issues.push({
                    issueType: 'DUPLICATE_TITLE',
                    severity: 'HIGH',
                    affectedUrl: pageUrl,
                    description: `Title tag is duplicate of another page (${dupTitle.url}).`,
                    recommendation: 'Create unique title tags for every page to avoid keyword cannibalization.',
                    aiFixAvailable: true,
                });
            }
        }
        // Save all detected issues to Database
        for (const issue of issues) {
            try {
                await this.prisma.issue.create({
                    data: {
                        crawlJobId,
                        pageId,
                        issueType: issue.issueType,
                        severity: issue.severity,
                        affectedUrl: issue.affectedUrl,
                        description: issue.description,
                        recommendation: issue.recommendation,
                        status: 'OPEN',
                        aiFixAvailable: issue.aiFixAvailable,
                    },
                });
                await this.prisma.crawlJob.update({
                    where: { id: crawlJobId },
                    data: { issuesFound: { increment: 1 } },
                });
            }
            catch (err) {
                this.logger.error(`Failed to save issue ${issue.issueType} for ${pageUrl}`, err);
            }
        }
        return issues;
    }
};
exports.IssueEngineService = IssueEngineService;
exports.IssueEngineService = IssueEngineService = IssueEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IssueEngineService);
//# sourceMappingURL=issue-engine.service.js.map