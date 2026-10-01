import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { OAuth2Client } from 'googleapis-common';
import { PrismaService } from '../../../database/prisma.service';
import { parseTime, formatDate, starRating } from './business-profile.helpers';

/**
 * Handles communication with Google's legacy My Business v4 API.
 *
 * Reviews, media and local posts live only here — they were never carried over
 * to the newer Google Business Profile APIs, so they are fetched over plain HTTPS.
 */
@Injectable()
export class BusinessProfileV4Service {
  /** Reviews, media and local posts live only here. */
  static readonly V4_BASE = 'https://mybusiness.googleapis.com/v4';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The v4 endpoints, over plain HTTPS.
   *
   * Reviews, media and local posts have no SDK client at all — they were never
   * carried over from the deprecated Google My Business v4 API, and Google has
   * published no replacement. The access token comes from the same OAuth2
   * client every other call uses, so it is refreshed and re-encrypted by the
   * one handler that owns that.
   */
  async v4(
    auth: OAuth2Client,
    path: string,
    options: { query?: Record<string, string>; method?: string; body?: unknown } = {},
  ): Promise<any> {
    const { token } = await auth.getAccessToken();
    if (!token) {
      throw new ServiceUnavailableException('Google did not return an access token for this connection.');
    }

    const url = new URL(`${BusinessProfileV4Service.V4_BASE}/${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);

    const response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      let detail = '';
      let googleError: any = null;
      try {
        googleError = JSON.parse(body)?.error ?? null;
        detail = googleError?.message ?? '';
      } catch {
        detail = body.slice(0, 300);
      }
      const error: any = new Error(detail || `Google returned HTTP ${response.status}.`);
      error.status = response.status;
      // The structured error, not just its message: `details` carries the
      // quota limit, which is what tells a 429 of zero from a 429 of busy.
      if (googleError) error.googleError = googleError;
      throw error;
    }

    return response.json();
  }

  /** Every page of a v4 collection. */
  async v4All(
    auth: OAuth2Client,
    path: string,
    collection: string,
    query: Record<string, string> = {},
  ): Promise<any[]> {
    const items: any[] = [];
    let pageToken: string | undefined;
    do {
      const page = await this.v4(auth, path, { query: pageToken ? { ...query, pageToken } : query });
      items.push(...(page?.[collection] ?? []));
      pageToken = page?.nextPageToken;
    } while (pageToken);
    return items;
  }

  async syncReviews(
    projectId: string,
    auth: OAuth2Client,
    accountName: string,
    locationName: string,
    prisma: PrismaService = this.prisma,
  ): Promise<number> {
    const locationId = locationName.split('/').pop();
    const reviews = await this.v4All(auth, `${accountName}/locations/${locationId}/reviews`, 'reviews', {
      pageSize: '50',
    });

    for (const review of reviews) {
      const googleReviewId: string | undefined = review.reviewId ?? review.name?.split('/').pop();
      if (!googleReviewId) continue;

      const values = {
        authorName: review.reviewer?.displayName ?? 'Google user',
        authorPhotoUrl: review.reviewer?.profilePhotoUrl ?? null,
        rating: starRating(review.starRating),
        text: review.comment ?? null,
        // Kept as Google's own timestamp string. LocalReview has always stored
        // these as text and other callers read them that way.
        time: review.createTime ?? '',
        relativeTime: '',
        locationName,
        googleReplyText: review.reviewReply?.comment ?? null,
        googleReplyUpdatedAt: parseTime(review.reviewReply?.updateTime),
        googleUpdateTime: parseTime(review.updateTime),
      };

      await prisma.localReview.upsert({
        where: { projectId_googleReviewId: { projectId, googleReviewId } },
        update: values,
        // replyStatus is left to its default on create and untouched on update:
        // it is this product's own workflow state, and a re-sync must not
        // reset a reply someone already worked on.
        create: { projectId, googleReviewId, ...values },
      });
    }

    return reviews.length;
  }

  async syncMedia(
    projectId: string,
    auth: OAuth2Client,
    accountName: string,
    locationName: string,
    prisma: PrismaService = this.prisma,
  ): Promise<number> {
    const locationId = locationName.split('/').pop();
    const media = await this.v4All(auth, `${accountName}/locations/${locationId}/media`, 'mediaItems', {
      pageSize: '100',
    });

    const names: string[] = [];
    for (const item of media) {
      if (!item.name) continue;
      names.push(item.name);
      const values = {
        locationName,
        mediaFormat: item.mediaFormat ?? null,
        category: item.locationAssociation?.category ?? null,
        googleUrl: item.googleUrl ?? null,
        thumbnailUrl: item.thumbnailUrl ?? null,
        sourceUrl: item.sourceUrl ?? null,
        description: item.description ?? null,
        widthPx: item.dimensions?.widthPixels ?? null,
        heightPx: item.dimensions?.heightPixels ?? null,
        // Absent when Google reports no insights for the item. Left null
        // rather than zeroed — "not reported" is not "never viewed".
        viewCount: item.insights?.viewCount === undefined ? null : Number(item.insights.viewCount),
        // Google attributes an item only when a customer contributed it, so a
        // missing attribution is an absence of information rather than proof
        // the merchant uploaded it. Left null, not guessed at as MERCHANT.
        attribution: item.attribution?.profileName ? 'CUSTOMER' : null,
        createTime: parseTime(item.createTime),
        syncedAt: new Date(),
      };
      await prisma.gbpMedia.upsert({
        where: { projectId_mediaName: { projectId, mediaName: item.name } },
        update: values,
        create: { projectId, mediaName: item.name, ...values },
      });
    }

    // A photo the merchant deleted on Google must stop being shown here.
    await prisma.gbpMedia.deleteMany({
      where: { projectId, locationName, ...(names.length ? { mediaName: { notIn: names } } : {}) },
    });

    return names.length;
  }

  async syncPosts(
    projectId: string,
    auth: OAuth2Client,
    accountName: string,
    locationName: string,
    prisma: PrismaService = this.prisma,
  ): Promise<number> {
    const locationId = locationName.split('/').pop();
    const posts = await this.v4All(auth, `${accountName}/locations/${locationId}/localPosts`, 'localPosts', {
      pageSize: '100',
    });

    const names: string[] = [];
    for (const post of posts) {
      if (!post.name) continue;
      names.push(post.name);
      const values = {
        locationName,
        summary: post.summary ?? null,
        languageCode: post.languageCode ?? null,
        state: post.state ?? null,
        topicType: post.topicType ?? null,
        searchUrl: post.searchUrl ?? null,
        callToActionType: post.callToAction?.actionType ?? null,
        callToActionUrl: post.callToAction?.url ?? null,
        eventTitle: post.event?.title ?? null,
        eventStart: formatDate(post.event?.schedule?.startDate),
        eventEnd: formatDate(post.event?.schedule?.endDate),
        mediaUrls: (post.media ?? [])
          .map((item: any) => item.googleUrl ?? item.sourceUrl)
          .filter((url: unknown): url is string => typeof url === 'string'),
        createTime: parseTime(post.createTime),
        updateTime: parseTime(post.updateTime),
        syncedAt: new Date(),
      };
      await prisma.gbpLocalPost.upsert({
        where: { projectId_postName: { projectId, postName: post.name } },
        update: values,
        create: { projectId, postName: post.name, ...values },
      });
    }

    await prisma.gbpLocalPost.deleteMany({
      where: { projectId, locationName, ...(names.length ? { postName: { notIn: names } } : {}) },
    });

    return names.length;
  }

  async replyToReview(
    auth: OAuth2Client,
    accountName: string,
    locationName: string,
    googleReviewId: string,
    comment: string,
  ): Promise<{ comment: string; updateTime: Date | null }> {
    const locationId = locationName.split('/').pop();
    const response = await this.v4(
      auth,
      `${accountName}/locations/${locationId}/reviews/${googleReviewId}/reply`,
      { method: 'PUT', body: { comment } },
    );
    return {
      comment: response?.comment ?? comment,
      updateTime: parseTime(response?.updateTime),
    };
  }
}
