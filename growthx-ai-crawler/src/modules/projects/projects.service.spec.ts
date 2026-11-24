import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import * as tokenCrypto from '../integrations/google/token-crypto';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: { project: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { project: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ProjectsService);
  });

  it('creates a project', async () => {
    const data = { name: 'Acme', organization: { connect: { id: 'org_1' } } } as any;
    prisma.project.create.mockResolvedValue({ id: 'p1', name: 'Acme' });
    await expect(service.createProject(data)).resolves.toMatchObject({ id: 'p1' });
    expect(prisma.project.create).toHaveBeenCalledWith({ data });
  });

  it('scopes the project list to one organization', async () => {
    prisma.project.findMany.mockResolvedValue([{ id: 'p1' }]);
    await service.getProjectsByOrganization('org_1');
    expect(prisma.project.findMany).toHaveBeenCalledWith({ where: { organizationId: 'org_1' } });
  });

  it('returns null for a project that does not exist', async () => {
    prisma.project.findUnique.mockResolvedValue(null);
    await expect(service.getProjectById('missing')).resolves.toBeNull();
  });

  describe('deleteProject', () => {
    const transaction = jest.fn();
    const readIntegrations = jest.fn();
    const deleteAuxiliary = jest.fn();
    const deleteRecommendations = jest.fn();
    const deleteEvidence = jest.fn();
    const deleteWebsites = jest.fn();
    const deleteProject = jest.fn();

    beforeEach(() => {
      jest.resetAllMocks();
      const auxiliary = { deleteMany: deleteAuxiliary };
      Object.assign(prisma, {
        $transaction: transaction,
        integration: { findMany: readIntegrations },
        autopilotRun: auxiliary,
        auditReportSnapshot: auxiliary,
        competitorReportSnapshot: auxiliary,
        googleReportSnapshot: auxiliary,
        businessStrategySnapshot: auxiliary,
        savedPlan: auxiliary,
        actionStepDone: auxiliary,
        fixIntervention: auxiliary,
        recommendation: { deleteMany: deleteRecommendations },
        evidence: { deleteMany: deleteEvidence },
        website: { deleteMany: deleteWebsites },
        project: { ...prisma.project, delete: deleteProject },
      });
    });

    afterEach(() => jest.restoreAllMocks());

    it('includes scoped cleanup in one transaction and removes recommendations before evidence', async () => {
      const recommendations = { operation: 'recommendations' };
      const evidence = { operation: 'evidence' };
      const project = { operation: 'project' };
      deleteRecommendations.mockReturnValue(recommendations);
      deleteEvidence.mockReturnValue(evidence);
      deleteProject.mockReturnValue(project);
      transaction.mockResolvedValue([[]]);

      await service.deleteProject('p1');

      expect(deleteAuxiliary).toHaveBeenCalledTimes(8);
      expect(deleteAuxiliary).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
      expect(deleteWebsites.mock.calls).toEqual([
        [{ where: { scope: 'competitor:p1' } }],
        [{ where: { projectId: 'p1' } }],
      ]);
      const [operations] = transaction.mock.calls[0];
      expect(operations.indexOf(recommendations)).toBeLessThan(operations.indexOf(evidence));
      expect(operations[operations.length - 1]).toBe(project);
    });

    it('leaves Google grants alone when the transaction fails', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      transaction.mockRejectedValue(new Error('database unavailable'));

      await expect(service.deleteProject('p1')).rejects.toThrow('database unavailable');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('completes deletion if Google is unavailable after the transaction commits', async () => {
      const decrypt = jest.spyOn(tokenCrypto, 'decryptToken').mockReturnValue('test-token');
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Google unavailable'));
      transaction.mockResolvedValue([[{ refreshToken: 'encrypted-token' }]]);

      await expect(service.deleteProject('p1')).resolves.toBeUndefined();
      expect(decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(fetchSpy).toHaveBeenCalledWith('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        body: new URLSearchParams({ token: 'test-token' }),
        signal: expect.any(AbortSignal),
      });
    });
  });
});
