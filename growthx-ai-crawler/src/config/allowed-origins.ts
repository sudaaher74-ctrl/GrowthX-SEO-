/**
 * Browser origins allowed to call this API with credentials.
 *
 * Reflecting every origin alongside `credentials: true` would let any site
 * drive the API as a logged-in user, so the allowlist is explicit. In
 * development we default to the local Next.js ports; in production an unset
 * list means "same-origin only" rather than "everyone".
 *
 * Shared by CORS, the WebSocket gateway and the CSRF Origin check so the three
 * can never disagree.
 */
export function allowedBrowserOrigins(): string[] {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (configured.length > 0) return configured;
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://localhost:3001'];
  }
  return [];
}
