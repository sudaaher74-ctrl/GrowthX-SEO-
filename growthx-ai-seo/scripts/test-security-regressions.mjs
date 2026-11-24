import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SEO_ROOT = path.resolve(import.meta.dirname, "..");

test("High #6 & #7: /api/cms route retires fallback, removes default vault key, and rejects copied vault tokens with 410", () => {
  const cmsRoutePath = path.join(SEO_ROOT, "src/app/api/cms/route.ts");
  const source = fs.readFileSync(cmsRoutePath, "utf8");

  assert.doesNotMatch(source, /reigel-cms-vault-key-v1/, "Default fallback CMS vault key must be removed");
  assert.doesNotMatch(source, /decryptCmsVault|encryptCmsVault/, "Client-held CMS vault encryption must be retired");
  assert.match(source, /status:\s*410/, "Retired /api/cms route must fail closed with HTTP 410 Gone");
  assert.match(source, /CMS_FALLBACK_RETIRED/, "Must communicate retirement & rotation requirement");
});

test("High #7: api-client never falls back to /api/cms on 404 or stores CMS vault tokens in localStorage", () => {
  const apiClientPath = path.join(SEO_ROOT, "src/lib/api-client.ts");
  const source = fs.readFileSync(apiClientPath, "utf8");

  assert.doesNotMatch(source, /fetch\(["']\/api\/cms["']/, "Frontend must never fall back to /api/cms");
  assert.doesNotMatch(source, /localStorage\.setItem\(`growthx\.(wp|shopify|webflow)\./, "Frontend must never save CMS tokens in localStorage");
  assert.match(source, /clearLegacyCmsBrowserRecords/, "Frontend must purge legacy browser CMS records on auth transitions");
});

test("High #13: GitHub tokens and App client secrets are never persisted in browser storage and are isolated per authenticated user", async () => {
  const workflowPath = path.join(SEO_ROOT, "src/components/settings/github-agent-connect-workflow.tsx");
  const workflowSource = fs.readFileSync(workflowPath, "utf8");
  const apiClientSource = fs.readFileSync(path.join(SEO_ROOT, "src/lib/api-client.ts"), "utf8");
  const oauthRouteSource = fs.readFileSync(path.join(SEO_ROOT, "src/app/api/github/oauth/route.ts"), "utf8");

  assert.doesNotMatch(workflowSource, /sessionStorage\.setItem/, "GitHub UI must never persist tokens in sessionStorage");
  assert.doesNotMatch(workflowSource, /localStorage\.setItem/, "GitHub UI must never persist GitHub App secrets in localStorage");
  assert.match(apiClientSource, /reigel_github_oauth_session_v1/, "Logout/migration cleanup must purge legacy GitHub session storage key");
  assert.match(apiClientSource, /reigel_github_app_config_v1/, "Logout/migration cleanup must purge legacy GitHub App localStorage key");
  assert.match(apiClientSource, /disconnect_session/, "Logout must revoke server-side HttpOnly GitHub session cookies");
  assert.doesNotMatch(oauthRouteSource, /NextResponse\.json\(\{[^}]*accessToken\b/, "OAuth route must never return raw GitHub accessToken to browser JS");
  assert.doesNotMatch(oauthRouteSource, /NextResponse\.json\(\{[^}]*clientSecret\b/, "OAuth route must never return raw GitHub App clientSecret to browser JS");

  // Runtime test: two users sharing the same browser tab/cookies must never inherit each other's GitHub session or App secret
  const ghServer = await import("../src/lib/github-oauth-server.ts");
  const prevSecret = process.env.GITHUB_OAUTH_SESSION_SECRET;
  const prevNodeEnv = process.env.NODE_ENV;
  try {
    process.env.GITHUB_OAUTH_SESSION_SECRET = "synthetic-test-github-cookie-key-32b";

    const sealedSessionUserA = ghServer.sealServerCookiePayload({
      userId: "user-A",
      accessToken: "gho_synthetic_user_a_token",
      user: {
        login: "alice-org",
        name: "Alice",
        avatarUrl: null,
        email: "alice@example.test",
        htmlUrl: "https://github.com/alice-org",
      },
      createdAt: Date.now(),
    });
    const sealedAppUserA = ghServer.sealServerCookiePayload({
      userId: "user-A",
      slug: "alice-app",
      name: "Alice App",
      clientId: "Iv1.synthetic",
      clientSecret: "synthetic_app_secret_user_a",
      htmlUrl: "https://github.com/apps/alice-app",
    });

    const mockReqWithUserACookies = {
      cookies: {
        get: (name) => {
          if (name === ghServer.GITHUB_SESSION_COOKIE) return { value: sealedSessionUserA };
          if (name === ghServer.GITHUB_APP_COOKIE) return { value: sealedAppUserA };
          return undefined;
        },
      },
    };

    // User A can read their own bound GitHub session & App config
    const sessionForA = ghServer.readBoundGitHubSession(mockReqWithUserACookies, "user-A");
    const appForA = ghServer.readBoundGitHubApp(mockReqWithUserACookies, "user-A");
    assert.equal(sessionForA?.accessToken, "gho_synthetic_user_a_token");
    assert.equal(appForA?.clientSecret, "synthetic_app_secret_user_a");

    // User B signing into the same browser tab MUST receive null (cannot inherit User A's GitHub session/app)
    const sessionForB = ghServer.readBoundGitHubSession(mockReqWithUserACookies, "user-B");
    const appForB = ghServer.readBoundGitHubApp(mockReqWithUserACookies, "user-B");
    assert.equal(sessionForB, null, "User B must never inherit User A's sealed GitHub session cookie");
    assert.equal(appForB, null, "User B must never inherit User A's sealed GitHub App secret cookie");

    // Production fail-closed check when no secret env var is set
    delete process.env.GITHUB_OAUTH_SESSION_SECRET;
    const prevEnc = process.env.ENCRYPTION_KEY;
    const prevJwt = process.env.JWT_SECRET;
    delete process.env.ENCRYPTION_KEY;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "production";
    try {
      assert.throws(() => ghServer.getGitHubSessionKey(), /must be configured on the server/i);
    } finally {
      if (prevEnc !== undefined) process.env.ENCRYPTION_KEY = prevEnc;
      if (prevJwt !== undefined) process.env.JWT_SECRET = prevJwt;
    }
  } finally {
    if (prevSecret === undefined) delete process.env.GITHUB_OAUTH_SESSION_SECRET;
    else process.env.GITHUB_OAUTH_SESSION_SECRET = prevSecret;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  }
});

test("High #14: GitHub OAuth transactions enforce browser nonce, user/project binding, expiry, and single-use consumption", async () => {
  const callbackSource = fs.readFileSync(
    path.join(SEO_ROOT, "src/app/api/github/callback/route.ts"),
    "utf8",
  );
  assert.match(callbackSource, /GITHUB_TX_NONCE_COOKIE/, "GitHub callback must require HttpOnly browser nonce cookie");

  const ghServer = await import("../src/lib/github-oauth-server.ts");

  const tx = ghServer.createGitHubOAuthTransaction({
    userId: "user-1",
    projectId: "proj-1",
    purpose: "github_web",
  });
  assert.ok(tx.state && tx.browserNonce && tx.codeChallenge);
  assert.equal(tx.codeChallengeMethod, "S256");

  // Wrong browser nonce fails without consuming the transaction
  assert.throws(
    () =>
      ghServer.consumeGitHubOAuthTransaction({
        state: tx.state,
        browserNonce: "attacker-browser-nonce",
        userId: "user-1",
        projectId: "proj-1",
        expectedPurpose: "github_web",
      }),
    /initiating browser session/i,
  );

  // Wrong user fails
  assert.throws(
    () =>
      ghServer.consumeGitHubOAuthTransaction({
        state: tx.state,
        browserNonce: tx.browserNonce,
        userId: "other-user",
        projectId: "proj-1",
        expectedPurpose: "github_web",
      }),
    /different signed-in user/i,
  );

  // Wrong project fails
  assert.throws(
    () =>
      ghServer.consumeGitHubOAuthTransaction({
        state: tx.state,
        browserNonce: tx.browserNonce,
        userId: "user-1",
        projectId: "other-proj",
        expectedPurpose: "github_web",
      }),
    /active project/i,
  );

  // Wrong purpose fails
  assert.throws(
    () =>
      ghServer.consumeGitHubOAuthTransaction({
        state: tx.state,
        browserNonce: tx.browserNonce,
        userId: "user-1",
        projectId: "proj-1",
        expectedPurpose: "github_manifest",
      }),
    /purpose mismatch/i,
  );

  // Valid consumption succeeds once and yields PKCE codeVerifier
  const consumed = ghServer.consumeGitHubOAuthTransaction({
    state: tx.state,
    browserNonce: tx.browserNonce,
    userId: "user-1",
    projectId: "proj-1",
    expectedPurpose: "github_web",
  });
  assert.equal(consumed.userId, "user-1");
  assert.equal(consumed.projectId, "proj-1");
  assert.ok(consumed.codeVerifier);

  // Replay of the exact same state & nonce MUST fail
  assert.throws(
    () =>
      ghServer.consumeGitHubOAuthTransaction({
        state: tx.state,
        browserNonce: tx.browserNonce,
        userId: "user-1",
        projectId: "proj-1",
        expectedPurpose: "github_web",
      }),
    /invalid or was already used/i,
  );

  // Expired transaction MUST fail
  const expiredTx = ghServer.createGitHubOAuthTransaction({
    userId: "user-1",
    projectId: "proj-1",
    purpose: "github_manifest",
    ttlMs: -1000,
  });
  assert.throws(
    () =>
      ghServer.consumeGitHubOAuthTransaction({
        state: expiredTx.state,
        browserNonce: expiredTx.browserNonce,
        userId: "user-1",
        projectId: "proj-1",
        expectedPurpose: "github_manifest",
      }),
    /expired/i,
  );
});
