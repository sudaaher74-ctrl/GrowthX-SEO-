"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RobotsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobotsService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const url = require("url");
let RobotsService = RobotsService_1 = class RobotsService {
    constructor() {
        this.logger = new common_1.Logger(RobotsService_1.name);
        this.ruleCache = new Map();
        this.cacheTTL = 3600 * 1000; // 1 hour
    }
    /**
     * Fetches and parses robots.txt for a given domain or URL.
     */
    async fetchRobotsRules(domainOrUrl) {
        let baseUrl = domainOrUrl.trim();
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrl = `https://${baseUrl}`;
        }
        const parsedUrl = url.parse(baseUrl);
        const domain = `${parsedUrl.protocol}//${parsedUrl.host}`;
        const robotsUrl = `${domain}/robots.txt`;
        // Check cache
        const cached = this.ruleCache.get(domain);
        if (cached && Date.now() - cached.fetchedAt < this.cacheTTL) {
            return cached.rules;
        }
        const rules = {
            allowedPaths: [],
            disallowedPaths: [],
            sitemapLocations: [],
            exists: false,
        };
        try {
            this.logger.log(`Fetching robots.txt from: ${robotsUrl}`);
            const response = await axios_1.default.get(robotsUrl, {
                timeout: 5000,
                validateStatus: (status) => status === 200 || status === 404,
                headers: {
                    'User-Agent': process.env.USER_AGENT || 'GrowthX-AI-Bot/1.0 (+https://growthx.ai/bot)',
                },
            });
            if (response.status === 200 && typeof response.data === 'string') {
                rules.exists = true;
                rules.rawText = response.data;
                this.parseRobotsText(response.data, rules, process.env.USER_AGENT || 'GrowthX-AI-Bot');
            }
            else {
                this.logger.log(`No robots.txt found at ${robotsUrl} (HTTP ${response.status}). All paths allowed.`);
            }
        }
        catch (error) {
            this.logger.warn(`Failed to fetch robots.txt from ${robotsUrl}: ${error.message}. Defaulting to allow all.`);
        }
        this.ruleCache.set(domain, { rules, fetchedAt: Date.now() });
        return rules;
    }
    /**
     * Evaluates whether a specific URL path is allowed to be crawled according to robots.txt rules.
     */
    async isUrlAllowed(targetUrl, _userAgent = 'GrowthX-AI-Bot') {
        try {
            const parsed = url.parse(targetUrl);
            const domain = `${parsed.protocol}//${parsed.host}`;
            const path = parsed.path || '/';
            const rules = await this.fetchRobotsRules(domain);
            if (!rules.exists)
                return true;
            // Check disallowed rules first
            for (const disallowed of rules.disallowedPaths) {
                if (this.matchPathRule(path, disallowed)) {
                    // Check if there is a more specific allow rule
                    for (const allowed of rules.allowedPaths) {
                        if (this.matchPathRule(path, allowed) && allowed.length >= disallowed.length) {
                            return true;
                        }
                    }
                    this.logger.debug(`URL blocked by robots.txt rule [Disallow: ${disallowed}]: ${targetUrl}`);
                    return false;
                }
            }
            return true;
        }
        catch (err) {
            this.logger.error(`Error checking robots.txt rules for ${targetUrl}`, err);
            return true; // Fail open
        }
    }
    /**
     * Matches URL path against a robots.txt rule supporting wildcards (*) and end-of-string ($)
     */
    matchPathRule(urlPath, rule) {
        if (!rule || rule === '')
            return false;
        if (rule === '/')
            return true;
        // Convert robots rule wildcard to regex
        let regexStr = '^' + rule.replace(/\./g, '\\.').replace(/\*/g, '.*');
        if (rule.endsWith('$')) {
            regexStr = regexStr.slice(0, -1) + '$';
        }
        try {
            const regex = new RegExp(regexStr);
            return regex.test(urlPath);
        }
        catch {
            return urlPath.startsWith(rule);
        }
    }
    /**
     * Parses raw robots.txt syntax for specific User-Agent or fallback (*)
     */
    parseRobotsText(text, rules, targetUserAgent) {
        const lines = text.split(/\r?\n/);
        let isApplicableAgent = false;
        let isGlobalAgent = false;
        for (let line of lines) {
            line = line.split('#')[0].trim();
            if (!line)
                continue;
            const [key, ...valueParts] = line.split(':');
            if (!key || valueParts.length === 0)
                continue;
            const directive = key.trim().toLowerCase();
            const val = valueParts.join(':').trim();
            if (directive === 'sitemap') {
                if (val && !rules.sitemapLocations.includes(val)) {
                    rules.sitemapLocations.push(val);
                }
                continue;
            }
            if (directive === 'user-agent') {
                const agent = val.toLowerCase();
                isApplicableAgent = agent === targetUserAgent.toLowerCase() || targetUserAgent.toLowerCase().includes(agent);
                isGlobalAgent = agent === '*';
                continue;
            }
            if (isApplicableAgent || isGlobalAgent) {
                if (directive === 'disallow' && val) {
                    if (!rules.disallowedPaths.includes(val))
                        rules.disallowedPaths.push(val);
                }
                else if (directive === 'allow' && val) {
                    if (!rules.allowedPaths.includes(val))
                        rules.allowedPaths.push(val);
                }
                else if (directive === 'crawl-delay') {
                    const delaySec = parseFloat(val);
                    if (!isNaN(delaySec) && delaySec > 0) {
                        rules.crawlDelayMs = Math.round(delaySec * 1000);
                    }
                }
            }
        }
    }
};
exports.RobotsService = RobotsService;
exports.RobotsService = RobotsService = RobotsService_1 = __decorate([
    (0, common_1.Injectable)()
], RobotsService);
//# sourceMappingURL=robots.service.js.map