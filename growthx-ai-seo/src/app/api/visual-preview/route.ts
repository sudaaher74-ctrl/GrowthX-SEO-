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
    const sanitizedHtml = sanitizeForVisualPreview(rawHtml, origin);

    const originalTitle = extractFirstTagText(sanitizedHtml, "title");
    const originalH1 = extractFirstTagText(sanitizedHtml, "h1");
    const originalParagraph = extractFirstTagText(sanitizedHtml, "p");
    const missingAltCount = countMissingAltImages(sanitizedHtml);

    // Detect if the raw HTML is an unhydrated JS shell (very little visible body text)
    const bodyMatch = sanitizedHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    const bodyTextLen = bodyMatch ? stripHtmlTags(bodyMatch[1]).length : 0;
    const isJsShell = bodyTextLen < 120;

    return NextResponse.json(
      {
        url: finalUrl,
        origin,
        originalTitle,
        originalH1,
        originalParagraph,
        missingAltCount,
        isJsShell,
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
