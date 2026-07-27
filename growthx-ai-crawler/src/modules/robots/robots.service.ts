import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as url from 'url';

export interface RobotsRules {
  allowedPaths: string[];
  disallowedPaths: string[];
  sitemapLocations: string[];
  crawlDelayMs?: number;
  rawText?: string;
  exists: boolean;
}

@Injectable()
export class RobotsService {
  private readonly logger = new Logger(RobotsService.name);
  private readonly ruleCache = new Map<string, { rules: RobotsRules; fetchedAt: number }>();
  private readonly cacheTTL = 3600 * 1000; // 1 hour

  /**
   * Fetches and parses robots.txt for a given domain or URL.
   */
  async fetchRobotsRules(domainOrUrl: string): Promise<RobotsRules> {
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

    const rules: RobotsRules = {
      allowedPaths: [],
      disallowedPaths: [],
      sitemapLocations: [],
      exists: false,
    };

    try {
      this.logger.log(`Fetching robots.txt from: ${robotsUrl}`);
      const response = await axios.get(robotsUrl, {
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
      } else {
        this.logger.log(`No robots.txt found at ${robotsUrl} (HTTP ${response.status}). All paths allowed.`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to fetch robots.txt from ${robotsUrl}: ${error.message}. Defaulting to allow all.`);
    }

    this.ruleCache.set(domain, { rules, fetchedAt: Date.now() });
    return rules;
  }

  /**
   * Evaluates whether a specific URL path is allowed to be crawled according to robots.txt rules.
   */
  async isUrlAllowed(targetUrl: string, userAgent: string = 'GrowthX-AI-Bot'): Promise<boolean> {
    try {
      const parsed = url.parse(targetUrl);
      const domain = `${parsed.protocol}//${parsed.host}`;
      const path = parsed.path || '/';

      const rules = await this.fetchRobotsRules(domain);
      if (!rules.exists) return true;

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
    } catch (err) {
      this.logger.error(`Error checking robots.txt rules for ${targetUrl}`, err);
      return true; // Fail open
    }
  }

  /**
   * Matches URL path against a robots.txt rule supporting wildcards (*) and end-of-string ($)
   */
  private matchPathRule(urlPath: string, rule: string): boolean {
    if (!rule || rule === '') return false;
    if (rule === '/') return true;

    // Convert robots rule wildcard to regex
    let regexStr = '^' + rule.replace(/\./g, '\\.').replace(/\*/g, '.*');
    if (rule.endsWith('$')) {
      regexStr = regexStr.slice(0, -1) + '$';
    }
    try {
      const regex = new RegExp(regexStr);
      return regex.test(urlPath);
    } catch (e) {
      return urlPath.startsWith(rule);
    }
  }

  /**
   * Parses raw robots.txt syntax for specific User-Agent or fallback (*)
   */
  private parseRobotsText(text: string, rules: RobotsRules, targetUserAgent: string): void {
    const lines = text.split(/\r?\n/);
    let isApplicableAgent = false;
    let isGlobalAgent = false;

    for (let line of lines) {
      line = line.split('#')[0].trim();
      if (!line) continue;

      const [key, ...valueParts] = line.split(':');
      if (!key || valueParts.length === 0) continue;

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
          if (!rules.disallowedPaths.includes(val)) rules.disallowedPaths.push(val);
        } else if (directive === 'allow' && val) {
          if (!rules.allowedPaths.includes(val)) rules.allowedPaths.push(val);
        } else if (directive === 'crawl-delay') {
          const delaySec = parseFloat(val);
          if (!isNaN(delaySec) && delaySec > 0) {
            rules.crawlDelayMs = Math.round(delaySec * 1000);
          }
        }
      }
    }
  }
}
