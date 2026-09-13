import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DesignStudioPublishMethod, DesignStudioStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { SlotExtractorService } from './slot-extractor.service';
import { scoreDesignFit, RiskLevel } from './design-fit.util';

/**
 * Design Studio: review an AI content change against the customer's real page
 * before it ships.
 *
 * The rule that shapes this whole service: a status is a claim about the
 * customer's live site, so it is only written once the thing it claims has
 * actually happened. `PUBLISHED` requires a successful deploy, `VERIFIED`
 * requires a re-crawl that found the content. A request being accepted is
 * never enough. Where a step cannot complete — no repository connected, no
 * snapshot captured — the call fails with a sentence the UI can show, rather
 * than recording an optimistic status nobody will revisit.
 */
@Injectable()
export class DesignStudioService {
  private readonly logger = new Logger(DesignStudioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly slotExtractor: SlotExtractorService,
    private readonly ai: MultiAiRouterService,
  ) {}

  // ── Overview ────────────────────────────────────────────────────────────

  /**
   * The four summary cards. Every figure is a count of real rows; there is no
   * fallback value, because "we have not looked yet" and "there are none" must
   * not render the same.
   */
  async getOverview(projectId: string) {
    const [suggestions, safeToPublish, needReview, published, latestSnapshot, repository] =
      await Promise.all([
        this.prisma.contentSuggestion.count({ where: { projectId } }),
        this.prisma.contentSuggestion.count({
          where: { projectId, designFitScore: { gte: 90 } },
        }),
        this.prisma.contentSuggestion.count({
          where: { projectId, designFitScore: { gte: 75, lt: 90 } },
        }),
        this.prisma.publishedChange.count({
          where: { projectId, status: { in: [DesignStudioStatus.PUBLISHED, DesignStudioStatus.VERIFIED] } },
        }),
        this.prisma.pageSnapshot.findFirst({
          where: { projectId },
          orderBy: { capturedAt: 'desc' },
          select: { id: true, pageUrl: true, capturedAt: true },
        }),
        this.prisma.siteRepository.findUnique({ where: { projectId }, select: { owner: true, name: true } }),
      ]);

    return {
      counts: { suggestions, safeToPublish, needReview, published },
      lastSnapshot: latestSnapshot,
      // "Connected" here means a publishing target exists, which is the only
      // sense in which this product is connected to the live site.
      connection: repository
        ? { connected: true, target: `${repository.owner}/${repository.name}` }
        : { connected: false, target: null },
    };
  }

  // ── Analyze ─────────────────────────────────────────────────────────────

  /**
   * Build a PageSnapshot from the most recent crawl of a page, and extract its
   * editable slots.
   *
   * Reads the HTML the crawler already stored rather than re-fetching: the
   * preview must reflect the page as crawled, so that what the reviewer
   * approves is what was scored.
   */
  async analyze(projectId: string, pageUrl?: string) {
    const page = await this.findCrawledPage(projectId, pageUrl);
    if (!page) {
      throw new NotFoundException(
        pageUrl
          ? `No crawled snapshot for ${pageUrl}. Run a crawl for this project first.`
          : 'This project has no crawled pages yet. Run a crawl before using Design Studio.',
      );
    }
    if (!page.htmlSnapshotUrl) {
      throw new NotFoundException(
        `${page.url} was crawled but no HTML snapshot was stored, so it cannot be previewed.`,
      );
    }

    const html = await this.storage.readSnapshot(page.htmlSnapshotUrl);
    if (!html) {
      throw new NotFoundException(
        `The stored snapshot for ${page.url} could not be read. Re-crawl the page to capture it again.`,
      );
    }

    const extracted = this.slotExtractor.extract(html);

    const snapshot = await this.prisma.pageSnapshot.create({
      data: {
        projectId,
        pageUrl: page.url,
        htmlSnapshotUrl: page.htmlSnapshotUrl,
        // Screenshot capture does not exist in the crawler yet. Null rather
        // than a placeholder, so the UI says "not captured" honestly.
        desktopScreenshotUrl: null,
        mobileScreenshotUrl: null,
        capturedStyles: extracted.styles as object,
        capturedSections: extracted.sections as object,
        slots: {
          create: extracted.slots.map((slot) => ({
            domSelector: slot.domSelector,
            sectionType: slot.sectionType,
            currentText: slot.currentText,
            maxWords: slot.maxWords,
            maxChars: slot.maxChars,
            maxDesktopLines: slot.maxDesktopLines,
            maxMobileLines: slot.maxMobileLines,
            allowedHtml: slot.allowedHtml,
            safeToEdit: slot.safeToEdit,
            confidence: slot.confidence,
          })),
        },
      },
      include: { slots: true },
    });

    return snapshot;
  }

