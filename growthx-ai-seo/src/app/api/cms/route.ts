import * as crypto from "node:crypto";
import * as dns from "node:dns/promises";
import * as net from "node:net";
import { NextRequest, NextResponse } from "next/server";

function getVaultKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "reigel-cms-vault-key-v1";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptCmsVault(payload: Record<string, unknown>): string {
  const key = getVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptCmsVault<T = Record<string, any>>(token: string): T {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Reconnect your CMS platform in Settings to refresh credentials.");
  }
  const key = getVaultKey();
  const iv = Buffer.from(parts[0], "base64url");
  const tag = Buffer.from(parts[1], "base64url");
  const encrypted = Buffer.from(parts[2], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted) as T;
}

function sanitizeJsonLdPayload(raw: string): string {
  const trimmed = raw
    .trim()
    .replace(/^<script[^>]*>/i, "")
    .replace(/<\/script>$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");
  } catch {
    return trimmed
      .replace(/<\/script/gi, "<\\/script")
      .replace(/<!--/g, "\\u003c!--");
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function isPrivateV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return PRIVATE_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

function ipv6Groups(ip: string): number[] {
  let address = ip.toLowerCase().split("%")[0];
  const v4Tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (v4Tail) {
    const n = ipv4ToInt(v4Tail[1]);
    address =
      address.slice(0, -v4Tail[1].length) +
      `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const fill = address.includes("::") ? 8 - left.length - right.length : 0;
  return [...left, ...Array(Math.max(0, fill)).fill("0"), ...right].map((g) =>
    parseInt(g || "0", 16),
  );
}

function isPrivateV6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (g.length !== 8) return true;
  const embeddedV4 = () =>
    `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
  if (g.every((x) => x === 0)) return true;
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true;
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff)
    return isPrivateV4(embeddedV4());
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0))
    return isPrivateV4(embeddedV4());
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  if ((g[0] & 0xffc0) === 0xfe80) return true;
  if ((g[0] & 0xff00) === 0xff00) return true;
  return false;
}

function isPrivateIpAddress(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "");
  const family = net.isIP(bare);
  if (family === 4) return isPrivateV4(bare);
  if (family === 6) return isPrivateV6(bare);
  return false;
}

const INTERNAL_HOST_PATTERN =
  /^(localhost|localhost\.localdomain|ip6-localhost|ip6-loopback|metadata\.google\.internal)$|\.(localhost|local|internal|intranet|lan|home\.arpa)$/i;

async function assertPublicOutboundUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid public URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are permitted.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Credentials embedded in URLs are not permitted.");
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host || INTERNAL_HOST_PATTERN.test(host)) {
    throw new Error(`Refusing to connect to an internal or reserved host: ${host || "empty"}`);
  }

  if (net.isIP(host)) {
    if (isPrivateIpAddress(host)) {
      throw new Error(`Refusing to connect to a private or reserved IP address: ${host}`);
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (records.some((r) => isPrivateIpAddress(r.address))) {
      throw new Error(`Refusing to connect to an internal or reserved address for ${host}`);
    }
  } catch (err: any) {
    if (err?.message?.startsWith("Refusing to connect")) {
      throw err;
    }
  }

  return parsed;
}

