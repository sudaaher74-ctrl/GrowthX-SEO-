import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';

describe('ReviewsService', () => {
  const projectId = 'proj-rev-101';
  const reviewId = 'rev-abc-202';

  const mockReview = {
    id: reviewId,
    projectId,
    authorName: 'Jane Doe',
    rating: 5,
    text: 'Dr. Smith was fantastic! Thorough cleaning and zero pain.',
    googleReviewId: 'accounts/1/locations/2/reviews/rev-abc-202',
    replyStatus: 'PENDING',
    createdAt: new Date('2026-09-01T10:00:00Z'),
  };

  const mockLocation = {
    id: 'loc-1',
    projectId,
    businessName: 'Apex Dental Care',
  };

  function buildService(overrides: {
    integration?: any;
    existingReviewsCount?: number;
    review?: any;
    location?: any;
    aiResponseText?: string;
    aiResponse?: any;
    publishedReply?: any;
    replyToReviewError?: Error;
    syncResult?: any;
  } = {}) {
    const countReviews = jest.fn().mockResolvedValue(
      overrides.existingReviewsCount !== undefined ? overrides.existingReviewsCount : 0,
    );

    const findUniqueIntegration = jest.fn().mockResolvedValue(
      overrides.integration !== undefined
        ? overrides.integration
        : {
            selectedResourceId: 'locations/12345',
            status: 'CONNECTED',
          },
    );

    const findManyReviews = jest.fn().mockResolvedValue([mockReview]);

    const findUniqueReview = jest.fn().mockResolvedValue(
      overrides.review !== undefined ? overrides.review : mockReview,
    );

    const findFirstLocation = jest.fn().mockResolvedValue(
      overrides.location !== undefined ? overrides.location : mockLocation,
    );

    const updateReview = jest.fn().mockImplementation(async ({ where, data }) => ({
      ...mockReview,
      id: where.id,
      ...data,
      updatedAt: new Date(),
    }));

    const prisma = {
      localReview: {
        count: countReviews,
        findMany: findManyReviews,
        findUnique: findUniqueReview,
        update: updateReview,
      },
      localLocation: {
        findFirst: findFirstLocation,
      },
      integration: {
        findUnique: findUniqueIntegration,
      },
    };

    const routerGenerate = jest.fn().mockResolvedValue(
      overrides.aiResponse !== undefined
        ? overrides.aiResponse
        : {
            text:
              overrides.aiResponseText !== undefined
                ? overrides.aiResponseText
                : 'Thank you so much Jane for the kind feedback! We are thrilled to hear your cleaning went smoothly.',
          },
    );

    const router = {
      generate: routerGenerate,
    };

    const syncGbp = jest.fn().mockResolvedValue(
      overrides.syncResult || {
        syncedAt: new Date('2026-09-21T09:00:00Z'),
        counts: { reviews: 8 },
        failedSources: [],
      },
    );

    const replyToReviewGbp = overrides.replyToReviewError
      ? jest.fn().mockRejectedValue(overrides.replyToReviewError)
      : jest.fn().mockResolvedValue(
          overrides.publishedReply || {
            comment: 'Thank you so much Jane for the kind feedback!',
            updateTime: '2026-09-21T09:05:00Z',
          },
        );

    const gbp = {
      sync: syncGbp,
      replyToReview: replyToReviewGbp,
      fetchLocation: jest.fn(),
      patchLocation: jest.fn(),
    };

    const service = new ReviewsService(prisma as any, router as any, gbp as any);

    return {
      service,
      prisma,
      router,
      gbp,
      countReviews,
      findUniqueIntegration,
      findManyReviews,
      findUniqueReview,
      findFirstLocation,
      updateReview,
      routerGenerate,
      syncGbp,
      replyToReviewGbp,
    };
  }

  describe('syncReviews', () => {
    it('verifies active connection, delegates to gbp.sync, and returns sync summary', async () => {
      const { service, findUniqueIntegration, syncGbp } = buildService();

      const result = await service.syncReviews(projectId);

      expect(findUniqueIntegration).toHaveBeenCalledWith({
        where: { projectId_provider: { projectId, provider: 'business_profile' } },
        select: { selectedResourceId: true, status: true },
      });

      expect(syncGbp).toHaveBeenCalledWith(projectId);
      expect(result).toEqual({
        syncedAt: new Date('2026-09-21T09:00:00Z'),
        reviews: 8,
        refusedSources: [],
      });
    });

    it('reports refused sources when Google v4 API denies reviews permission', async () => {
      const { service, syncGbp } = buildService({
        syncResult: {
          syncedAt: new Date('2026-09-21T09:00:00Z'),
          counts: { reviews: 0 },
          failedSources: ['reviews'],
        },
      });

      const result = await service.syncReviews(projectId);

      expect(syncGbp).toHaveBeenCalledWith(projectId);
      expect(result.refusedSources).toContain('reviews');
      expect(result.reviews).toBe(0);
    });

    it('refuses with ServiceUnavailableException when no integration exists', async () => {
      const { service, syncGbp } = buildService({ integration: null, existingReviewsCount: 0 });

      await expect(service.syncReviews(projectId)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(syncGbp).not.toHaveBeenCalled();
    });

    it('refuses when integration status is DISCONNECTED', async () => {
      const { service, syncGbp } = buildService({
        integration: { selectedResourceId: 'locations/123', status: 'DISCONNECTED' },
        existingReviewsCount: 3,
      });

      await expect(service.syncReviews(projectId)).rejects.toThrow(/3 review\(s\) already stored are unaffected/);
      expect(syncGbp).not.toHaveBeenCalled();
    });

    it('refuses when integration has no selectedResourceId', async () => {
      const { service, syncGbp } = buildService({
        integration: { selectedResourceId: null, status: 'CONNECTED' },
      });

      await expect(service.syncReviews(projectId)).rejects.toThrow(/no Google Business Profile connection is configured/);
      expect(syncGbp).not.toHaveBeenCalled();
    });
  });

  describe('getReviews', () => {
    it('returns stored reviews for the project ordered by createdAt desc', async () => {
      const { service, findManyReviews } = buildService();

      const reviews = await service.getReviews(projectId);

      expect(findManyReviews).toHaveBeenCalledWith({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      expect(reviews).toEqual([mockReview]);
    });
  });

  describe('draftReply', () => {
    it('drafts a reply with default professional tone and updates localReview.aiDraftedReply', async () => {
      const { service, findUniqueReview, findFirstLocation, routerGenerate, updateReview } = buildService();

      const result = await service.draftReply(projectId, reviewId);

      expect(findUniqueReview).toHaveBeenCalledWith({ where: { id: reviewId } });
      expect(findFirstLocation).toHaveBeenCalledWith({ where: { projectId } });

      expect(routerGenerate).toHaveBeenCalledTimes(1);
      const callArgs = routerGenerate.mock.calls[0][0];
      expect(callArgs.task).toBe(AiTask.FAST);
      expect(callArgs.prompt).toContain('Business Name: Apex Dental Care');
      expect(callArgs.prompt).toContain('Reviewer: Jane Doe');
      expect(callArgs.prompt).toContain('Rating: 5 out of 5');
      expect(callArgs.prompt).toContain('Maintain a courteous, polished, and professional tone.');

      expect(updateReview).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: {
          aiDraftedReply:
            'Thank you so much Jane for the kind feedback! We are thrilled to hear your cleaning went smoothly.',
        },
      });

      expect(result.aiDraftedReply).toContain('Jane');
    });

    it('drafts a reply with WARM tone when specified', async () => {
      const { service, routerGenerate } = buildService();

      await service.draftReply(projectId, reviewId, 'WARM');

      const callArgs = routerGenerate.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Adopt a warm, heartfelt, community-oriented tone');
    });

    it('drafts a reply with DE_ESCALATION tone when specified', async () => {
      const { service, routerGenerate } = buildService();

      await service.draftReply(projectId, reviewId, 'DE_ESCALATION');

      const callArgs = routerGenerate.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Adopt an empathetic, reassuring, solution-oriented tone');
    });

    it('falls back to "our business" when no localLocation record is found', async () => {
      const { service, routerGenerate } = buildService({ location: null });

      await service.draftReply(projectId, reviewId);

      const callArgs = routerGenerate.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Business Name: our business');
    });

    it('throws NotFoundException when review does not exist', async () => {
      const { service, routerGenerate } = buildService({ review: null });

      await expect(service.draftReply(projectId, 'non-existent')).rejects.toBeInstanceOf(NotFoundException);
      expect(routerGenerate).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when review belongs to a different project', async () => {
      const { service, routerGenerate } = buildService({
        review: { ...mockReview, projectId: 'different-proj' },
      });

      await expect(service.draftReply(projectId, reviewId)).rejects.toThrow('Review not found.');
      expect(routerGenerate).not.toHaveBeenCalled();
    });

    it('throws an error when AI returns empty or missing text', async () => {
      const { service, updateReview } = buildService({
        aiResponse: { text: '' },
      });

      await expect(service.draftReply(projectId, reviewId)).rejects.toThrow(
        'AI failed to generate a reply',
      );
      expect(updateReview).not.toHaveBeenCalled();
    });

    it('throws an error when AI response has undefined text', async () => {
      const { service, updateReview } = buildService({
        aiResponse: {} as any,
      });

      await expect(service.draftReply(projectId, reviewId)).rejects.toThrow(
        'AI failed to generate a reply',
      );
      expect(updateReview).not.toHaveBeenCalled();
    });
  });

  describe('publishReply', () => {
    it('calls gbp.replyToReview and updates review status to PUBLISHED with Google metadata', async () => {
      const { service, replyToReviewGbp, updateReview } = buildService();

      const replyText = 'Thank you for choosing Apex Dental Care!';
      const result = await service.publishReply(projectId, reviewId, replyText);

      expect(replyToReviewGbp).toHaveBeenCalledWith(
        projectId,
        'accounts/1/locations/2/reviews/rev-abc-202',
        replyText,
      );

      expect(updateReview).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: {
          aiDraftedReply: replyText,
          googleReplyText: 'Thank you so much Jane for the kind feedback!',
          googleReplyUpdatedAt: '2026-09-21T09:05:00Z',
          replyStatus: 'PUBLISHED',
        },
      });

      expect(result.replyStatus).toBe('PUBLISHED');
      expect(result.googleReplyText).toBe('Thank you so much Jane for the kind feedback!');
    });

    it('throws NotFoundException when review to publish does not exist or belongs to another project', async () => {
      const { service, replyToReviewGbp } = buildService({ review: null });

      await expect(service.publishReply(projectId, reviewId, 'reply')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(replyToReviewGbp).not.toHaveBeenCalled();
    });

    it('refuses with ServiceUnavailableException if review has no googleReviewId', async () => {
      const reviewWithoutGoogleId = {
        ...mockReview,
        googleReviewId: null,
      };
      const { service, replyToReviewGbp, updateReview } = buildService({ review: reviewWithoutGoogleId });

      await expect(service.publishReply(projectId, reviewId, 'reply')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await expect(service.publishReply(projectId, reviewId, 'reply')).rejects.toThrow(
        /This review did not come from a Google Business Profile sync/,
      );

      expect(replyToReviewGbp).not.toHaveBeenCalled();
      expect(updateReview).not.toHaveBeenCalled();
    });

    it('does not mark review PUBLISHED if Google API replyToReview throws', async () => {
      const googleError = new Error('Google API Error: 503 Backend Service Unavailable');
      const { service, replyToReviewGbp, updateReview } = buildService({
        replyToReviewError: googleError,
      });

      await expect(service.publishReply(projectId, reviewId, 'reply')).rejects.toThrow(
        'Google API Error: 503 Backend Service Unavailable',
      );

      expect(replyToReviewGbp).toHaveBeenCalled();
      // Crucial data integrity check: localReview was NOT updated to PUBLISHED
      expect(updateReview).not.toHaveBeenCalled();
    });
  });
});