  async listSlots(projectId: string, snapshotId: string) {
    const snapshot = await this.prisma.pageSnapshot.findFirst({
      where: { id: snapshotId, projectId },
      include: { slots: { orderBy: { confidence: 'desc' } } },
    });
    if (!snapshot) throw new NotFoundException('Page snapshot not found for this project.');
    return snapshot.slots;
  }

  /** The raw stored HTML, for the preview iframe. */
  async getSnapshotHtml(projectId: string, snapshotId: string) {
    const snapshot = await this.prisma.pageSnapshot.findFirst({
      where: { id: snapshotId, projectId },
    });
    if (!snapshot?.htmlSnapshotUrl) {
      throw new NotFoundException('No stored HTML for this snapshot.');
    }
    const html = await this.storage.readSnapshot(snapshot.htmlSnapshotUrl);
    if (!html) throw new NotFoundException('The stored HTML for this snapshot could not be read.');
    return { html, pageUrl: snapshot.pageUrl, capturedAt: snapshot.capturedAt };
  }

  // ── Generate ────────────────────────────────────────────────────────────

  async generate(
    projectId: string,
    input: {
      snapshotId: string;
      slotId?: string;
      contentType?: string;
      variant?: string;
      targetKeyword?: string;
      lockedPhrases?: string[];
      seoIssue?: string;
      recommendedLocation?: string;
      organizationId?: string;
    },
  ) {
    const snapshot = await this.prisma.pageSnapshot.findFirst({
      where: { id: input.snapshotId, projectId },
      include: { slots: true },
    });
    if (!snapshot) throw new NotFoundException('Page snapshot not found for this project.');

    const slot = input.slotId
      ? snapshot.slots.find((s) => s.id === input.slotId)
      : snapshot.slots.find((s) => s.safeToEdit);
    if (!slot) {
      throw new BadRequestException(
        'No editable section was found on this page. Design Studio will not edit navigation, headers or shared components.',
      );
    }

    const completion = await this.ai.generate({
      organizationId: input.organizationId,
      projectId,
      systemInstruction:
        'You write on-page SEO content that must fit inside an existing website design. ' +
        'Match the tone and vocabulary of the surrounding copy. Return JSON only.',
      prompt: this.generationPrompt(snapshot.pageUrl, slot, input),
      jsonSchema: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          body: { type: 'string' },
          seoIssue: { type: 'string' },
        },
        required: ['heading', 'body'],
      },
      maxTokens: 1200,
    });

    if (completion.refused) {
      throw new BadRequestException('The AI provider declined to generate this content.');
    }

    const parsed = this.parseGenerated(completion.text);

    return this.prisma.contentSuggestion.create({
      data: {
        projectId,
        pageSnapshotId: snapshot.id,
        slotId: slot.id,
        title: parsed.heading.slice(0, 120),
        seoIssue: input.seoIssue ?? parsed.seoIssue ?? 'Thin content detected',
        recommendedLocation: input.recommendedLocation ?? this.locationFor(slot.sectionType),
        currentWordCount: this.countWords(slot.currentText),
        suggestedWordCount: this.countWords(parsed.body),
        contentType: input.contentType ?? slot.sectionType,
        heading: parsed.heading,
        body: parsed.body,
        variant: input.variant,
        targetKeyword: input.targetKeyword,
        lockedPhrases: input.lockedPhrases ?? [],
        status: DesignStudioStatus.SUGGESTED,
      },
      include: { slot: true },
    });
  }

  async listSuggestions(projectId: string, filter?: { status?: string; contentType?: string }) {
    return this.prisma.contentSuggestion.findMany({
      where: {
        projectId,
        ...(filter?.status ? { status: filter.status as DesignStudioStatus } : {}),
        ...(filter?.contentType ? { contentType: filter.contentType } : {}),
      },
      include: { slot: true, pageSnapshot: { select: { pageUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Preview ─────────────────────────────────────────────────────────────

  /**
   * Score a suggestion and record the result. Edits made in the inspector are
   * passed as overrides so the reviewer scores what they are about to approve,
   * not what was first generated.
   */
  async preview(
    projectId: string,
    suggestionId: string,
    overrides?: { heading?: string; body?: string },
  ) {
    const suggestion = await this.requireSuggestion(projectId, suggestionId);
    const slot = suggestion.slot;

    const body = overrides?.body ?? suggestion.body;
    const heading = overrides?.heading ?? suggestion.heading;

    const result = scoreDesignFit(
      { heading, body, htmlTags: ['p'] },
      {
        maxWords: slot?.maxWords,
        maxChars: slot?.maxChars,
        maxDesktopLines: slot?.maxDesktopLines,
        maxMobileLines: slot?.maxMobileLines,
        allowedHtml: slot?.allowedHtml,
        currentText: slot?.currentText,
        // Null until a rendered capture measures them — see design-fit.util.
        desktopCharsPerLine: null,
        mobileCharsPerLine: null,
      },
      (suggestion.seoValue as RiskLevel | null) ?? null,
    );

    const [preview] = await this.prisma.$transaction([
      this.prisma.previewResult.create({
        data: {
          suggestionId,
          designFitScore: result.score ?? 0,
          scoreBreakdown: { factors: result.factors, label: result.label } as object,
          safetyChecks: result.checks as object,
          blockingIssues: result.blockingIssues,
        },
      }),
      this.prisma.contentSuggestion.update({
        where: { id: suggestionId },
        data: {
          ...(overrides?.body ? { body: overrides.body, suggestedWordCount: this.countWords(overrides.body) } : {}),
          ...(overrides?.heading ? { heading: overrides.heading } : {}),
          designFitScore: result.score,
          mobileRisk: result.mobileRisk,
          status: DesignStudioStatus.PREVIEWED,
        },
      }),
    ]);

    return { preview, score: result };
  }

  // ── Approve ─────────────────────────────────────────────────────────────

  async approve(
    projectId: string,
    suggestionId: string,
    input: { publishMethod: DesignStudioPublishMethod; userId?: string; notes?: string },
  ) {
    const suggestion = await this.requireSuggestion(projectId, suggestionId);

    const latestPreview = await this.prisma.previewResult.findFirst({
      where: { suggestionId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latestPreview) {
      throw new BadRequestException('Preview this change before approving it.');
    }
    if (latestPreview.blockingIssues.length > 0) {
      // The whole point of the gate: a blocked change cannot be approved past.
      throw new BadRequestException(latestPreview.blockingIssues[0]);
    }

    const approval = await this.prisma.approvalRecord.upsert({
      where: { suggestionId },
      create: {
        suggestionId,
        approvedByUserId: input.userId,
        publishMethod: input.publishMethod,
        notes: input.notes,
      },
      update: { publishMethod: input.publishMethod, notes: input.notes },
    });

    await this.prisma.contentSuggestion.update({
      where: { id: suggestion.id },
      data: { status: DesignStudioStatus.APPROVED },
    });

    return approval;
  }

  // ── Publish ─────────────────────────────────────────────────────────────

  /**
   * Route an approved change to its publishing target.
   *
   * Only the targets that genuinely complete here write a terminal status.
   * CMS_DRAFT and DEVELOPER_HANDOFF finish as APPROVED — the change is queued
   * for a human, and nothing is live. GITHUB_PR and DIRECT need a repository
   * patch strategy that this service does not own yet; rather than invent a
   * pull request URL, they fail with the reason.
   */
  async publish(projectId: string, suggestionId: string) {
    const suggestion = await this.requireSuggestion(projectId, suggestionId);
    const approval = await this.prisma.approvalRecord.findUnique({ where: { suggestionId } });
    if (!approval) throw new BadRequestException('This change has not been approved.');

    const beforeContent = suggestion.slot?.currentText ?? '';
    const afterContent = [suggestion.heading, suggestion.body].filter(Boolean).join('\n\n');

    const base = {
      projectId,
      suggestionId,
      pageUrl: suggestion.pageSnapshot.pageUrl,
      method: approval.publishMethod,
      beforeContent,
      afterContent,
    };

    if (
      approval.publishMethod === DesignStudioPublishMethod.CMS_DRAFT ||
      approval.publishMethod === DesignStudioPublishMethod.DEVELOPER_HANDOFF
    ) {
      const change = await this.prisma.publishedChange.upsert({
        where: { suggestionId },
        create: { ...base, status: DesignStudioStatus.APPROVED },
        update: { status: DesignStudioStatus.APPROVED, error: null },
      });
      return change;
    }

    const repository = await this.prisma.siteRepository.findUnique({ where: { projectId } });
    const error = !repository
      ? 'No repository is connected to this project. Connect one in Integrations, or publish as a CMS draft.'
      : 'Repository publishing for Design Studio content is not wired up yet. ' +
        'Use CMS draft or developer handoff, or apply the diff from the pull request body manually.';

    const change = await this.prisma.publishedChange.upsert({
      where: { suggestionId },
      create: { ...base, status: DesignStudioStatus.FAILED, error },
      update: { status: DesignStudioStatus.FAILED, error },
    });
    await this.prisma.contentSuggestion.update({
      where: { id: suggestionId },
      data: { status: DesignStudioStatus.FAILED },
    });
    return change;
  }

  async listPublished(projectId: string) {
    return this.prisma.publishedChange.findMany({
      where: { projectId },
      include: {
        suggestion: { select: { title: true, contentType: true, designFitScore: true } },
        verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
        rollbacks: { orderBy: { rolledBackAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Verify ──────────────────────────────────────────────────────────────

  /**
   * Check a published change against the latest crawl of its page.
   *
   * VERIFIED is written only when the new text is actually found in a snapshot
   * captured after the change went out. A crawl older than the change proves
   * nothing and is reported as such.
   */
  async verify(projectId: string, publishedChangeId: string) {
    const change = await this.prisma.publishedChange.findFirst({
      where: { id: publishedChangeId, projectId },
      include: { suggestion: true },
    });
    if (!change) throw new NotFoundException('Published change not found for this project.');

    const page = await this.findCrawledPage(projectId, change.pageUrl);
    const html = page?.htmlSnapshotUrl ? await this.storage.readSnapshot(page.htmlSnapshotUrl) : null;

    const crawledAfterChange =
      Boolean(page && change.publishedAt && page.crawledAt > change.publishedAt);

    const needle = change.afterContent.replace(/\s+/g, ' ').trim().slice(0, 120);
    const contentFound = Boolean(
      html && needle && html.replace(/\s+/g, ' ').toLowerCase().includes(needle.toLowerCase()),
    );

    const status =
      contentFound && crawledAfterChange ? DesignStudioStatus.VERIFIED : change.status;

    const verification = await this.prisma.verificationResult.create({
      data: {
        publishedChangeId,
        recrawledAt: page?.crawledAt ?? null,
        contentFound,
        seoResult: {
          crawledAfterChange,
          checkedUrl: change.pageUrl,
          note: !page
            ? 'This page has not been crawled since publishing.'
            : !crawledAfterChange
              ? 'The most recent crawl predates this change, so it cannot confirm it.'
              : contentFound
                ? 'The published content was found on the live page.'
                : 'The published content was not found on the live page.',
        } as object,
        // Visual verification needs a rendered capture, which does not exist
        // yet. Recording the absence beats recording a pass nobody measured.
        visualResult: { available: false, reason: 'No rendered capture is available for this page.' } as object,
        status,
      },
    });

    if (status !== change.status) {
      await this.prisma.publishedChange.update({ where: { id: change.id }, data: { status } });
      await this.prisma.contentSuggestion.update({
        where: { id: change.suggestionId },
        data: { status },
      });
    }

    return verification;
  }

  // ── Rollback ────────────────────────────────────────────────────────────

  async rollback(projectId: string, publishedChangeId: string, reason?: string) {
    const change = await this.prisma.publishedChange.findFirst({
      where: { id: publishedChangeId, projectId },
    });
    if (!change) throw new NotFoundException('Published change not found for this project.');

    // A draft or handoff never reached the site, so there is nothing live to
    // revert — the record is withdrawn instead, and says so.
    const revertible =
      change.method === DesignStudioPublishMethod.CMS_DRAFT ||
      change.method === DesignStudioPublishMethod.DEVELOPER_HANDOFF;

    const record = await this.prisma.rollbackRecord.create({
      data: {
        publishedChangeId,
        reason,
        succeeded: revertible,
        error: revertible
          ? null
          : 'This change was never deployed, so there is nothing live to roll back.',
      },
    });

    if (revertible) {
      await this.prisma.publishedChange.update({
        where: { id: change.id },
        data: { status: DesignStudioStatus.ROLLED_BACK },
      });
      await this.prisma.contentSuggestion.update({
        where: { id: change.suggestionId },
        data: { status: DesignStudioStatus.ROLLED_BACK },
      });
    }

    return record;
  }

  // ── History ─────────────────────────────────────────────────────────────

  /** Every recorded event for this project, newest first. */
  async history(projectId: string) {
    const [suggestions, previews, approvals, changes, verifications, rollbacks] = await Promise.all([
      this.prisma.contentSuggestion.findMany({
        where: { projectId },
        select: { id: true, title: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.previewResult.findMany({
        where: { suggestion: { projectId } },
        select: { id: true, suggestionId: true, createdAt: true, designFitScore: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.approvalRecord.findMany({
        where: { suggestion: { projectId } },
        select: { id: true, suggestionId: true, approvedAt: true, publishMethod: true },
        orderBy: { approvedAt: 'desc' },
        take: 100,
      }),
      this.prisma.publishedChange.findMany({
        where: { projectId },
        select: { id: true, suggestionId: true, createdAt: true, status: true, pageUrl: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.verificationResult.findMany({
        where: { publishedChange: { projectId } },
        select: { id: true, publishedChangeId: true, createdAt: true, contentFound: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.rollbackRecord.findMany({
        where: { publishedChange: { projectId } },
        select: { id: true, publishedChangeId: true, rolledBackAt: true, succeeded: true },
        orderBy: { rolledBackAt: 'desc' },
        take: 100,
      }),
    ]);

    const events = [
      ...suggestions.map((s) => ({ kind: 'SUGGESTION_GENERATED', at: s.createdAt, label: s.title, ref: s.id })),
      ...previews.map((p) => ({ kind: 'PREVIEW_CREATED', at: p.createdAt, label: `Design Fit ${p.designFitScore}/100`, ref: p.suggestionId })),
      ...approvals.map((a) => ({ kind: 'USER_APPROVED', at: a.approvedAt, label: a.publishMethod, ref: a.suggestionId })),
      ...changes.map((c) => ({ kind: `CHANGE_${c.status}`, at: c.createdAt, label: c.pageUrl, ref: c.id })),
      ...verifications.map((v) => ({ kind: 'SEO_VERIFIED', at: v.createdAt, label: v.contentFound ? 'Content found live' : 'Content not found', ref: v.publishedChangeId })),
      ...rollbacks.map((r) => ({ kind: 'ROLLBACK', at: r.rolledBackAt, label: r.succeeded ? 'Rolled back' : 'Rollback failed', ref: r.publishedChangeId })),
    ];

    return events.sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async requireSuggestion(projectId: string, suggestionId: string) {
    const suggestion = await this.prisma.contentSuggestion.findFirst({
      where: { id: suggestionId, projectId },
      include: { slot: true, pageSnapshot: true },
    });
    if (!suggestion) throw new NotFoundException('Suggestion not found for this project.');
    return suggestion;
  }

  /** The most recent crawl of a page on this project. */
  private async findCrawledPage(projectId: string, pageUrl?: string) {
    return this.prisma.page.findFirst({
      where: {
        crawlJob: { website: { projectId } },
        ...(pageUrl ? { url: pageUrl } : {}),
        statusCode: { gte: 200, lt: 300 },
      },
      orderBy: { crawledAt: 'desc' },
    });
  }

  private countWords(text: string | null | undefined): number {
    const trimmed = (text ?? '').trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  private locationFor(sectionType: string): string {
    switch (sectionType) {
      case 'HERO':
        return 'Below the hero section';
      case 'FAQ':
        return 'Above the FAQ section';
      case 'SPECS':
        return 'Beside the product specifications';
      case 'CTA':
        return 'Above the closing call to action';
      default:
        return 'Below the hero section';
    }
  }

  private generationPrompt(
    pageUrl: string,
    slot: { sectionType: string; currentText: string; maxWords: number | null },
    input: { variant?: string; targetKeyword?: string; lockedPhrases?: string[] },
  ): string {
    const lines = [
      `Page: ${pageUrl}`,
      `Section type: ${slot.sectionType}`,
      slot.maxWords ? `Hard limit: ${slot.maxWords} words.` : null,
      input.variant ? `Tone: ${input.variant}.` : null,
      input.targetKeyword ? `Target keyword: ${input.targetKeyword}.` : null,
      input.lockedPhrases?.length
        ? `These phrases must appear verbatim: ${input.lockedPhrases.join('; ')}.`
        : null,
      '',
      'Surrounding copy on this page, for tone and vocabulary:',
      slot.currentText.slice(0, 1500) || '(this section is currently empty)',
      '',
      'Return JSON with "heading" and "body". Plain prose in "body" — no HTML.',
    ];
    return lines.filter((l) => l !== null).join('\n');
  }

  private parseGenerated(text: string): { heading: string; body: string; seoIssue?: string } {
    try {
      const parsed = JSON.parse(text) as { heading?: string; body?: string; seoIssue?: string };
      if (parsed.heading && parsed.body) {
        return { heading: parsed.heading, body: parsed.body, seoIssue: parsed.seoIssue };
      }
    } catch {
      // Fall through to the extraction below.
    }

    // Some providers wrap JSON in prose or a code fence.
    const match = /\{[\s\S]*\}/.exec(text);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as { heading?: string; body?: string; seoIssue?: string };
        if (parsed.heading && parsed.body) {
          return { heading: parsed.heading, body: parsed.body, seoIssue: parsed.seoIssue };
        }
      } catch {
        // Fall through.
      }
    }

    throw new BadRequestException(
      'The AI provider returned content this service could not read. Try generating again.',
    );
  }
}
