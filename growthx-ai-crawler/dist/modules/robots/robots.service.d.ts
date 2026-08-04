export interface RobotsRules {
    allowedPaths: string[];
    disallowedPaths: string[];
    sitemapLocations: string[];
    crawlDelayMs?: number;
    rawText?: string;
    exists: boolean;
}
export declare class RobotsService {
    private readonly logger;
    private readonly ruleCache;
    private readonly cacheTTL;
    /**
     * Fetches and parses robots.txt for a given domain or URL.
     */
    fetchRobotsRules(domainOrUrl: string): Promise<RobotsRules>;
    /**
     * Evaluates whether a specific URL path is allowed to be crawled according to robots.txt rules.
     */
    isUrlAllowed(targetUrl: string, _userAgent?: string): Promise<boolean>;
    /**
     * Matches URL path against a robots.txt rule supporting wildcards (*) and end-of-string ($)
     */
    private matchPathRule;
    /**
     * Parses raw robots.txt syntax for specific User-Agent or fallback (*)
     */
    private parseRobotsText;
}
