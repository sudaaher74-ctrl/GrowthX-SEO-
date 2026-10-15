import { existsSync } from 'fs';

/**
 * Fixture origins are loopback, which the SSRF guard refuses by design.
 * Opened only for the test process.
 */
process.env.ALLOW_PRIVATE_CRAWL_TARGETS = 'true';
// Existing suites exercise legacy routing. Low-cost policy tests explicitly
// enable the production-default policy and test its separate spending boundary.
process.env.AI_LOW_COST_POLICY = 'false';

// Where a preinstalled Chromium lives, when the runtime provides one instead of
// Playwright's own download. Harmless when unset.
if (!process.env.PLAYWRIGHT_EXECUTABLE_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH) {
  const candidate = `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`;
  if (existsSync(candidate)) process.env.PLAYWRIGHT_EXECUTABLE_PATH = candidate;
}
