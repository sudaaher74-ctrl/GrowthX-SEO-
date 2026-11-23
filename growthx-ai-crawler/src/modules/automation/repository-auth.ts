import { ForbiddenException } from '@nestjs/common';

export const GITHUB_CREDENTIAL_PROVENANCE_EXPLICIT = 'EXPLICIT';
export const GITHUB_CREDENTIAL_PROVENANCE_LEGACY = 'LEGACY_UNVERIFIED';

export const GITHUB_REUSE_SENTINELS: ReadonlySet<string> = new Set([
  'ghp_oauth_session_verified',
  '__REUSE_LINKED_GITHUB_TOKEN__',
]);

export interface RepositoryAuthRecord {
  id?: string;
  projectId: string;
  owner: string;
  name?: string;
  accessTokenEncrypted?: string | null;
  connectedOrganizationId?: string | null;
  connectedByUserId?: string | null;
  credentialProvenance?: string | null;
}

export function isExplicitlyAuthorizedRepository(
  repo: RepositoryAuthRecord | null | undefined,
  projectId: string,
  organizationId: string | null | undefined,
): boolean {
  if (!repo || !projectId || !organizationId) return false;
  if (repo.projectId !== projectId) return false;
  if (!repo.accessTokenEncrypted) return false;
  if (repo.credentialProvenance !== GITHUB_CREDENTIAL_PROVENANCE_EXPLICIT) return false;
  if (!repo.connectedOrganizationId || repo.connectedOrganizationId !== organizationId) return false;
  if (!repo.connectedByUserId || !String(repo.connectedByUserId).trim()) return false;
  return true;
}

export function assertRepositoryAuthorized(
  repo: RepositoryAuthRecord | null | undefined,
  projectId: string,
  organizationId: string | null | undefined,
): void {
  if (!repo || repo.projectId !== projectId) {
    throw new ForbiddenException('Repository connection does not belong to the requested project.');
  }
  if (!organizationId) {
    throw new ForbiddenException('Workspace authorization context is required to use repository credentials.');
  }
  if (repo.credentialProvenance !== GITHUB_CREDENTIAL_PROVENANCE_EXPLICIT) {
    throw new ForbiddenException(
      'This GitHub connection predates verified workspace provenance and has been suspended. Reconnect the repository with a fresh GitHub token.',
    );
  }
  if (!repo.connectedOrganizationId || repo.connectedOrganizationId !== organizationId) {
    throw new ForbiddenException(
      'This GitHub credential is not authorized for the requesting workspace. Reconnect the repository with your own token.',
    );
  }
  if (!repo.connectedByUserId || !String(repo.connectedByUserId).trim()) {
    throw new ForbiddenException(
      'This GitHub connection has no verified authorizing user. Reconnect the repository with a fresh GitHub token.',
    );
  }
}

export async function assertActorCanUseRepository(
  prisma: any,
  organizationId: string,
  actorUserId?: string | null,
): Promise<void> {
  if (!actorUserId || !prisma?.organizationMember?.findUnique) return;
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId: actorUserId, organizationId } },
    select: { role: true },
  });
  if (!membership) {
    throw new ForbiddenException('The user who queued this automation run is no longer a member of this workspace.');
  }
  if (membership.role === 'VIEWER') {
    throw new ForbiddenException('The user who queued this automation run no longer has write access in this workspace.');
  }
}
