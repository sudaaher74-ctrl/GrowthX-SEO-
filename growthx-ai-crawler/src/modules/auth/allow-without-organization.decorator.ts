import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_ORGANIZATION = 'allowWithoutOrganization';

/**
 * Marks a route that is reachable before the caller belongs to anywhere.
 *
 * Creating or listing organizations has to work for an account with no
 * membership yet — that is precisely the account trying to get one. Every other
 * route is workspace-scoped and has nothing to act on without it.
 */
export const AllowWithoutOrganization = () => SetMetadata(ALLOW_WITHOUT_ORGANIZATION, true);
