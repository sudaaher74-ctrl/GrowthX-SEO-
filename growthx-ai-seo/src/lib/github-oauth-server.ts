import * as crypto from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const GITHUB_SESSION_COOKIE = "reigel_gh_session";
export const GITHUB_APP_COOKIE = "reigel_gh_app";
export const GITHUB_TX_NONCE_COOKIE = "reigel_gh_oauth_tx";

export interface GitHubAuthenticatedUser {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  htmlUrl: string;
}

export interface SealedGitHubSession {
  userId: string;
  accessToken: string;
  user: GitHubAuthenticatedUser;
  createdAt: number;
}

export interface SealedGitHubApp {
  userId: string;
  slug: string;
  name: string;
  clientId: string;
  clientSecret: string;
  htmlUrl: string;
}

export interface GitHubOAuthTxRecord {
  stateHash: string;
  browserNonceHash: string;
  userId: string;
  projectId: string;
  purpose: "github_web" | "github_manifest";
  codeVerifier: string;
  expiresAt: number;
  consumed: boolean;
}

const TX_TTL_MS = 10 * 60 * 1000;

declare global {
  var __reigelGitHubTxStore: Map<string, GitHubOAuthTxRecord> | undefined;
  var __reigelGitHubDevKey: Buffer | undefined;
}

function getTxStore(): Map<string, GitHubOAuthTxRecord> {
  if (!globalThis.__reigelGitHubTxStore) {
    globalThis.__reigelGitHubTxStore = new Map();
  }
  return globalThis.__reigelGitHubTxStore;
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function timingSafeHexEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Returns the 32-byte server-side encryption key for HttpOnly GitHub cookies.
 * Never uses a hard-coded secret: fails closed in production when unconfigured,
 * and uses an ephemeral per-process random key only in non-production dev/tests.
 */
export function getGitHubSessionKey(): Buffer {
  const raw =
    process.env.GITHUB_OAUTH_SESSION_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim();
  if (raw) {
    return crypto.createHash("sha256").update(`reigel-gh-session:${raw}`, "utf8").digest();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "GITHUB_OAUTH_SESSION_SECRET (or ENCRYPTION_KEY) must be configured on the server.",
    );
  }
  if (!globalThis.__reigelGitHubDevKey) {
    globalThis.__reigelGitHubDevKey = crypto.randomBytes(32);
  }
  return globalThis.__reigelGitHubDevKey;
}

export function sealServerCookiePayload(payload: object): string {
  const key = getGitHubSessionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function unsealServerCookiePayload<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  try {
    const key = getGitHubSessionKey();
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const encrypted = Buffer.from(parts[2], "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function serverCookieOptions(maxAgeSeconds: number) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/api/github",
    maxAge: maxAgeSeconds,
  };
}

export function clearGitHubServerCookies(res: NextResponse): void {
  for (const name of [GITHUB_SESSION_COOKIE, GITHUB_APP_COOKIE, GITHUB_TX_NONCE_COOKIE]) {
    res.cookies.set(name, "", {
      ...serverCookieOptions(0),
      maxAge: 0,
    });
  }
}

export function createGitHubOAuthTransaction(input: {
  userId: string;
  projectId: string;
  purpose: "github_web" | "github_manifest";
  ttlMs?: number;
}): {
  state: string;
  browserNonce: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
} {
  const store = getTxStore();
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= now || v.consumed) {
      store.delete(k);
    }
  }

  const state = crypto.randomBytes(32).toString("base64url");
  const browserNonce = crypto.randomBytes(32).toString("base64url");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier, "ascii").digest("base64url");
  const stateHash = sha256Hex(state);

  store.set(stateHash, {
    stateHash,
    browserNonceHash: sha256Hex(browserNonce),
    userId: input.userId,
    projectId: input.projectId,
    purpose: input.purpose,
    codeVerifier,
    expiresAt: now + (input.ttlMs ?? TX_TTL_MS),
    consumed: false,
  });

  return {
    state,
    browserNonce,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

export function consumeGitHubOAuthTransaction(input: {
  state: string | undefined;
  browserNonce: string | undefined;
  userId: string;
  projectId?: string;
  expectedPurpose: "github_web" | "github_manifest";
}): GitHubOAuthTxRecord {
  const state = typeof input.state === "string" ? input.state.trim() : "";
  const browserNonce = typeof input.browserNonce === "string" ? input.browserNonce.trim() : "";
  if (!state || !browserNonce) {
    throw new Error("Missing OAuth state or browser verification cookie. Start connecting GitHub again.");
  }

  const store = getTxStore();
  const stateHash = sha256Hex(state);
  const record = store.get(stateHash);

  if (!record || record.consumed) {
    throw new Error("GitHub OAuth state is invalid or was already used.");
  }
  if (record.expiresAt <= Date.now()) {
    store.delete(stateHash);
    throw new Error("GitHub OAuth state has expired. Start connecting again.");
  }
  if (!timingSafeHexEquals(record.browserNonceHash, sha256Hex(browserNonce))) {
    throw new Error("GitHub OAuth callback does not match the initiating browser session.");
  }
  if (record.purpose !== input.expectedPurpose) {
    throw new Error("GitHub OAuth state purpose mismatch.");
  }
  if (record.userId !== input.userId) {
    throw new Error("GitHub OAuth callback belongs to a different signed-in user.");
  }
  if (input.projectId && record.projectId !== input.projectId) {
    throw new Error("GitHub OAuth callback does not match the active project.");
  }

  record.consumed = true;
  store.delete(stateHash);
  return record;
}

export function getBackendApiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_URL?.trim() ||
    process.env.API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

/**
 * Verifies the caller's live Reigel session against the backend `/auth/me`
 * endpoint using the incoming browser cookies / Authorization header.
 */
export async function resolveAuthenticatedReigelUser(
  req: NextRequest,
): Promise<{ userId: string; email: string } | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const authHeader = req.headers.get("authorization") || "";
  if (!cookieHeader && !authHeader) return null;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (cookieHeader) headers.Cookie = cookieHeader;
  if (authHeader) headers.Authorization = authHeader;

  try {
    const res = await fetch(`${getBackendApiBaseUrl()}/auth/me`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; userId?: string; email?: string };
    const userId = String(data?.id || data?.userId || "").trim();
    const email = String(data?.email || "").trim();
    if (!userId) return null;
    return { userId, email };
  } catch {
    return null;
  }
}

export function readBoundGitHubSession(
  req: NextRequest,
  expectedUserId: string,
): SealedGitHubSession | null {
  const raw = req.cookies.get(GITHUB_SESSION_COOKIE)?.value;
  const session = unsealServerCookiePayload<SealedGitHubSession>(raw);
  if (!session || session.userId !== expectedUserId || !session.accessToken || !session.user?.login) {
    return null;
  }
  return session;
}

export function readBoundGitHubApp(
  req: NextRequest,
  expectedUserId: string,
): SealedGitHubApp | null {
  const raw = req.cookies.get(GITHUB_APP_COOKIE)?.value;
  const app = unsealServerCookiePayload<SealedGitHubApp>(raw);
  if (!app || app.userId !== expectedUserId || !app.slug || !app.clientId || !app.clientSecret) {
    return null;
  }
  return app;
}
