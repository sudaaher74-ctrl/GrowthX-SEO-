import { NextRequest, NextResponse } from "next/server";

/**
 * Public GitHub OAuth client ID with Device Flow enabled (`repo read:user user:email`).
 * Operators can override with `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_APP_SLUG`
 * in environment variables to use a dedicated GitHub App or OAuth App.
 */
const DEFAULT_GITHUB_OAUTH_CLIENT_ID = "178c6fc778ccc68e1d6a";

function getClientId(overrideClientId?: string): string {
  return (
    overrideClientId?.trim() ||
    process.env.GITHUB_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID?.trim() ||
    DEFAULT_GITHUB_OAUTH_CLIENT_ID
  );
}

async function fetchGitHubUser(accessToken: string) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Reigel-AI-SEO-Platform",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    login?: string;
    name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
    html_url?: string;
  };
  if (!data?.login) return null;
  return {
    login: data.login,
    name: data.name ?? null,
    avatarUrl: data.avatar_url ?? null,
    email: data.email ?? null,
    htmlUrl: data.html_url ?? `https://github.com/${data.login}`,
  };
}

export async function GET() {
  const appSlug =
    process.env.GITHUB_APP_SLUG?.trim() ||
    process.env.NEXT_PUBLIC_GITHUB_APP_SLUG?.trim() ||
    null;
  const webClientId =
    process.env.GITHUB_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID?.trim() ||
    null;
  const hasClientSecret = Boolean(process.env.GITHUB_CLIENT_SECRET?.trim());

  return NextResponse.json({
    appSlug,
    webClientId,
    hasWebOAuth: Boolean(webClientId && hasClientSecret),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: string;
      deviceCode?: string;
      code?: string;
      clientId?: string;
      clientSecret?: string;
    };

    const action = body.action;

    // 1. Start real GitHub OAuth Device Flow on https://github.com/login/device
    if (action === "device_start") {
      const clientId = getClientId(body.clientId);
      const ghRes = await fetch("https://github.com/login/device/code", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Reigel-AI-SEO-Platform",
        },
        body: JSON.stringify({
          client_id: clientId,
          scope: "repo read:user user:email",
        }),
        cache: "no-store",
      });

      const data = (await ghRes.json()) as {
        device_code?: string;
        user_code?: string;
        verification_uri?: string;
        expires_in?: number;
        interval?: number;
        error?: string;
        error_description?: string;
      };

      if (!ghRes.ok || !data.device_code || !data.user_code) {
        return NextResponse.json(
          {
            error:
              data.error_description ||
              data.error ||
              "Could not initiate GitHub OAuth session with github.com.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri || "https://github.com/login/device",
        expiresIn: data.expires_in,
        interval: data.interval,
      });
    }

    // 2. Poll GitHub OAuth token endpoint while user authorizes on github.com
    if (action === "device_poll") {
      if (!body.deviceCode) {
        return NextResponse.json({ error: "deviceCode is required" }, { status: 400 });
      }
      const clientId = getClientId(body.clientId);
      const ghRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Reigel-AI-SEO-Platform",
        },
        body: JSON.stringify({
          client_id: clientId,
          device_code: body.deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
        cache: "no-store",
      });

      const data = (await ghRes.json()) as {
        access_token?: string;
        token_type?: string;
        scope?: string;
        error?: string;
        error_description?: string;
        interval?: number;
      };

      if (data.access_token) {
        const user = await fetchGitHubUser(data.access_token);
        return NextResponse.json({
          status: "authorized",
          accessToken: data.access_token,
          scope: data.scope ?? "repo,read:user",
          user,
        });
      }

      if (data.error === "authorization_pending" || data.error === "slow_down") {
        return NextResponse.json({
          status: "pending",
          error: data.error,
          interval: data.interval,
        });
      }

      return NextResponse.json({
        status: "failed",
        error: data.error_description || data.error || "GitHub authorization expired or was denied.",
      });
    }

    // 3. Exchange standard GitHub OAuth / GitHub App installation `code` for user access_token
    if (action === "exchange_code") {
      if (!body.code) {
        return NextResponse.json({ error: "Authorization code is required." }, { status: 400 });
      }
      const clientId =
        body.clientId?.trim() ||
        process.env.GITHUB_CLIENT_ID?.trim() ||
        process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID?.trim();
      const clientSecret =
        body.clientSecret?.trim() || process.env.GITHUB_CLIENT_SECRET?.trim();

      if (!clientId || !clientSecret) {
        return NextResponse.json(
          {
            error:
              "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required to exchange a web OAuth code.",
          },
          { status: 400 },
        );
      }

      const ghRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Reigel-AI-SEO-Platform",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: body.code,
        }),
        cache: "no-store",
      });

      const data = (await ghRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!data.access_token) {
        return NextResponse.json(
          {
            error:
              data.error_description ||
              data.error ||
              "GitHub did not return an access token for this authorization code.",
          },
          { status: 400 },
        );
      }

      const user = await fetchGitHubUser(data.access_token);
      return NextResponse.json({
        status: "authorized",
        accessToken: data.access_token,
        user,
      });
    }

    // 4. Convert GitHub App Manifest registration `code` into a live GitHub App
    if (action === "manifest_convert") {
      if (!body.code) {
        return NextResponse.json({ error: "Manifest code is required." }, { status: 400 });
      }
      const ghRes = await fetch(
        `https://api.github.com/app-manifests/${encodeURIComponent(body.code)}/conversions`,
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "Reigel-AI-SEO-Platform",
          },
          cache: "no-store",
        },
      );

      const data = (await ghRes.json()) as {
        slug?: string;
        client_id?: string;
        client_secret?: string;
        html_url?: string;
        name?: string;
        message?: string;
      };

      if (!ghRes.ok || !data.slug || !data.client_id || !data.client_secret) {
        return NextResponse.json(
          { error: data.message || "Failed to convert GitHub App manifest on github.com." },
          { status: 400 },
        );
      }

      return NextResponse.json({
        slug: data.slug,
        name: data.name ?? data.slug,
        clientId: data.client_id,
        clientSecret: data.client_secret,
        htmlUrl: data.html_url ?? `https://github.com/apps/${data.slug}`,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GitHub OAuth request failed." },
      { status: 500 },
    );
  }
}
