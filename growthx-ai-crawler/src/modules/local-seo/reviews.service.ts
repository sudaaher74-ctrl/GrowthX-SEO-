import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { BusinessProfileService } from '../integrations/google/business-profile.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    private readonly gbp: BusinessProfileService,
  ) {}

  /**
   * Pulls reviews from the connected Google Business Profile.
   *
   * This used to have no connection to pull from, and papered over that by
   * writing invented reviews into LocalReview — named authors, written
   * testimonials, plausible timestamps. Once stored they were indistinguishable
   * from real ones: they counted toward review totals, fed the review-theme
   * analysis, and the AI reply drafter would compose replies to customers who
   * do not exist. A reply sent to a fabricated review is a reply the operator
   * would have had no way to know was fictional.
   *
   * There is a connection now, and it does the pulling. What is unchanged is
   * the behaviour when there is not one: refuse and say so. Reviews already
   * stored are left alone either way, because nothing here can tell which of
   * them are real.
   */
  async syncReviews(projectId: string) {
    const existingCount = await this.prisma.localReview.count({ where: { projectId } });

    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'business_profile' } },
      select: { selectedResourceId: true, status: true },
    });

    if (!integration || integration.status === 'DISCONNECTED' || !integration.selectedResourceId) {
      throw new ServiceUnavailableException(
        'Review sync is unavailable: no Google Business Profile connection is configured for this project. ' +
          'Connect a Google Business Profile to import reviews. ' +
          (existingCount > 0
            ? `${existingCount} review(s) already stored are unaffected.`
            : 'No reviews can be imported until then.'),
      );
    }

    // The connector owns the pull, the idempotency and the "Google refused
    // this source" state. Reviews are one of the three that only exist on the
    // legacy v4 API, so a refusal here is common and is reported rather than
    // returned as an empty list.
    const result = await this.gbp.sync(projectId);
    return {
      syncedAt: result.syncedAt,
      reviews: result.counts.reviews,
      refusedSources: result.failedSources,
    };
  }

  async getReviews(projectId: string) {
    return this.prisma.localReview.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async draftReply(projectId: string, reviewId: string, tone?: string) {
    const review = await this.prisma.localReview.findUnique({
      where: { id: reviewId },
    });

    if (!review || review.projectId !== projectId) {
      throw new NotFoundException('Review not found.');
    }

    const business = await this.prisma.localLocation.findFirst({
      where: { projectId },
    });

    const businessName = business?.businessName || 'our business';

    let toneInstruction = 'Maintain a courteous, polished, and professional tone.';
    if (tone === 'WARM') {
      toneInstruction = 'Adopt a warm, heartfelt, community-oriented tone that conveys genuine appreciation and connection.';
    } else if (tone === 'DE_ESCALATION') {
      toneInstruction = 'Adopt an empathetic, reassuring, solution-oriented tone. Express genuine care for their experience and focus on resolving dissatisfaction smoothly.';
    }

    const prompt = `
      You are an expert customer service representative and Local SEO specialist.
      Draft a response to the following Google Business Profile review.
      
      Business Name: ${businessName}
      Reviewer: ${review.authorName}
      Rating: ${review.rating} out of 5
      Review Text: ${review.text || '(No text provided)'}
      Brand Tone Requirement: ${toneInstruction}
      
      Guidelines:
      - If it's a 5-star review, thank them sincerely and mention the specific service or product they praised (for SEO).
      - If it's a negative review (1-3 stars), apologize, remain professional, do not argue, and offer a way to resolve it offline (e.g., "Please contact us at support@example.com so we can make this right.").
      - Keep it under 4 sentences.
      - Do not include any JSON wrapping, just the raw text of the reply.
    `;

    const aiResponse = await this.router.generate({ prompt, task: AiTask.FAST });
    const replyText = aiResponse.text;

    const updated = await this.prisma.localReview.update({
      where: { id: reviewId },
      data: { aiDraftedReply: replyText.trim() },
    });

    return updated;
  }

  async publishReply(projectId: string, reviewId: string, replyText: string) {
    const review = await this.prisma.localReview.findUnique({
      where: { id: reviewId },
    });

    if (!review || review.projectId !== projectId) {
      throw new NotFoundException('Review not found.');
    }

    // This used to mark the review PUBLISHED and send nothing, with a comment
    // saying a real app would call Google. The customer's review sat on Google
    // unanswered while the product reported it handled, and there was no way
    // to tell from the outside. The reply is sent first now, and the row is
    // only marked published once Google has accepted it.
    if (!review.googleReviewId) {
      throw new ServiceUnavailableException(
        'This review did not come from a Google Business Profile sync, so there is nowhere to publish a reply to. ' +
          'Only reviews imported from Google can be replied to.',
      );
    }

    const published = await this.gbp.replyToReview(projectId, review.googleReviewId, replyText);

    return this.prisma.localReview.update({
      where: { id: reviewId },
      data: {
        aiDraftedReply: replyText,
        googleReplyText: published.comment,
        googleReplyUpdatedAt: published.updateTime,
        replyStatus: 'PUBLISHED',
      },
    });
  }
}
