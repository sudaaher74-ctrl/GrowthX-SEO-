import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  async syncReviews(projectId: string) {
    const existingCount = await this.prisma.localReview.count({
      where: { projectId },
    });

    if (existingCount > 0) {
      return { message: 'Reviews are already synced.', count: existingCount };
    }

    // Generate mock reviews since we don't have OAuth setup for real GBP yet.
    const mockReviews = [
      {
        authorName: 'Sarah Jenkins',
        rating: 5,
        text: 'Absolutely fantastic service! The team was prompt, professional, and went above and beyond my expectations.',
        time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        relativeTime: '2 days ago',
      },
      {
        authorName: 'Michael Chen',
        rating: 4,
        text: 'Great experience overall. Just wish the onboarding process was slightly faster, but otherwise very satisfied.',
        time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        relativeTime: '1 week ago',
      },
      {
        authorName: 'Amanda Roberts',
        rating: 1,
        text: 'Very disappointed. Did not return my calls and when they finally did, the person on the phone was rude.',
        time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
        relativeTime: '2 weeks ago',
      },
      {
        authorName: 'David Wright',
        rating: 5,
        text: 'Best in the business. Highly recommended for anyone looking for reliable experts.',
        time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        relativeTime: '1 month ago',
      },
      {
        authorName: 'Emma Thompson',
        rating: 3,
        text: 'Decent, but a bit pricey for what you get. The quality is there though.',
        time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
        relativeTime: '1 month ago',
      }
    ];

    await this.prisma.localReview.createMany({
      data: mockReviews.map((r) => ({ ...r, projectId })),
    });

    return { message: 'Synced mock reviews successfully.', count: mockReviews.length };
  }

  async getReviews(projectId: string) {
    return this.prisma.localReview.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async draftReply(projectId: string, reviewId: string) {
    const review = await this.prisma.localReview.findUnique({
      where: { id: reviewId },
    });

    if (!review || review.projectId !== projectId) {
      throw new NotFoundException('Review not found.');
    }

    const business = await this.prisma.localLocation.findUnique({
      where: { projectId },
    });

    const businessName = business?.businessName || 'our business';

    const prompt = `
      You are an expert customer service representative and Local SEO specialist.
      Draft a professional, polite, and SEO-optimized response to the following Google Business Profile review.
      
      Business Name: ${businessName}
      Reviewer: ${review.authorName}
      Rating: ${review.rating} out of 5
      Review Text: ${review.text || '(No text provided)'}
      
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

    // In a real app, this would hit the Google My Business API to post the reply.
    // For now, we just mark it as published.
    return this.prisma.localReview.update({
      where: { id: reviewId },
      data: {
        aiDraftedReply: replyText,
        replyStatus: 'PUBLISHED',
      },
    });
  }
}
