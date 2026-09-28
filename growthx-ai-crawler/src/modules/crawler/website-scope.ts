/**
 * Whose `Website` row this is. See `Website.scope` in the schema.
 *
 * Every lookup of a website by domain names a scope, so one customer's crawls
 * can never be read — or reused — by another. A domain used to be a single
 * row for the whole platform: a second customer adding a competitor the first
 * already tracked was shown that competitor's pages as "read" without ever
 * asking for a crawl, and a competitor that was also somebody's own website
 * shared that customer's own audit.
 */

/** A customer's own website. One per domain, so a domain stays with whoever registered it. */
export const OWN_SCOPE = 'own';

/** A competitor's website as tracked by one project, and only that project. */
export function competitorScope(projectId: string): string {
  if (!projectId) throw new Error('A competitor website belongs to a project.');
  return `competitor:${projectId}`;
}

/** Prisma's compound key for a website lookup by domain within a scope. */
export function websiteKey(domain: string, scope: string) {
  return { domain_scope: { domain, scope } };
}
