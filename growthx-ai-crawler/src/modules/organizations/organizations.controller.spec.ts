import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrgContextService } from '../billing/org-context.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let organizations: { createOrganization: jest.Mock; getOrganizationsForUser: jest.Mock; listMembers: jest.Mock };
  let orgContext: { assertMembership: jest.Mock };

  beforeEach(async () => {
    organizations = {
      createOrganization: jest.fn().mockResolvedValue({ id: 'org_1' }),
      getOrganizationsForUser: jest.fn().mockResolvedValue([{ id: 'org_1' }]),
      listMembers: jest.fn().mockResolvedValue([{ id: 'm1', email: 'someone@example.com' }]),
    };
    orgContext = { assertMembership: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        { provide: OrganizationsService, useValue: organizations },
        { provide: OrgContextService, useValue: orgContext },
      ],
    }).compile();
    controller = module.get(OrganizationsController);
  });

  it('scopes the list to the authenticated user', async () => {
    const req = { user: { userId: 'u1' } };
    await expect(controller.getOrganizations(req)).resolves.toEqual([{ id: 'org_1' }]);
    expect(organizations.getOrganizationsForUser).toHaveBeenCalledWith('u1');
  });

  it('creates an organization owned by the caller', async () => {
    const req = { user: { userId: 'u1' } };
    await controller.createOrganization(req, { name: 'Acme', slug: 'acme' } as any);
    expect(organizations.createOrganization).toHaveBeenCalledWith('u1', { name: 'Acme', slug: 'acme' });
  });

  it('lists members of an organization the caller belongs to', async () => {
    const req = { user: { userId: 'u1' } };
    await expect(controller.listMembers(req, 'org_1')).resolves.toEqual([
      { id: 'm1', email: 'someone@example.com' },
    ]);
    expect(orgContext.assertMembership).toHaveBeenCalledWith('u1', 'org_1');
  });

  it('refuses to list members of an organization the caller is not in', async () => {
    const req = { user: { userId: 'u1' } };
    orgContext.assertMembership.mockRejectedValue(new ForbiddenException());
    await expect(controller.listMembers(req, 'someone_elses_org')).rejects.toThrow(ForbiddenException);
    // The member list — names, emails, roles — must not be read at all.
    expect(organizations.listMembers).not.toHaveBeenCalled();
  });
});
