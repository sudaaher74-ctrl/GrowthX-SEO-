/**
 * The API origin the app under test talks to, for specs that serve it fixtures.
 *
 * It has to match what `getApiBase()` (src/lib/api-client.ts) resolves in the
 * browser, or `page.route(`${API_BASE}/**`)` intercepts a host the app never
 * calls: the fixtures are silently skipped, every request fails, and each
 * assertion reads the "API unavailable" state. That is how three specs came to
 * fail together in CI, where NEXT_PUBLIC_API_URL is unset: they fell back to
 * :3001, which is the dashboard's own port, while the app falls back to the
 * API's :3000.
 *
 * Next loads .env.local for the app build, but Playwright does not load it for
 * specs. Load the same environment here before resolving the API origin.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
