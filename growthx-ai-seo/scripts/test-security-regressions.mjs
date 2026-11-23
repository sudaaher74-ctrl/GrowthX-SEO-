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
