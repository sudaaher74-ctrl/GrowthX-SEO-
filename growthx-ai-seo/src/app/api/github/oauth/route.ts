import { NextRequest, NextResponse } from "next/server";
import {
  clearGitHubServerCookies,
  consumeGitHubOAuthTransaction,
  createGitHubOAuthTransaction,
  getBackendApiBaseUrl,
  GITHUB_APP_COOKIE,
  GITHUB_SESSION_COOKIE,
  GITHUB_TX_NONCE_COOKIE,
  readBoundGitHubApp,
  readBoundGitHubSession,
  resolveAuthenticatedReigelUser,
  sealServerCookiePayload,
  serverCookieOptions,
  type GitHubAuthenticatedUser,
} from "@/lib/github-oauth-server";

/**
 * Public GitHub OAuth client ID with Device Flow enabled (`repo read:user user:email`).
 * Operators can override with `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_APP_SLUG`.
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

async function fetchGitHubUser(accessToken: string): Promise<GitHubAuthenticatedUser | null> {
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

export async function GET(req: NextRequest) {
  const appSlug =
    process.env.GITHUB_APP_SLUG?.trim() ||
    process.env.NEXT_PUBLIC_GITHUB_APP_SLUG?.trim() ||
    null;
  const webClientId =
    process.env.GITHUB_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID?.trim() ||
    null;
  const hasClientSecret = Boolean(process.env.GITHUB_CLIENT_SECRET?.trim());

  const reigelUser = await resolveAuthenticatedReigelUser(req);
  if (!reigelUser) {
    const res = NextResponse.json(
      {
        appSlug,
        webClientId,
        hasWebOAuth: Boolean(webClientId && hasClientSecret),
        authenticated: false,
        user: null,
        customAppSlug: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    clearGitHubServerCookies(res);
    return res;
  }

  const session = readBoundGitHubSession(req, reigelUser.userId);
  const customApp = readBoundGitHubApp(req, reigelUser.userId);
  const hasStaleSessionCookie = Boolean(req.cookies.get(GITHUB_SESSION_COOKIE)?.value && !session);
  const hasStaleAppCookie = Boolean(req.cookies.get(GITHUB_APP_COOKIE)?.value && !customApp);

  const res = NextResponse.json(
    {
      appSlug,
      webClientId,
      hasWebOAuth: Boolean(webClientId && hasClientSecret),
      authenticated: Boolean(session),
      user: session?.user ?? null,
      customAppSlug: customApp?.slug ?? null,
      customAppName: customApp?.name ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );

  // If a prior user left a cookie in the same browser tab, wipe it immediately.
  if (hasStaleSessionCookie) {
    res.cookies.set(GITHUB_SESSION_COOKIE, "", { ...serverCookieOptions(0), maxAge: 0 });
  }
  if (hasStaleAppCookie) {
    res.cookies.set(GITHUB_APP_COOKIE, "", { ...serverCookieOptions(0), maxAge: 0 });
  }
  return res;
}

export async function POST(req: NextRequest) {
  try {
    assertSameOriginRequest(req);
    const body = (await req.json()) as {
      action?: string;
      deviceCode?: string;
      code?: string;
      state?: string;
      projectId?: string;
      pat?: string;
      owner?: string;
      name?: string;
      defaultBranch?: string;
      framework?: string;
      csrfToken?: string;
    };

    const action = body.action;

    // Logout cleanup works even if the user's application session already expired.
    if (action === "disconnect_session") {
      const res = NextResponse.json({ disconnected: true }, { headers: { "Cache-Control": "no-store" } });
      clearGitHubServerCookies(res);
      return res;
    }

    const reigelUser = await resolveAuthenticatedReigelUser(req);
    if (!reigelUser) {
      const res = NextResponse.json(
        { error: "Sign in to your account before connecting GitHub." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
      clearGitHubServerCookies(res);
      return res;
    }

    const customApp = readBoundGitHubApp(req, reigelUser.userId);

    // 1. Start browser-bound single-use OAuth transaction for GitHub Web OAuth / App install
    if (action === "init_web_oauth" || action === "init_manifest") {
      const projectId = String(body.projectId || "").trim();
      if (!projectId) {
        return NextResponse.json({ error: "projectId is required." }, { status: 400 });
      }
      const purpose = action === "init_manifest" ? "github_manifest" : "github_web";
      const tx = createGitHubOAuthTransaction({
        userId: reigelUser.userId,
        projectId,
        purpose,
      });

      const activeAppSlug =
        customApp?.slug ||
        process.env.GITHUB_APP_SLUG?.trim() ||
        process.env.NEXT_PUBLIC_GITHUB_APP_SLUG?.trim() ||
        null;

      const authorizeUrl =
        purpose === "github_manifest"
          ? `https://github.com/settings/apps/new?state=${encodeURIComponent(tx.state)}`
          : activeAppSlug
            ? `https://github.com/apps/${encodeURIComponent(activeAppSlug)}/installations/new?state=${encodeURIComponent(tx.state)}`
            : null;

      const res = NextResponse.json(
        {
          state: tx.state,
          authorizeUrl,
          codeChallenge: tx.codeChallenge,
          codeChallengeMethod: tx.codeChallengeMethod,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
      res.cookies.set(GITHUB_TX_NONCE_COOKIE, tx.browserNonce, serverCookieOptions(10 * 60));
      return res;
    }

    // 2. Start GitHub OAuth Device Flow
    if (action === "device_start") {
      const clientId = getClientId(customApp?.clientId);
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

    // 3. Poll GitHub OAuth Device Flow — seal access token server-side ONLY (never return to browser JS)
    if (action === "device_poll") {
      if (!body.deviceCode) {
        return NextResponse.json({ error: "deviceCode is required" }, { status: 400 });
      }
      const clientId = getClientId(customApp?.clientId);
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
        scope?: string;
        error?: string;
        error_description?: string;
        interval?: number;
      };

      if (data.access_token) {
        const user = await fetchGitHubUser(data.access_token);
        if (!user) {
          return NextResponse.json(
            { status: "failed", error: "Could not load GitHub profile for the authorized token." },
            { status: 400 },
          );
        }
        const sealed = sealServerCookiePayload({
          userId: reigelUser.userId,
          accessToken: data.access_token,
          user,
          createdAt: Date.now(),
        });
        const res = NextResponse.json(
          {
            status: "authorized",
            scope: data.scope ?? "repo,read:user",
            user,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
        res.cookies.set(GITHUB_SESSION_COOKIE, sealed, serverCookieOptions(8 * 60 * 60));
        return res;
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

    // 4. Exchange GitHub Web OAuth code ONLY after validating browser-bound single-use transaction
    if (action === "exchange_code") {
      if (!body.code || !body.state) {
        return NextResponse.json(
          { error: "Authorization code and verified OAuth state are required." },
          { status: 400 },
        );
      }
      const browserNonce = req.cookies.get(GITHUB_TX_NONCE_COOKIE)?.value;
      const tx = consumeGitHubOAuthTransaction({
        state: body.state,
        browserNonce,
        userId: reigelUser.userId,
        projectId: body.projectId?.trim() || undefined,
        expectedPurpose: "github_web",
      });

      const clientId =
        customApp?.clientId ||
        process.env.GITHUB_CLIENT_ID?.trim() ||
        process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID?.trim();
      const clientSecret = customApp?.clientSecret || process.env.GITHUB_CLIENT_SECRET?.trim();

      if (!clientId || !clientSecret) {
        return NextResponse.json(
          {
            error:
              "Server-side GitHub OAuth credentials are not configured.",
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
          code_verifier: tx.codeVerifier,
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
      if (!user) {
        return NextResponse.json(
          { error: "Could not verify GitHub user profile for this authorization." },
          { status: 400 },
        );
      }

      const sealed = sealServerCookiePayload({
        userId: reigelUser.userId,
        accessToken: data.access_token,
        user,
        createdAt: Date.now(),
      });
      const res = NextResponse.json(
        {
          status: "authorized",
          user,
          projectId: tx.projectId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
      res.cookies.set(GITHUB_TX_NONCE_COOKIE, "", { ...serverCookieOptions(0), maxAge: 0 });
      res.cookies.set(GITHUB_SESSION_COOKIE, sealed, serverCookieOptions(8 * 60 * 60));
      return res;
    }

    // 5. Convert GitHub App Manifest code after verifying single-use browser-bound transaction;
    // keep client_secret strictly server-side in an HttpOnly user-bound cookie.
    if (action === "manifest_convert") {
      if (!body.code || !body.state) {
        return NextResponse.json({ error: "Manifest code and verified state are required." }, { status: 400 });
      }
      const browserNonce = req.cookies.get(GITHUB_TX_NONCE_COOKIE)?.value;
      const tx = consumeGitHubOAuthTransaction({
        state: body.state,
        browserNonce,
        userId: reigelUser.userId,
        projectId: body.projectId?.trim() || undefined,
        expectedPurpose: "github_manifest",
      });

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

      const sealedApp = sealServerCookiePayload({
        userId: reigelUser.userId,
        slug: data.slug,
        name: data.name ?? data.slug,
        clientId: data.client_id,
        clientSecret: data.client_secret,
        htmlUrl: data.html_url ?? `https://github.com/apps/${data.slug}`,
      });

      // Immediately mint a fresh browser-bound transaction for the follow-up app installation step.
      const installTx = createGitHubOAuthTransaction({
        userId: reigelUser.userId,
        projectId: tx.projectId,
        purpose: "github_web",
      });

      const res = NextResponse.json(
        {
          slug: data.slug,
          name: data.name ?? data.slug,
          htmlUrl: data.html_url ?? `https://github.com/apps/${data.slug}`,
          installUrl: `https://github.com/apps/${encodeURIComponent(data.slug)}/installations/new?state=${encodeURIComponent(installTx.state)}`,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
      res.cookies.set(GITHUB_APP_COOKIE, sealedApp, serverCookieOptions(24 * 60 * 60));
      res.cookies.set(GITHUB_TX_NONCE_COOKIE, installTx.browserNonce, serverCookieOptions(10 * 60));
      return res;
    }

    // 6. Verify a user-supplied PAT server-side and bind to HttpOnly cookie
    if (action === "verify_pat") {
      const pat = String(body.pat || "").trim();
      if (!pat) {
        return NextResponse.json({ error: "Please enter a valid GitHub Personal Access Token." }, { status: 400 });
      }
      const user = await fetchGitHubUser(pat);
      if (!user) {
        return NextResponse.json(
          { error: "GitHub rejected this token. Verify the token has `repo` permissions." },
          { status: 400 },
        );
      }
      const sealed = sealServerCookiePayload({
        userId: reigelUser.userId,
        accessToken: pat,
        user,
        createdAt: Date.now(),
      });
      const res = NextResponse.json(
        { status: "authorized", user },
        { headers: { "Cache-Control": "no-store" } },
      );
      res.cookies.set(GITHUB_SESSION_COOKIE, sealed, serverCookieOptions(8 * 60 * 60));
      return res;
    }

    // 7. List live repositories using the server-held, user-bound GitHub token
    if (action === "list_repos") {
      const session = readBoundGitHubSession(req, reigelUser.userId);
      if (!session) {
        const res = NextResponse.json(
          { error: "GitHub session not found or belongs to another account. Please sign in with GitHub again." },
          { status: 401 },
        );
        res.cookies.set(GITHUB_SESSION_COOKIE, "", { ...serverCookieOptions(0), maxAge: 0 });
        return res;
      }

      const ghRes = await fetch(
        "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member",
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "Reigel-AI-SEO-Platform",
          },
          cache: "no-store",
        },
      );
      if (ghRes.status === 401) {
        const res = NextResponse.json(
          { error: "GitHub session expired. Please sign in with GitHub again." },
          { status: 401 },
        );
        res.cookies.set(GITHUB_SESSION_COOKIE, "", { ...serverCookieOptions(0), maxAge: 0 });
        return res;
      }
      if (!ghRes.ok) {
        return NextResponse.json(
          { error: `GitHub API returned HTTP ${ghRes.status} while loading repositories.` },
          { status: 400 },
        );
      }
      const repos = await ghRes.json();
      return NextResponse.json({ repos }, { headers: { "Cache-Control": "no-store" } });
    }

    // 8. Connect selected repo directly to authenticated backend without exposing token to browser JS
    if (action === "connect_repo") {
      const session = readBoundGitHubSession(req, reigelUser.userId);
      if (!session) {
        return NextResponse.json(
          { error: "GitHub session expired or belongs to another user. Sign in with GitHub again." },
          { status: 401 },
        );
      }
      const projectId = String(body.projectId || "").trim();
      const owner = String(body.owner || "").trim();
      const name = String(body.name || "").trim();
      if (!projectId || !owner || !name) {
        return NextResponse.json({ error: "projectId, owner, and name are required." }, { status: 400 });
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const cookieHeader = req.headers.get("cookie");
      const authHeader = req.headers.get("authorization");
      const csrfHeader = req.headers.get("x-csrf-token") || body.csrfToken || req.cookies.get("csrf_token")?.value;
      if (cookieHeader) headers.Cookie = cookieHeader;
      if (authHeader) headers.Authorization = authHeader;
      if (csrfHeader) headers["X-CSRF-Token"] = csrfHeader;

      const apiRes = await fetch(
        `${getBackendApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/automation/repository`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            owner,
            name,
            defaultBranch: body.defaultBranch?.trim() || "main",
            framework: body.framework || "nextjs",
            accessToken: session.accessToken,
          }),
          cache: "no-store",
        },
      );
      const apiData = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) {
        return NextResponse.json(
          { error: apiData?.message || apiData?.error || "Failed to connect repository." },
          { status: apiRes.status },
        );
      }
      return NextResponse.json(apiData, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GitHub OAuth request failed." },
      { status: 400 },
    );
  }
}
