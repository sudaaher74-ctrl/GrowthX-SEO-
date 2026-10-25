import { NextRequest, NextResponse } from "next/server";

/**
 * Handles browser redirects back from https://github.com after:
 * 1. GitHub App installation & OAuth authorization (`?code=...&installation_id=...&setup_action=install&state=...`)
 * 2. GitHub OAuth Web Flow (`?code=...&state=...`)
 * 3. GitHub App Manifest registration (`?code=...&state=manifest_...`)
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
