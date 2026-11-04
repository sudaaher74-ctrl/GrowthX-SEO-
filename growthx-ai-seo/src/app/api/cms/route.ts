import { NextRequest, NextResponse } from "next/server";

function normalizeSiteUrl(rawUrl: string): string {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("WordPress site URL is required.");
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid WordPress site URL.");
  }
  const cleanPath = parsed.pathname
    .replace(/\/wp-admin(\/.*)?$/i, "")
    .replace(/\/wp-login\.php$/i, "")
    .replace(/\/+$/, "");
  return `${parsed.origin}${cleanPath}`;
}

function buildBasicAuth(username: string, appPassword: string): string {
  const token = Buffer.from(`${username.trim()}:${appPassword.trim()}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action as string;

    if (action === "connect-wordpress") {
      const siteUrl = normalizeSiteUrl(body.siteUrl);
      const username = String(body.username || "").trim();
      const appPassword = String(body.appPassword || "").trim();

      if (!username || !appPassword) {
        return NextResponse.json(
          { message: "WordPress username and Application Password are required." },
          { status: 400 },
        );
      }

      const authHeader = buildBasicAuth(username, appPassword);
      const userRes = await fetch(`${siteUrl}/wp-json/wp/v2/users/me?context=edit`, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
          "User-Agent": "Reigel-SEO-Agent/1.0",
        },
        cache: "no-store",
      });

      if (userRes.status === 401 || userRes.status === 403) {
        return NextResponse.json(
          {
            message:
              "WordPress rejected the username or Application Password. Generate an Application Password under WordPress Admin → Users → Profile.",
          },
          { status: 400 },
        );
      }
      if (!userRes.ok) {
        return NextResponse.json(
          {
            message: `WordPress REST API returned HTTP ${userRes.status}. Ensure /wp-json is enabled on your site.`,
          },
          { status: 400 },
        );
      }

      const wpUser = (await userRes.json()) as { name?: string };
      let detectedPlugin = body.seoPlugin || "core";
      if (!body.seoPlugin) {
        try {
          const rootRes = await fetch(`${siteUrl}/wp-json`, {
            headers: { Accept: "application/json", "User-Agent": "Reigel-SEO-Agent/1.0" },
            cache: "no-store",
          });
          if (rootRes.ok) {
            const rootData = (await rootRes.json()) as { namespaces?: string[] };
            const ns = Array.isArray(rootData?.namespaces) ? rootData.namespaces : [];
            if (ns.some((n) => n.startsWith("yoast/"))) detectedPlugin = "yoast";
            else if (ns.some((n) => n.startsWith("rankmath/"))) detectedPlugin = "rankmath";
            else if (ns.some((n) => n.startsWith("aioseo/"))) detectedPlugin = "aioseo";
          }
        } catch {
          // non-fatal
        }
      }

      return NextResponse.json({
        connected: true,
        siteUrl,
        username,
        displayName: wpUser?.name ? `${wpUser.name} (${username})` : username,
        seoPlugin: detectedPlugin,
        status: "CONNECTED",
        lastSyncedAt: new Date().toISOString(),
      });
    }

    if (action === "verify-manual") {
      const targetUrl = String(body.targetUrl || "").trim();
      const expected = String(body.expectedAfterValue || "").trim();
      const field = String(body.field || "META_TITLE");

      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        return NextResponse.json(
          { message: "A valid page URL (https://...) is required to verify live HTML." },
          { status: 400 },
        );
      }
      if (!expected) {
        return NextResponse.json(
          { message: "Expected updated text or snippet is required for verification." },
          { status: 400 },
        );
      }

      const pageRes = await fetch(targetUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Reigel-SEO-Verifier/1.0",
        },
        cache: "no-store",
      });

      if (!pageRes.ok) {
        return NextResponse.json(
          { message: `Live page returned HTTP ${pageRes.status} when checking ${targetUrl}.` },
          { status: 400 },
        );
      }

      const html = await pageRes.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const liveTitle = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
      const liveDescription = descMatch ? descMatch[1].replace(/\s+/g, " ").trim() : "";

      const normalizedHtml = html.replace(/\s+/g, " ").toLowerCase();
      const normalizedExpected = expected.replace(/\s+/g, " ").trim().toLowerCase();

      let verified = false;
      let detectedLiveValue = "";

      if (field === "META_TITLE") {
        detectedLiveValue = liveTitle;
        verified =
          liveTitle.toLowerCase().includes(normalizedExpected) ||
          normalizedHtml.includes(normalizedExpected);
      } else if (field === "META_DESCRIPTION") {
        detectedLiveValue = liveDescription;
        verified =
          liveDescription.toLowerCase().includes(normalizedExpected) ||
          normalizedHtml.includes(normalizedExpected);
      } else {
        detectedLiveValue = normalizedHtml.includes(normalizedExpected) ? expected : liveTitle || "Live HTML";
        verified = normalizedHtml.includes(normalizedExpected);
      }

      return NextResponse.json({
        verified,
        runId: `cms-${Date.now()}`,
        targetUrl,
        detectedLiveValue,
        message: verified
          ? "Confirmed live on your website! Recorded in the Impact Ledger and 30d/90d Proof."
          : "Recorded in your log. Live HTML still shows the previous version (clear your WordPress/Cloudflare cache and click Verify again).",
      });
    }

    return NextResponse.json({ message: "Unsupported CMS action." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || "CMS request failed." },
      { status: 400 },
    );
  }
}