async function safeCmsFetch(
  targetUrl: string,
  init: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  let currentUrl = targetUrl;
  const initialOrigin = (await assertPublicOutboundUrl(currentUrl)).origin;
  const maxRedirects = 3;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const currentParsed =
      hop === 0 ? new URL(currentUrl) : await assertPublicOutboundUrl(currentUrl);
    const headers = new Headers(init.headers ?? {});
    if (currentParsed.origin !== initialOrigin) {
      headers.delete("Authorization");
    }

    const res = await fetch(currentUrl, {
      ...init,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      if (hop === maxRedirects) {
        throw new Error("Too many redirects from target site.");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return res;
  }

  throw new Error("Too many redirects from target site.");
}

function assertSameOriginRequest(req: NextRequest): void {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    throw new Error("Cross-site requests are not permitted.");
  }
  const origin = req.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      throw new Error("Invalid request origin.");
    }
    const reqHost = (
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      req.nextUrl.host ||
      ""
    )
      .split(",")[0]
      .trim()
      .toLowerCase();
    if (reqHost && originHost !== reqHost) {
      throw new Error("Cross-origin requests are not permitted.");
    }
  }
}

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
    assertSameOriginRequest(req);
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
      const userRes = await safeCmsFetch(`${siteUrl}/wp-json/wp/v2/users/me?context=edit`, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
          "User-Agent": "Reigel-SEO-Agent/1.0",
        },
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
          const rootRes = await safeCmsFetch(`${siteUrl}/wp-json`, {
            headers: { Accept: "application/json", "User-Agent": "Reigel-SEO-Agent/1.0" },
          }, 10000);
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
        vaultToken: encryptCmsVault({
          siteUrl,
          username,
          appPassword,
          seoPlugin: detectedPlugin,
        }),
      });
    }

    if (action === "connect-shopify") {
      const rawDomain = String(body.shopDomain || "")
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "");
      const accessToken = String(body.accessToken || "").trim();

      if (!rawDomain || !accessToken) {
        return NextResponse.json(
          { message: "Shopify store domain and Admin API access token are required." },
          { status: 400 },
        );
      }

      const shopOrigin = normalizeSiteUrl(`https://${rawDomain}`);
      const shopRes = await safeCmsFetch(`${shopOrigin}/admin/api/2024-10/shop.json`, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          Accept: "application/json",
          "User-Agent": "Reigel-SEO-Agent/1.0",
        },
      });

      if (shopRes.status === 401 || shopRes.status === 403) {
        return NextResponse.json(
          {
            message:
              "Shopify rejected the Admin API access token. Ensure the token has read_products, write_products, read_content, and write_content scopes.",
          },
          { status: 400 },
        );
      }
      if (!shopRes.ok) {
        return NextResponse.json(
          { message: `Shopify Admin API returned HTTP ${shopRes.status}.` },
          { status: 400 },
        );
      }

      const shopData = (await shopRes.json()) as { shop?: { name?: string } };
      return NextResponse.json({
        connected: true,
        shopDomain: shopOrigin,
        shopName: shopData?.shop?.name || rawDomain,
        status: "CONNECTED",
        lastSyncedAt: new Date().toISOString(),
        vaultToken: encryptCmsVault({
          shopDomain: shopOrigin,
          accessToken,
        }),
      });
    }

    if (action === "connect-webflow") {
      const siteId = String(body.siteId || "").trim();
      const apiToken = String(body.apiToken || "").trim();
      const siteUrl = body.siteUrl ? normalizeSiteUrl(String(body.siteUrl)) : "";

      if (!siteId || !apiToken) {
        return NextResponse.json(
          { message: "Webflow Site ID and Data API v2 Token are required." },
          { status: 400 },
        );
      }

      const wfRes = await safeCmsFetch(
        `https://api.webflow.com/v2/sites/${encodeURIComponent(siteId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            Accept: "application/json",
            "User-Agent": "Reigel-SEO-Agent/1.0",
          },
        },
      );

      if (wfRes.status === 401 || wfRes.status === 403) {
        return NextResponse.json(
          {
            message:
              "Webflow rejected the API token or Site ID. Ensure the token has pages:read and pages:write scopes.",
          },
          { status: 400 },
        );
      }
      if (!wfRes.ok) {
        return NextResponse.json(
          { message: `Webflow API returned HTTP ${wfRes.status} for Site ID ${siteId}.` },
          { status: 400 },
        );
      }

      const wfSite = (await wfRes.json()) as {
        displayName?: string;
        shortName?: string;
        customDomains?: Array<{ url?: string }>;
      };
      const resolvedSiteUrl =
        siteUrl ||
        wfSite?.customDomains?.[0]?.url ||
        `https://${wfSite?.shortName || siteId}.webflow.io`;
      return NextResponse.json({
        connected: true,
        siteId,
        siteName: wfSite?.displayName || wfSite?.shortName || siteId,
        siteUrl: resolvedSiteUrl,
        status: "CONNECTED",
        lastSyncedAt: new Date().toISOString(),
        vaultToken: encryptCmsVault({
          siteId,
          apiToken,
          siteUrl: resolvedSiteUrl,
        }),
      });
    }

    if (action === "apply-wordpress") {
      const creds = decryptCmsVault<{
        siteUrl: string;
        username: string;
        appPassword: string;
        seoPlugin?: string;
      }>(body.vaultToken);
      const authHeader = buildBasicAuth(creds.username, creds.appPassword);
      const targetUrl = String(body.targetUrl || "").trim();
      const field = String(body.field || "META_TITLE");
      const afterValue = String(body.afterValue || "").trim();
      const publishMode = body.publishMode === "publish" ? "publish" : "draft";

      let slug = "";
      try {
        const parsed = new URL(targetUrl);
        slug = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
      } catch {
        slug = "";
      }

      let wpItem: { id: number; restBase: "pages" | "posts"; contentRaw?: string } | null = null;
      for (const restBase of ["pages", "posts"] as const) {
        const endpoint = slug
          ? `${creds.siteUrl}/wp-json/wp/v2/${restBase}?slug=${encodeURIComponent(slug)}&context=edit&per_page=1`
          : `${creds.siteUrl}/wp-json/wp/v2/${restBase}?context=edit&per_page=1`;
        const res = await safeCmsFetch(endpoint, {
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
            "User-Agent": "Reigel-SEO-Agent/1.0",
          },
        });
        if (res.ok) {
          const items = (await res.json()) as Array<{ id: number; content?: { raw?: string; rendered?: string } }>;
          if (Array.isArray(items) && items.length > 0) {
            wpItem = {
              id: items[0].id,
              restBase,
              contentRaw: items[0].content?.raw || items[0].content?.rendered || "",
            };
            break;
          }
        }
      }

      if (!wpItem) {
        return NextResponse.json(
          { message: `Could not locate a matching WordPress page or post for ${targetUrl}.` },
          { status: 400 },
        );
      }

      const payload: Record<string, any> = {};
      const meta: Record<string, any> = {};
      const plugin = creds.seoPlugin || "core";

      if (field === "META_TITLE") {
        payload.title = afterValue;
        if (plugin === "yoast") meta._yoast_wpseo_title = afterValue;
        if (plugin === "rankmath") meta.rank_math_title = afterValue;
        if (plugin === "aioseo") meta._aioseo_title = afterValue;
      } else if (field === "META_DESCRIPTION") {
        payload.excerpt = afterValue;
        if (plugin === "yoast") meta._yoast_wpseo_metadesc = afterValue;
        if (plugin === "rankmath") meta.rank_math_description = afterValue;
        if (plugin === "aioseo") meta._aioseo_description = afterValue;
      } else if (field === "FAQ_SCHEMA" || field === "LOCAL_BUSINESS_SCHEMA") {
        const safeJsonLd = sanitizeJsonLdPayload(afterValue);
        payload.content = `${wpItem.contentRaw || ""}\n<!-- wp:html -->\n<script type="application/ld+json">\n${safeJsonLd}\n</script>\n<!-- /wp:html -->`;
      } else {
        payload.content = `${wpItem.contentRaw || ""}\n${afterValue}`;
      }
      if (Object.keys(meta).length > 0) {
        payload.meta = meta;
      }

      const updateUrl =
        publishMode === "draft"
          ? `${creds.siteUrl}/wp-json/wp/v2/${wpItem.restBase}/${wpItem.id}/autosaves`
          : `${creds.siteUrl}/wp-json/wp/v2/${wpItem.restBase}/${wpItem.id}`;

      let updateRes = await safeCmsFetch(updateUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Reigel-SEO-Agent/1.0",
        },
        body: JSON.stringify(payload),
      });

      if (!updateRes.ok && publishMode === "draft" && (updateRes.status === 400 || updateRes.status === 404)) {
        updateRes = await safeCmsFetch(
          `${creds.siteUrl}/wp-json/wp/v2/${wpItem.restBase}/${wpItem.id}`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
              Accept: "application/json",
              "User-Agent": "Reigel-SEO-Agent/1.0",
            },
            body: JSON.stringify(payload),
          },
        );
      }

      if (!updateRes.ok) {
        return NextResponse.json(
          { message: `WordPress REST API returned HTTP ${updateRes.status} when applying update.` },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        runId: `wp-${Date.now()}`,
        wpPostId: wpItem.id,
        wpAdminEditUrl: `${creds.siteUrl}/wp-admin/post.php?post=${wpItem.id}&action=edit`,
        publishMode,
        status: publishMode === "publish" ? "PUBLISHED" : "STAGED_DRAFT",
      });
    }

    if (action === "apply-shopify") {
      const creds = decryptCmsVault<{ shopDomain: string; accessToken: string }>(body.vaultToken);
      const targetUrl = String(body.targetUrl || "").trim();
      const field = String(body.field || "META_TITLE");
      const afterValue = String(body.afterValue || "").trim();

      const parsed = new URL(targetUrl);
      const segments = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
      const handle = segments[segments.length - 1] || "";
      const isProduct = segments.includes("products");
      const resourceKind = isProduct ? "products" : "pages";

      const listEndpoint = handle
        ? `${creds.shopDomain}/admin/api/2024-10/${resourceKind}.json?handle=${encodeURIComponent(handle)}&limit=1`
        : `${creds.shopDomain}/admin/api/2024-10/pages.json?limit=1`;

      const listRes = await safeCmsFetch(listEndpoint, {
        headers: {
          "X-Shopify-Access-Token": creds.accessToken,
          Accept: "application/json",
          "User-Agent": "Reigel-SEO-Agent/1.0",
        },
      });
      if (!listRes.ok) {
        return NextResponse.json(
          { message: `Shopify Admin API returned HTTP ${listRes.status}.` },
          { status: 400 },
        );
      }
      const listData = (await listRes.json()) as Record<string, any[]>;
      const items = listData[resourceKind] || listData.pages || [];
      if (!items.length) {
        return NextResponse.json(
          { message: `Could not locate a Shopify ${isProduct ? "product" : "page"} matching ${targetUrl}.` },
          { status: 400 },
        );
      }

      const item = items[0];
      const resourceId = Number(item.id);
      const singular = isProduct ? "product" : "page";
      const updatePayload: Record<string, any> = { id: resourceId };

      if (field === "META_TITLE") {
        updatePayload.metafields_global_title_tag = afterValue;
      } else if (field === "META_DESCRIPTION") {
        updatePayload.metafields_global_description_tag = afterValue;
      } else if (field === "FAQ_SCHEMA" || field === "LOCAL_BUSINESS_SCHEMA") {
        const safeJsonLd = sanitizeJsonLdPayload(afterValue);
        updatePayload.body_html = `${item.body_html || ""}\n<script type="application/ld+json">${safeJsonLd}</script>`;
      } else {
        updatePayload.body_html = `${item.body_html || ""}\n${afterValue}`;
      }

      const updateRes = await safeCmsFetch(
        `${creds.shopDomain}/admin/api/2024-10/${resourceKind}/${resourceId}.json`,
        {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": creds.accessToken,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Reigel-SEO-Agent/1.0",
          },
          body: JSON.stringify({ [singular]: updatePayload }),
        },
      );

      if (!updateRes.ok) {
        return NextResponse.json(
          { message: `Shopify Admin API rejected the update (HTTP ${updateRes.status}).` },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        runId: `shopify-${Date.now()}`,
        shopifyResourceId: resourceId,
        adminEditUrl: `${creds.shopDomain}/admin/${resourceKind}/${resourceId}`,
        status: "PUBLISHED",
      });
    }

    if (action === "apply-webflow") {
      const creds = decryptCmsVault<{ siteId: string; apiToken: string; siteUrl?: string }>(body.vaultToken);
      const targetUrl = String(body.targetUrl || "").trim();
      const field = String(body.field || "META_TITLE");
      const afterValue = String(body.afterValue || "").trim();

      const parsed = new URL(targetUrl);
      const targetSlug = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() || "";

      const listRes = await safeCmsFetch(
        `https://api.webflow.com/v2/sites/${encodeURIComponent(creds.siteId)}/pages`,
        {
          headers: {
            Authorization: `Bearer ${creds.apiToken}`,
            Accept: "application/json",
            "User-Agent": "Reigel-SEO-Agent/1.0",
          },
        },
      );
      if (!listRes.ok) {
        return NextResponse.json(
          { message: `Webflow API returned HTTP ${listRes.status} when listing pages.` },
          { status: 400 },
        );
      }
      const listData = (await listRes.json()) as {
        pages?: Array<{ id: string; slug?: string | null; title?: string; seo?: { title?: string; description?: string } }>;
      };
      const pages = Array.isArray(listData.pages) ? listData.pages : [];
      const matched =
        pages.find((p) => (p.slug || "") === targetSlug) ||
        (!targetSlug ? pages.find((p) => !p.slug || p.slug === "index" || p.slug === "home") : undefined) ||
        pages[0];

      if (!matched) {
        return NextResponse.json(
          { message: `No Webflow pages found in site ${creds.siteId}.` },
          { status: 400 },
        );
      }

      const updateBody: Record<string, any> = {
        title: matched.title,
        seo: { ...(matched.seo || {}) },
      };
      if (field === "META_TITLE") {
        updateBody.title = afterValue;
        updateBody.seo.title = afterValue;
      } else {
        updateBody.seo.description = afterValue;
      }

      const updateRes = await safeCmsFetch(
        `https://api.webflow.com/v2/pages/${encodeURIComponent(matched.id)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${creds.apiToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Reigel-SEO-Agent/1.0",
          },
          body: JSON.stringify(updateBody),
        },
      );

      if (!updateRes.ok) {
        return NextResponse.json(
          { message: `Webflow API returned HTTP ${updateRes.status} when updating page.` },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        runId: `webflow-${Date.now()}`,
        webflowPageId: matched.id,
        adminEditUrl: `https://webflow.com/design/${creds.siteId}`,
        status: "STAGED_DRAFT",
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

      const pageRes = await safeCmsFetch(targetUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Reigel-SEO-Verifier/1.0",
        },
      });

      if (!pageRes.ok) {
        return NextResponse.json(
          { message: `Live page returned HTTP ${pageRes.status} when checking ${targetUrl}.` },
          { status: 400 },
        );
      }

      const rawHtml = await pageRes.text();
      const html = rawHtml.slice(0, 2_000_000);
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
