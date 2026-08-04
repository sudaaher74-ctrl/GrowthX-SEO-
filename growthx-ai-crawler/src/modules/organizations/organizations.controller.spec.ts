import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let organizations: { createOrganization: jest.Mock; getOrganizationsForUser: jest.Mock };

  beforeEach(async () => {
    organizations = {
      createOrganization: jest.fn().mockResolvedValue({ id: 'org_1' }),
      getOrganizationsForUser: jest.fn().mockResolvedValue([{ id: 'org_1' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [{ provide: OrganizationsService, useValue: organizations }],
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
});
