#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const FORBIDDEN_PATTERNS = [
  /(^|\/)dump\.rdb$/i,
  /\.rdb$/i,
  /\.aof$/i,
  /\.dump$/i,
  /\.sql(\.gz|\.zst|\.bz2)?$/i,
];
// Prisma migrations and explicit fixture SQL under prisma/migrations are legitimate schema SQL.
const ALLOWED_PATH_PREFIXES = ["growthx-ai-crawler/prisma/migrations/"];

const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const violations = tracked.filter((file) => {
  if (ALLOWED_PATH_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;
  return FORBIDDEN_PATTERNS.some((re) => re.test(file));
});

if (violations.length > 0) {
  console.error("Tracked runtime dump or database snapshot files detected:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`OK: checked ${tracked.length} tracked files; no Redis or database runtime dumps present.`);
