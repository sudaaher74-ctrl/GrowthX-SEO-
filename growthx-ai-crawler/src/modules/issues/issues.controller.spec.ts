import { NotFoundException } from '@nestjs/common';
import { IssuesController } from './issues.controller';

/**
 * `Issue` carries no organizationId, so nothing below the controller can scope
 * a query to the caller's organization. These are the tests that keep one
 * client from reading another's findings by editing the id in the URL.
 */
describe('IssuesController ownership', () => {
  const ownProject = 'proj_mine';
  const foreignProject = 'proj_theirs';

  const prisma = {
    project: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.id === ownProject && where.organizationId === 'org_me' ? { id: ownProject } : null,
      ),
    },
  };
  const counts = { countsForProject: jest.fn(async () => ({ openFindings: 1 })) };
  const groups = {
    groupsForProject: jest.fn(async () => ({ groups: [], reachAvailable: false })),
    pagesForGroup: jest.fn(async () => ({ items: [], nextCursor: null, total: 0 })),
  };
  const req = { organizationId: 'org_me' };

  let controller: IssuesController;
  beforeEach(() => {
    jest.clearAllMocks();
    controller = new IssuesController(prisma as any, counts as any, groups as any);
  });

  it('serves the caller its own project', async () => {
    await expect(controller.countsForProject(req, ownProject)).resolves.toEqual({ openFindings: 1 });
  });

  it.each([
    ['counts', (c: IssuesController) => c.countsForProject(req, foreignProject)],
    ['groups', (c: IssuesController) => c.groupsForProject(req, foreignProject)],
    ['group pages', (c: IssuesController) => c.pagesForGroup(req, foreignProject, 'k')],
  ])('refuses %s for a project in another organization', async (_name, call) => {
    await expect(call(controller)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never reaches the data layer for a project it does not own', async () => {
    await controller.countsForProject(req, foreignProject).catch(() => undefined);
    await controller.groupsForProject(req, foreignProject).catch(() => undefined);
    await controller.pagesForGroup(req, foreignProject, 'k').catch(() => undefined);

    expect(counts.countsForProject).not.toHaveBeenCalled();
    expect(groups.groupsForProject).not.toHaveBeenCalled();
    expect(groups.pagesForGroup).not.toHaveBeenCalled();
  });

  it('answers not-found rather than forbidden, so a guessed id confirms nothing', async () => {
    await expect(controller.countsForProject(req, foreignProject)).rejects.toThrow(
      'Project not found in this organization.',
    );
  });

  it('clamps the period to something sane', async () => {
    await controller.countsForProject(req, ownProject, '99999');
    await controller.countsForProject(req, ownProject, 'abc');
    await controller.countsForProject(req, ownProject, '-5');

    expect(counts.countsForProject).toHaveBeenNthCalledWith(1, ownProject, 365);
    expect(counts.countsForProject).toHaveBeenNthCalledWith(2, ownProject, 28);
    expect(counts.countsForProject).toHaveBeenNthCalledWith(3, ownProject, 28);
  });
});
