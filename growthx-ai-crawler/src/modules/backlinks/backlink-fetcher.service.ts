import { Injectable } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";
import { publicAxios } from "../security/ssrf";
import {
  isAllowedByRobots,
  parseRobotsTxt,
  selectGroup,
} from "../crawler/discovery/robots-txt";
import { linkUrl } from "./backlink-evidence";

export type SourceFetch = {
  outcome: "READ" | "ABSENT" | "BLOCKED" | "UNKNOWN";
  statusCode?: number;
  finalUrl?: string;
  html?: string;
  reason: string;
  pageNofollow?: boolean;
};
const TOKEN = "GrowthXBacklinkBot";
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

@Injectable()
export class BacklinkFetcher {
  constructor(private readonly queue: QueueService) {}

  /** A shared host gate applies to robots, page requests and redirect hops. */
  private async request(
    url: string,
    deadline: number,
    delay = 1500,
    robots = false,
  ) {
    const redis = this.queue.getRedisClient();
    if (!redis)
      throw new Error(
        "Backlink verification needs Redis for shared host pacing.",
      );
    const key = `backlinks:host:${new URL(url).host}`;
    while (Date.now() < deadline) {
      if (await redis.set(key, "1", "PX", Math.max(1500, delay), "NX")) {
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          Math.max(1, Math.min(8000, deadline - Date.now())),
        );
        timer.unref?.();
        try {
          return await publicAxios.get<string>(url, {
            signal: controller.signal,
            maxRedirects: 0,
            timeout: Math.max(1, Math.min(8000, deadline - Date.now())),
            maxContentLength: robots ? 512_000 : 2_000_000,
            maxBodyLength: 2_000_000,
            responseType: "text",
            proxy: false,
            headers: {
              "User-Agent": `${TOKEN}/1.0`,
              Accept: robots ? "text/plain" : "text/html,application/xhtml+xml",
            },
            validateStatus: () => true,
          });
        } finally {
          clearTimeout(timer);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(
      "Host pacing or request time budget exhausted; will retry later.",
    );
  }

  private async permission(
    url: string,
    deadline: number,
  ): Promise<{ allowed: boolean; reason: string; delay: number }> {
    const origin = new URL(url).origin;
    let robotsUrl = `${origin}/robots.txt`;
    for (let hop = 0; hop < 4; hop++) {
      const response = await this.request(robotsUrl, deadline, 1500, true);
      if (REDIRECTS.has(response.status)) {
        const next = linkUrl(
          String(response.headers.location ?? ""),
          robotsUrl,
        );
        if (new URL(next).origin !== origin)
          throw new Error(
            "Cross-origin robots redirect could not be verified.",
          );
        robotsUrl = next;
        continue;
      }
      if (response.status === 404 || response.status === 410)
        return {
          allowed: true,
          reason: "No robots.txt published.",
          delay: 1500,
        };
      if ([401, 403].includes(response.status))
        return {
          allowed: false,
          reason: "robots.txt access refused.",
          delay: 1500,
        };
      if (response.status !== 200 || /<html[\s>]/i.test(response.data))
        throw new Error("Could not obtain a readable robots.txt.");
      const parsed = parseRobotsTxt(response.data);
      const decision = isAllowedByRobots(parsed, TOKEN, url);
      const delay = selectGroup(parsed, TOKEN)?.crawlDelayMs ?? 1500;
      if (delay > 15_000)
        throw new Error(
          "Published crawl delay exceeds this verification time budget.",
        );
      if (delay > 1500)
        await this.queue
          .getRedisClient()!
          .pexpire(`backlinks:host:${new URL(url).host}`, delay);
      return {
        ...decision,
        reason: decision.evidence,
        delay: Math.max(1500, delay),
      };
    }
    throw new Error("Too many robots.txt redirects.");
  }

  async fetch(sourceUrl: string): Promise<SourceFetch> {
    let url = sourceUrl;
    const deadline = Date.now() + 25_000;
    const permissions = new Map<
      string,
      Awaited<ReturnType<BacklinkFetcher["permission"]>>
    >();
    try {
      for (let hop = 0; hop < 5; hop++) {
        url = linkUrl(url);
        // Evaluate path rules again on every hop, even on the same origin.
        const permission =
          permissions.get(url) ?? (await this.permission(url, deadline));
        permissions.set(url, permission);
        if (!permission.allowed)
          return {
            outcome: "BLOCKED",
            finalUrl: url,
            reason: permission.reason,
          };
        const response = await this.request(url, deadline, permission.delay);
        if (REDIRECTS.has(response.status)) {
          if (!response.headers.location)
            throw new Error("Redirect has no destination.");
          url = linkUrl(String(response.headers.location), url);
          continue;
        }
        const common = { statusCode: response.status, finalUrl: url };
        if ([401, 403, 429].includes(response.status))
          return {
            ...common,
            outcome: "BLOCKED",
            reason: `Source refused access (HTTP ${response.status}).`,
          };
        if ([404, 410].includes(response.status))
          return {
            ...common,
            outcome: "ABSENT",
            reason: `Source page returned HTTP ${response.status}.`,
          };
        if (response.status !== 200)
          return {
            ...common,
            outcome: "UNKNOWN",
            reason: `Source returned HTTP ${response.status}; link presence is unknown.`,
          };
        const html = String(response.data);
        const type = String(response.headers["content-type"] ?? "");
        if (
          !/text\/html|application\/xhtml\+xml/i.test(type) ||
          html.length < 80 ||
          /cf-chl-|captcha|verify you are human|checking your browser|just a moment\.\.\./i.test(
            html,
          ) ||
          (!/<a\b/i.test(html) && /<script\b/i.test(html))
        ) {
          return {
            ...common,
            outcome: "UNKNOWN",
            reason:
              "Response may be incomplete, require JavaScript, or contain an access challenge.",
          };
        }
        return {
          ...common,
          outcome: "READ",
          html,
          pageNofollow: /(?:^|[\s,:])(nofollow|none)(?:$|[\s,])/i.test(
            String(response.headers["x-robots-tag"] ?? ""),
          ),
          reason:
            "Successfully inspected source HTML; JavaScript was not executed.",
        };
      }
      return {
        outcome: "UNKNOWN",
        finalUrl: url,
        reason: "Redirect limit reached.",
      };
    } catch (error) {
      return {
        outcome: "UNKNOWN",
        finalUrl: url,
        reason:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Fetch failed; link presence is unknown.",
      };
    }
  }
}
