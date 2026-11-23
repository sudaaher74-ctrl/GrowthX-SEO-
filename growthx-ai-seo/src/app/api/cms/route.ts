import { NextResponse } from "next/server";

/**
 * The browser-held CMS credential fallback (and its former default vault key)
 * has been retired. All WordPress, Shopify, and Webflow credentials are stored
 * server-side in the authenticated API and authorized against the caller's live
 * session and project role on every request.
 *
 * Any credentials previously sealed through this endpoint must be rotated at
 * the CMS provider and reconnected through Settings -> Integrations.
 */
const RETIRED_RESPONSE = {
  error: "CMS_FALLBACK_RETIRED",
  reconnectRequired: true,
  message:
    "The legacy browser CMS fallback has been retired. Rotate any credentials previously saved through this path and reconnect your CMS via the authenticated API.",
} as const;

export async function GET() {
  return NextResponse.json(RETIRED_RESPONSE, {
    status: 410,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST() {
  return NextResponse.json(RETIRED_RESPONSE, {
    status: 410,
    headers: { "Cache-Control": "no-store" },
  });
}
