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

/** A customer's verified exclusive own website. One per domain globally. */
export const OWN_SCOPE = 'own';

/**
 * A temporary, unverified domain claim scoped to a single organization.
 *
 * Unverified registrations live under `claim:<organizationId>` so an unverified
 * claimant can never block the genuine domain owner from registering and
 * proving ownership via DNS TXT / meta verification. Upon verification, the
 * claim is promoted atomically to `OWN_SCOPE`.
 */
export function claimScope(organizationId: string): string {
  if (!organizationId) throw new Error('A domain claim belongs to an organization.');
  return `claim:${organizationId}`;
}

export function isClaimScope(scope: string | null | undefined): boolean {
  return typeof scope === 'string' && scope.startsWith('claim:');
}

export function isCompetitorScope(scope: string | null | undefined): boolean {
  return typeof scope === 'string' && scope.startsWith('competitor:');
}

export function isOwnOrClaimScope(scope: string | null | undefined): boolean {
  return scope === OWN_SCOPE || isClaimScope(scope);
}

/** A competitor's website as tracked by one project, and only that project. */
export function competitorScope(projectId: string): string {
  if (!projectId) throw new Error('A competitor website belongs to a project.');
  return `competitor:${projectId}`;
}

/** Prisma's compound key for a website lookup by domain within a scope. */
export function websiteKey(domain: string, scope: string) {
  return { domain_scope: { domain, scope } };
}
