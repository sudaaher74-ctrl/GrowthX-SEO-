import { NotFoundException } from '@nestjs/common';
import { GbpAutofixService } from './gbp-autofix.service';

describe('GbpAutofixService', () => {
  const projectId = 'proj-999';
  const proposalId = 'prop-abc-123';

  const samplePendingProposal = {
    id: proposalId,
    projectId,
    field: 'websiteUri',
    currentValue: 'http://old-site.com',
    proposedValue: 'https://new-secure-site.com',
    rationale: 'Switch to HTTPS and updated domain name.',
    status: 'PENDING',
  };

  function buildService(overrides: {
    pendingProposal?: any;
    location?: any;
    patchLocationError?: Error;
    fetchLocationError?: Error;
    updateManyCount?: number;
  } = {}) {
    const findFirstProposal = jest.fn().mockResolvedValue(
      overrides.pendingProposal !== undefined ? overrides.pendingProposal : samplePendingProposal,
    );

    const updateProposal = jest.fn().mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
      updatedAt: new Date(),
    }));

    const updateManyProposal = jest.fn().mockResolvedValue({
      count: overrides.updateManyCount !== undefined ? overrides.updateManyCount : 1,
    });

    const prisma = {
      gbpFixProposal: {
        findFirst: findFirstProposal,
        update: updateProposal,
        updateMany: updateManyProposal,
      },
    };

    const fetchLocation = overrides.fetchLocationError
      ? jest.fn().mockRejectedValue(overrides.fetchLocationError)
      : jest.fn().mockResolvedValue(
          overrides.location !== undefined ? overrides.location : { name: 'locations/123456789' },
        );

    const patchLocation = overrides.patchLocationError
      ? jest.fn().mockRejectedValue(overrides.patchLocationError)
      : jest.fn().mockResolvedValue({ name: 'locations/123456789' });

    const gbp = {
      fetchLocation,
      patchLocation,
      replyToReview: jest.fn(),
      sync: jest.fn(),
    };

    const service = new GbpAutofixService(prisma as any, gbp as any);

    return {
      service,
      prisma,
      gbp,
      findFirstProposal,
      updateProposal,
      updateManyProposal,
      fetchLocation,
      patchLocation,
    };
  }

  describe('approveAndPushFix', () => {
    it('approves proposal, fetches location, patches root field on Google, and marks proposal as PUSHED', async () => {
      const { service, findFirstProposal, updateProposal, fetchLocation, patchLocation } = buildService();

      const result = await service.approveAndPushFix(proposalId, projectId);

      // 1. Found pending proposal
      expect(findFirstProposal).toHaveBeenCalledWith({
        where: {
          id: proposalId,
          projectId,
          status: 'PENDING',
        },
      });

      // 2. Verified sequential status updates: PENDING -> APPROVED -> PUSHED
      expect(updateProposal).toHaveBeenCalledTimes(2);
      expect(updateProposal).toHaveBeenNthCalledWith(1, {
        where: { id: proposalId },
        data: { status: 'APPROVED' },
      });
      expect(updateProposal).toHaveBeenNthCalledWith(2, {
        where: { id: proposalId },
        data: { status: 'PUSHED' },
      });

      // 3. Location fetched from Google
      expect(fetchLocation).toHaveBeenCalledWith(projectId);

      // 4. Patched to Google with root field payload
      expect(patchLocation).toHaveBeenCalledWith(
        projectId,
        'locations/123456789',
        'websiteUri',
        { websiteUri: 'https://new-secure-site.com' },
      );

      expect(result).toEqual({ success: true });
    });

    it('handles nested profile.* fields by packaging into profile object', async () => {
      const profileProposal = {
        id: proposalId,
        projectId,
        field: 'profile.description',
        currentValue: 'Old generic description.',
        proposedValue: 'Premium 24/7 emergency veterinary hospital in downtown Seattle.',
        rationale: 'Local SEO keywords boost.',
        status: 'PENDING',
      };

      const { service, updateProposal, patchLocation } = buildService({
        pendingProposal: profileProposal,
      });

      const result = await service.approveAndPushFix(proposalId, projectId);

      expect(patchLocation).toHaveBeenCalledWith(
        projectId,
        'locations/123456789',
        'profile.description',
        {
          profile: {
            description: 'Premium 24/7 emergency veterinary hospital in downtown Seattle.',
          },
        },
      );

      expect(updateProposal).toHaveBeenNthCalledWith(2, {
        where: { id: proposalId },
        data: { status: 'PUSHED' },
      });
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException if the proposal is not found or not in PENDING status', async () => {
      const { service, findFirstProposal, updateProposal, fetchLocation, patchLocation } = buildService({
        pendingProposal: null,
      });

      await expect(service.approveAndPushFix(proposalId, projectId)).rejects.toThrow(NotFoundException);

      expect(findFirstProposal).toHaveBeenCalledWith({
        where: {
          id: proposalId,
          projectId,
          status: 'PENDING',
        },
      });
      expect(updateProposal).not.toHaveBeenCalled();
      expect(fetchLocation).not.toHaveBeenCalled();
      expect(patchLocation).not.toHaveBeenCalled();
    });

    it('reverts status to PENDING if Google returns a location without a resource name', async () => {
      const { service, updateProposal, patchLocation } = buildService({
        location: { name: '' }, // Missing resource name
      });

      await expect(service.approveAndPushFix(proposalId, projectId)).rejects.toThrow(
        'Google did not return a resource name for the selected Business Profile location.',
      );

      // Proposal was marked APPROVED, then reverted to PENDING
      expect(updateProposal).toHaveBeenCalledTimes(2);
      expect(updateProposal).toHaveBeenNthCalledWith(1, {
        where: { id: proposalId },
        data: { status: 'APPROVED' },
      });
      expect(updateProposal).toHaveBeenNthCalledWith(2, {
        where: { id: proposalId },
        data: { status: 'PENDING' },
      });

      // Google patch was not attempted
      expect(patchLocation).not.toHaveBeenCalled();
    });

    it('reverts status to PENDING if Google patchLocation rejects with an error', async () => {
      const googleError = new Error('Google API Error: 403 Insufficient Permission');
      const { service, updateProposal, patchLocation } = buildService({
        patchLocationError: googleError,
      });

      await expect(service.approveAndPushFix(proposalId, projectId)).rejects.toThrow(
        'Google API Error: 403 Insufficient Permission',
      );

      // Status was approved, then rolled back to PENDING on failure
      expect(updateProposal).toHaveBeenCalledTimes(2);
      expect(updateProposal).toHaveBeenNthCalledWith(1, {
        where: { id: proposalId },
        data: { status: 'APPROVED' },
      });
      expect(updateProposal).toHaveBeenNthCalledWith(2, {
        where: { id: proposalId },
        data: { status: 'PENDING' },
      });
      expect(patchLocation).toHaveBeenCalled();
    });

    it('reverts status to PENDING if fetchLocation rejects with an error', async () => {
      const fetchError = new Error('Network error connecting to Google API');
      const { service, updateProposal, patchLocation } = buildService({
        fetchLocationError: fetchError,
      });

      await expect(service.approveAndPushFix(proposalId, projectId)).rejects.toThrow(
        'Network error connecting to Google API',
      );

      // Status reverted back to PENDING
      expect(updateProposal).toHaveBeenCalledTimes(2);
      expect(updateProposal).toHaveBeenNthCalledWith(1, {
        where: { id: proposalId },
        data: { status: 'APPROVED' },
      });
      expect(updateProposal).toHaveBeenNthCalledWith(2, {
        where: { id: proposalId },
        data: { status: 'PENDING' },
      });
      expect(patchLocation).not.toHaveBeenCalled();
    });
  });

  describe('rejectFix', () => {
    it('transitions proposal status to REJECTED for a pending proposal', async () => {
      const { service, updateManyProposal } = buildService({ updateManyCount: 1 });

      const result = await service.rejectFix(proposalId, projectId);

      expect(updateManyProposal).toHaveBeenCalledWith({
        where: {
          id: proposalId,
          projectId,
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
        },
      });
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when rejecting a proposal that is not found or not in PENDING state', async () => {
      const { service, updateManyProposal } = buildService({ updateManyCount: 0 });

      await expect(service.rejectFix(proposalId, projectId)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.rejectFix(proposalId, projectId)).rejects.toThrow(
        `Pending GBP fix proposal ${proposalId} not found`,
      );

      expect(updateManyProposal).toHaveBeenCalledWith({
        where: {
          id: proposalId,
          projectId,
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
        },
      });
    });
  });
});
