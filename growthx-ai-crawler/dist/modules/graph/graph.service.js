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
var GraphService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let GraphService = GraphService_1 = class GraphService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(GraphService_1.name);
    }
    /**
     * Constructs the directed internal link graph and calculates BFS crawl depth, link equity, and orphan nodes.
     */
    async generateGraphReport(crawlJobId) {
        this.logger.log(`Generating internal link graph and equity analysis for Job: ${crawlJobId}`);
        // Fetch all crawled pages for this job
        const pages = await this.prisma.page.findMany({
            where: { crawlJobId },
            select: { id: true, url: true, statusCode: true },
        });
        const pageMap = new Map();
        for (const p of pages) {
            pageMap.set(p.url, { id: p.id, url: p.url, depth: 999 });
        }
        // Fetch all internal graph edges recorded during crawl
        const edges = await this.prisma.internalGraph.findMany({
            where: { crawlJobId },
            select: { sourceUrl: true, targetUrl: true, crawlDepth: true },
        });
        // Calculate in-degree and out-degree
        const inDegreeMap = new Map();
        const outDegreeMap = new Map();
        const adjacencyList = new Map();
        for (const p of pages) {
            inDegreeMap.set(p.url, 0);
            outDegreeMap.set(p.url, 0);
            adjacencyList.set(p.url, []);
        }
        for (const edge of edges) {
            if (!pageMap.has(edge.sourceUrl) || !pageMap.has(edge.targetUrl))
                continue;
            outDegreeMap.set(edge.sourceUrl, (outDegreeMap.get(edge.sourceUrl) || 0) + 1);
            inDegreeMap.set(edge.targetUrl, (inDegreeMap.get(edge.targetUrl) || 0) + 1);
            adjacencyList.get(edge.sourceUrl)?.push(edge.targetUrl);
        }
        // BFS from Homepage (depth 0) to compute exact minimal shortest-path depth
        const startPage = pages[0]; // First page is seed startUrl
        if (startPage) {
            const queue = [{ url: startPage.url, depth: 0 }];
            const visited = new Set([startPage.url]);
            const sp = pageMap.get(startPage.url);
            if (sp)
                sp.depth = 0;
            while (queue.length > 0) {
                const curr = queue.shift();
                const neighbors = adjacencyList.get(curr.url) || [];
                for (const nxt of neighbors) {
                    if (!visited.has(nxt)) {
                        visited.add(nxt);
                        const nxtObj = pageMap.get(nxt);
                        if (nxtObj)
                            nxtObj.depth = curr.depth + 1;
                        queue.push({ url: nxt, depth: curr.depth + 1 });
                    }
                }
            }
        }
        // Calculate PageRank proxy link equity scores (3 iterations of power iteration)
        const equityMap = new Map();
        const d = 0.85; // Damping factor
        const n = pages.length || 1;
        for (const p of pages) {
            equityMap.set(p.url, 1.0 / n);
        }
        for (let iter = 0; iter < 3; iter++) {
            const nextEquity = new Map();
            for (const p of pages) {
                let sumIn = 0;
                // Find all incoming links to p.url
                for (const [src, targets] of adjacencyList.entries()) {
                    if (targets.includes(p.url)) {
                        const outCount = outDegreeMap.get(src) || 1;
                        sumIn += (equityMap.get(src) || 0) / outCount;
                    }
                }
                const newScore = ((1 - d) / n) + d * sumIn;
                nextEquity.set(p.url, parseFloat((newScore * n).toFixed(4))); // Normalized to average 1.0
            }
            for (const [k, v] of nextEquity.entries()) {
                equityMap.set(k, v);
            }
        }
        const nodes = [];
        const orphanPages = [];
        const excessiveDepthPages = [];
        for (const p of pages) {
            const inDeg = inDegreeMap.get(p.url) || 0;
            const outDeg = outDegreeMap.get(p.url) || 0;
            const depth = pageMap.get(p.url)?.depth || 0;
            const equity = equityMap.get(p.url) || 1.0;
            const isOrphan = inDeg === 0 && p.url !== startPage?.url;
            const isExcessiveDepth = depth > 3;
            if (isOrphan)
                orphanPages.push(p.url);
            if (isExcessiveDepth)
                excessiveDepthPages.push(p.url);
            nodes.push({
                url: p.url,
                crawlDepth: depth,
                inDegree: inDeg,
                outDegree: outDeg,
                linkEquityScore: equity,
                isOrphan,
                isExcessiveDepth,
            });
            // Persist updated link equity and depth back to InternalGraph record
            this.prisma.internalGraph.updateMany({
                where: { crawlJobId, targetUrl: p.url },
                data: { crawlDepth: depth, linkEquityScore: equity },
            }).catch(() => { });
        }
        // Flag Orphan and Excessive Depth issues in Issue Engine
        for (const orphanUrl of orphanPages) {
            const pObj = pages.find((p) => p.url === orphanUrl);
            if (pObj) {
                await this.prisma.issue.create({
                    data: {
                        crawlJobId,
                        pageId: pObj.id,
                        issueType: 'ORPHAN_PAGE',
                        severity: 'HIGH',
                        affectedUrl: orphanUrl,
                        description: 'Page has zero incoming internal links. It cannot be reached by users navigating the site.',
                        recommendation: 'Add relevant contextual internal links from high-authority category or blog pages to this URL.',
                        status: 'OPEN',
                        aiFixAvailable: true,
                    },
                }).catch(() => { });
            }
        }
        for (const deepUrl of excessiveDepthPages) {
            const pObj = pages.find((p) => p.url === deepUrl);
            if (pObj) {
                await this.prisma.issue.create({
                    data: {
                        crawlJobId,
                        pageId: pObj.id,
                        issueType: 'EXCESSIVE_CRAWL_DEPTH',
                        severity: 'MEDIUM',
                        affectedUrl: deepUrl,
                        description: `Page requires more than 3 clicks from the homepage to reach (Depth: ${pageMap.get(deepUrl)?.depth}).`,
                        recommendation: 'Flatten site architecture by adding direct category links or prominent navigation menu items.',
                        status: 'OPEN',
                        aiFixAvailable: true,
                    },
                }).catch(() => { });
            }
        }
        return {
            jobId: crawlJobId,
            totalNodes: nodes.length,
            totalEdges: edges.length,
            orphanPages,
            excessiveDepthPages,
            nodes,
        };
    }
};
exports.GraphService = GraphService;
exports.GraphService = GraphService = GraphService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GraphService);
//# sourceMappingURL=graph.service.js.map