import { NextRequest, NextResponse } from "next/server";

const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[::1\])/i;

function parseSafePublicUrl(raw: string): URL | null {
  try {
    const trimmed = raw.trim();
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (!host.includes(".") || PRIVATE_HOST_RE.test(host) || host.endsWith(".local") || host.endsWith(".internal")) {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractFirstTagText(html: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = html.match(re);
  if (!m?.[1]) return null;
  const text = stripHtmlTags(m[1]);
  return text || null;
}

function countMissingAltImages(html: string): number {
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  let missing = 0;
  for (const tag of imgs) {
    const altMatch = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const altVal = (altMatch?.[1] ?? altMatch?.[2] ?? "").trim();
    if (!altVal) missing++;
  }
  return missing;
}

/**
 * Strips executable scripts and event handlers, injects `<base href>` so all
 * remote CSS/fonts/images resolve natively, and returns clean sandbox-safe HTML.
 */
function sanitizeForVisualPreview(rawHtml: string, baseOrigin: string): string {
  let html = rawHtml
    // Ensure deferred font/CSS stylesheets (media="print" onload="this.media='all'") stay active without JS
    .replace(/(<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*)\bmedia\s*=\s*["']print["']/gi, '$1media="all"')
    // Remove script tags and inline event handlers
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Remove CSP / X-Frame meta tags that could interfere with srcDoc
    .replace(/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, "")
    // Remove existing base tags so ours takes precedence
    .replace(/<base\b[^>]*>/gi, "");

  const baseTag = `<base href="${baseOrigin}/" target="_blank" />`;
  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${baseTag}`);
  } else {
    html = `<!doctype html><html><head>${baseTag}</head><body>${html}</body></html>`;
  }
  return html;
}

function isFrameBlockedByHeaders(headers: Headers): boolean {
  const xfo = (headers.get("x-frame-options") || "").toUpperCase();
  if (xfo.includes("DENY") || xfo.includes("SAMEORIGIN")) return true;
  const csp = (headers.get("content-security-policy") || "").toLowerCase();
  const faMatch = csp.match(/frame-ancestors\s+([^;]+)/);
  if (faMatch) {
    const val = faMatch[1].trim();
    if (val === "'none'" || val === "'self'" || (!val.includes("*") && !val.includes("reigel.in"))) {
      return true;
    }
  }
  return false;
}

function detectClientSideSpa(rawHtml: string, sanitizedHtml: string): boolean {
  const bodyMatch = sanitizedHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch?.[1] || "";
  const bodyTextLen = stripHtmlTags(bodyHtml).length;
  if (bodyTextLen < 120) return true;

  // Detect Vite / React / Vue / Angular SPA shells that only contain a bare fallback list inside #root/#app
  const hasSpaRoot = /<div\b[^>]*id\s*=\s*["'](root|app|__nuxt)["'][^>]*>/i.test(rawHtml);
  const hasModuleScript = /<script\b[^>]*type\s*=\s*["']module["'][^>]*>/i.test(rawHtml);
  const hasVisualLayout = /<(img|picture|svg|header|nav|section|footer)\b/i.test(bodyHtml);
  if (hasSpaRoot && hasModuleScript && !hasVisualLayout) return true;

  return false;
}

export async function GET(req: NextRequest) {
  const targetUrl = parseSafePublicUrl(req.nextUrl.searchParams.get("url") || "");
  if (!targetUrl) {
    return NextResponse.json({ error: "A valid public http(s) URL is required." }, { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Website returned HTTP ${upstream.status}. Could not load live preview.` },
        { status: 502 },
      );
    }

    const rawHtml = (await upstream.text()).slice(0, 1_200_000);
    const finalUrl = upstream.url || targetUrl.toString();
    const origin = new URL(finalUrl).origin;
    const canEmbedLive = !isFrameBlockedByHeaders(upstream.headers);

    let sanitizedHtml = sanitizeForVisualPreview(rawHtml, origin);
    let isJsShell = detectClientSideSpa(rawHtml, sanitizedHtml);
    let renderSource: "ssr-html" | "playwright" | "live-iframe" = isJsShell
      ? canEmbedLive
        ? "live-iframe"
        : "ssr-html"
      : "ssr-html";

    // If client-side SPA, try backend Playwright renderer first for a 100% rendered DOM snapshot
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "https://api.reigel.in").replace(/\/+$/, "");
    if (isJsShell && apiBase) {
      try {
        const snapRes = await fetch(
          `${apiBase}/api/crawl/render-snapshot?url=${encodeURIComponent(finalUrl)}`,
          {
            headers: {
              ...(req.headers.get("authorization")
                ? { authorization: req.headers.get("authorization")! }
                : {}),
              ...(req.headers.get("cookie") ? { cookie: req.headers.get("cookie")! } : {}),
            },
            cache: "no-store",
            signal: AbortSignal.timeout(9000),
          },
        );
        if (snapRes.ok) {
          const snapData = (await snapRes.json()) as { html?: string };
          if (snapData?.html && snapData.html.length > 500) {
            sanitizedHtml = sanitizeForVisualPreview(snapData.html, origin);
            isJsShell = false;
            renderSource = "playwright";
          }
        }
      } catch {
        // Backend Playwright snapshot unavailable — seamlessly fall back to live iframe embedding
      }
    }

    const originalTitle = extractFirstTagText(sanitizedHtml, "title");
    const originalH1 = extractFirstTagText(sanitizedHtml, "h1");
    const originalParagraph = extractFirstTagText(sanitizedHtml, "p");
    const missingAltCount = countMissingAltImages(sanitizedHtml);

    return NextResponse.json(
      {
        url: finalUrl,
        origin,
        originalTitle,
        originalH1,
        originalParagraph,
        missingAltCount,
        isJsShell,
        canEmbedLive,
        renderSource,
        sanitizedHtml,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch website for visual preview." },
      { status: 502 },
    );
  }
}
