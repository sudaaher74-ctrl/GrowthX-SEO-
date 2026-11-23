jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('simple-git', () => ({ simpleGit: jest.fn() }));
import { ProofOfImpactService } from './proof-of-impact.service';

it('does not report an unchecked page as awaiting deployment', async () => {
  const service: any = Object.create(ProofOfImpactService.prototype);
  service.verificationRequests = new Map();
  service.prisma = {
    automationRun: { findUnique: jest.fn().mockResolvedValue({
      id: 'run', projectId: 'project', pullRequestUrl: 'https://github.com/acme/repo/pull/42',
      steps: [{ change: { url: 'invalid', field: 'META_TITLE', after: 'Home' } }],
    }) },
    project: { findUnique: jest.fn().mockResolvedValue({ id: 'project', organizationId: 'org_1' }) },
    siteRepository: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'repo_1',
        projectId: 'project',
        owner: 'acme',
        name: 'repo',
        accessTokenEncrypted: 'encrypted',
        connectedOrganizationId: 'org_1',
        connectedByUserId: 'user_1',
        credentialProvenance: 'EXPLICIT',
      }),
    },
    website: { findFirst: jest.fn().mockResolvedValue({ domain: 'acme.com', url: 'https://acme.com' }) },
  };
  service.git = { readPullRequestEvidence: jest.fn().mockResolvedValue({ state: 'MERGED', mergedAt: '2026-10-28T12:00:00Z' }) };
  service.security = { decryptCredentials: jest.fn().mockReturnValue('token') };
  service.fetcher = {};
  const result = await service.verifyDeployment('project', 'run');
  expect(result).toMatchObject({ success: false, verificationStatus: 'NOT_CHECKED' });
  expect(result.message).toContain('No valid affected page URL');
});
