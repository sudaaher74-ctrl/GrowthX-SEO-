import { NextRequest, NextResponse } from "next/server";
import { GITHUB_TX_NONCE_COOKIE } from "@/lib/github-oauth-server";

/**
 * Handles browser redirects back from https://github.com after:
 * 1. GitHub App installation & OAuth authorization (`?code=...&state=...`)
 * 2. GitHub OAuth Web Flow (`?code=...&state=...`)
 * 3. GitHub App Manifest registration (`?code=...&state=...`)
 *
 * Requires both `state` and the HttpOnly browser-binding nonce cookie to be
 * present before forwarding parameters to the authenticated settings handler,
 * which verifies and consumes the single-use server-side transaction.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const installationId = url.searchParams.get("installation_id") || "";
  const setupAction = url.searchParams.get("setup_action") || "";
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error") || "";

  const target = new URL("/settings", url.origin);
  target.searchParams.set("tab", "integrations");

  if (error) {
    target.searchParams.set("github", "cancelled");
    return NextResponse.redirect(target);
  }

  const browserNonce = req.cookies.get(GITHUB_TX_NONCE_COOKIE)?.value || "";
  if (code && (!state || !browserNonce)) {
    target.searchParams.set("github", "invalid_state");
    return NextResponse.redirect(target);
  }

  if (code) {
    target.searchParams.set("github_code", code);
  }
  if (installationId) {
    target.searchParams.set("installation_id", installationId);
  }
  if (setupAction) {
    target.searchParams.set("setup_action", setupAction);
  }
  if (state) {
    target.searchParams.set("github_state", state);
  }

  return NextResponse.redirect(target);
}
