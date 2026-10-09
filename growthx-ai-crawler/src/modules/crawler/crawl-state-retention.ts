/** Bounded crash-recovery retention; active crawls renew this lease. */
export function crawlStateRetentionSeconds(): number {
  const configured = Number(process.env.CRAWL_STATE_RETENTION_SECONDS || 604800);
  return Number.isFinite(configured) ? Math.max(86400, Math.min(604800, Math.floor(configured))) : 604800;
}
