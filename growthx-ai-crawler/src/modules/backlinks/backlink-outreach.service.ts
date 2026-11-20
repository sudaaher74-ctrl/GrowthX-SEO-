import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type OutreachKind = 'LOST_LINK_RECOVERY' | 'COMPETITOR_GAP';
export type OutreachStatus = 'IDENTIFIED' | 'DRAFTED' | 'CONTACTED' | 'RECOVERED' | 'DISMISSED';

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  }
}

@Injectable()
export class BacklinkOutreachService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists persisted outreach items plus automatically discovered Lost Backlink
   * and Competitor Link Gap candidates from the project's real backlink table.
   */
  async listWorkspace(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, websites: { select: { domain: true }, take: 1 } },
    });
    if (!project) throw new NotFoundException('Project not found.');

    const [items, lostLinks, competitorLinks] = await Promise.all([
      this.prisma.backlinkOutreachItem.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.backlink.findMany({
        where: {
          source: { projectId },
          targetKind: 'OWN',
          OR: [
            { lostConfirmedAt: { not: null } },
            { status: { in: ['LOST', 'MISSING', 'CONFIRMED_LOST'] } },
          ],
        },
        include: { source: { select: { sourceUrl: true } } },
        orderBy: { lostConfirmedAt: 'desc' },
        take: 25,
      }),
      this.prisma.backlink.findMany({
        where: {
          source: { projectId },
          targetKind: 'COMPETITOR',
          status: 'VERIFIED',
        },
        include: { source: { select: { sourceUrl: true } } },
        orderBy: { lastVerifiedAt: 'desc' },
        take: 25,
      }),
    ]);

    const trackedUrls = new Set(items.map((i) => i.sourceUrl.toLowerCase()));

    const candidates: Array<{
      kind: OutreachKind;
      sourceUrl: string;
      sourceDomain: string;
      targetUrl: string | null;
      reason: string;
    }> = [];

    for (const link of lostLinks) {
      const url = link.source.sourceUrl;
      if (trackedUrls.has(url.toLowerCase())) continue;
      trackedUrls.add(url.toLowerCase());
      candidates.push({
        kind: 'LOST_LINK_RECOVERY',
        sourceUrl: url,
        sourceDomain: extractDomain(url),
        targetUrl: link.targetUrl,
        reason: link.lostConfirmedAt
          ? `Confirmed lost on ${link.lostConfirmedAt.toISOString().slice(0, 10)}`
          : `Link status: ${link.status}`,
      });
    }

    for (const link of competitorLinks) {
      const url = link.source.sourceUrl;
      if (trackedUrls.has(url.toLowerCase())) continue;
      trackedUrls.add(url.toLowerCase());
      candidates.push({
        kind: 'COMPETITOR_GAP',
        sourceUrl: url,
        sourceDomain: extractDomain(url),
        targetUrl: project.websites[0]?.domain ? `https://${project.websites[0].domain}/` : null,
        reason: `Verified link to competitor (${link.targetHost})`,
      });
    }

    const summary = {
      totalTracked: items.length,
      identified: items.filter((i) => i.status === 'IDENTIFIED').length,
      drafted: items.filter((i) => i.status === 'DRAFTED').length,
      contacted: items.filter((i) => i.status === 'CONTACTED').length,
      recovered: items.filter((i) => i.status === 'RECOVERED').length,
      lostCandidates: candidates.filter((c) => c.kind === 'LOST_LINK_RECOVERY').length,
      gapCandidates: candidates.filter((c) => c.kind === 'COMPETITOR_GAP').length,
    };

    return {
      summary,
      items: items.map((i) => ({
        id: i.id,
        projectId: i.projectId,
        kind: i.kind as OutreachKind,
        sourceUrl: i.sourceUrl,
        sourceDomain: i.sourceDomain,
        targetUrl: i.targetUrl,
        contactEmail: i.contactEmail,
        status: i.status as OutreachStatus,
        subject: i.subject,
        emailDraft: i.emailDraft,
        notes: i.notes,
        lastContactedAt: i.lastContactedAt?.toISOString() ?? null,
        recoveredAt: i.recoveredAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
      candidates: candidates.slice(0, 20),
    };
  }

  /**
   * Creates or refreshes a grounded outreach/recovery draft backed strictly by
   * the real referring URL, target page URL, and project brand/domain.
   */
  async createOrDraftItem(
    projectId: string,
    input: {
      kind: OutreachKind;
      sourceUrl: string;
      targetUrl?: string | null;
      contactEmail?: string | null;
      notes?: string | null;
    },
  ) {
    const sourceUrl = (input.sourceUrl || '').trim();
    if (!sourceUrl) throw new BadRequestException('Referring sourceUrl is required.');

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, websites: { select: { domain: true }, take: 1 } },
    });
    if (!project) throw new NotFoundException('Project not found.');

    const sourceDomain = extractDomain(sourceUrl);
    const brandName = project.name;
    const ownDomain = project.websites[0]?.domain || project.name;
    const targetUrl =
      (input.targetUrl || '').trim() ||
      (project.websites[0]?.domain ? `https://${project.websites[0].domain}/` : `https://${ownDomain}/`);

    const isRecovery = input.kind === 'LOST_LINK_RECOVERY';
    const subject = isRecovery
      ? `Quick note about the link on ${sourceDomain}`
      : `Resource suggestion for your page on ${sourceDomain}`;

    const emailDraft = isRecovery
      ? [
          `Hi ${sourceDomain} team,`,
          ``,
          `I noticed that your page (${sourceUrl}) previously linked to our resource at ${targetUrl}, and it looks like the link was recently removed or changed during an update.`,
          ``,
          `That page on ${ownDomain} is still live and actively maintained. If the removal was unintentional, we would really appreciate it if you could restore the link for your readers:`,
          `URL: ${targetUrl}`,
          ``,
          `Happy to share an updated summary or alternate URL if helpful.`,
          ``,
          `Best regards,`,
          `${brandName} Team`,
        ].join('\n')
      : [
          `Hi ${sourceDomain} team,`,
          ``,
          `I came across your article at ${sourceUrl} while researching resources in this category and noticed you reference similar providers.`,
          ``,
          `We maintain an up-to-date resource at ${brandName} (${targetUrl}) that could be a helpful addition for your readers comparing options.`,
          ``,
          `If you're open to updating the page, feel free to take a look — happy to provide any factual details or clarifications you need.`,
          ``,
          `Best regards,`,
          `${brandName} Team`,
        ].join('\n');

    const saved = await this.prisma.backlinkOutreachItem.upsert({
      where: { projectId_sourceUrl: { projectId, sourceUrl } },
      create: {
        projectId,
        kind: input.kind,
        sourceUrl,
        sourceDomain,
        targetUrl,
        contactEmail: input.contactEmail?.trim() || null,
        status: 'DRAFTED',
        subject,
        emailDraft,
        notes: input.notes?.trim() || null,
      },
      update: {
        kind: input.kind,
        targetUrl,
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        subject,
        emailDraft,
        status: 'DRAFTED',
      },
    });

    return {
      ...saved,
      lastContactedAt: saved.lastContactedAt?.toISOString() ?? null,
      recoveredAt: saved.recoveredAt?.toISOString() ?? null,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  async updateItem(
    projectId: string,
    itemId: string,
    input: {
      status?: OutreachStatus;
      contactEmail?: string | null;
      subject?: string | null;
      emailDraft?: string | null;
      notes?: string | null;
      targetUrl?: string | null;
    },
  ) {
    const existing = await this.prisma.backlinkOutreachItem.findFirst({
      where: { id: itemId, projectId },
    });
    if (!existing) throw new NotFoundException('Outreach item not found.');

    const now = new Date();
    const nextStatus = input.status ?? (existing.status as OutreachStatus);

    const updated = await this.prisma.backlinkOutreachItem.update({
      where: { id: itemId },
      data: {
        status: nextStatus,
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail?.trim() || null } : {}),
        ...(input.subject !== undefined ? { subject: input.subject?.trim() || null } : {}),
        ...(input.emailDraft !== undefined ? { emailDraft: input.emailDraft } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.targetUrl !== undefined ? { targetUrl: input.targetUrl?.trim() || null } : {}),
        ...(nextStatus === 'CONTACTED' && !existing.lastContactedAt ? { lastContactedAt: now } : {}),
        ...(nextStatus === 'RECOVERED' && !existing.recoveredAt ? { recoveredAt: now } : {}),
      },
    });

    // Record recovered/won backlinks in the Fix Impact Ledger so Monthly Reports pick them up
    if (
      nextStatus === 'RECOVERED' &&
      existing.status !== 'RECOVERED' &&
      this.prisma.fixImpactLedgerEvent?.create
    ) {
      await this.prisma.fixImpactLedgerEvent
        .create({
          data: {
            projectId,
            eventType: 'BACKLINK_RECOVERED',
            title:
              existing.kind === 'LOST_LINK_RECOVERY'
                ? `Recovered lost backlink from ${existing.sourceDomain}`
                : `Won backlink placement on ${existing.sourceDomain}`,
            description: `Outreach confirmed live link from ${existing.sourceUrl} pointing to ${updated.targetUrl || 'site'}.`,
            actor: 'BACKLINK_OUTREACH',
            affectedUrl: existing.sourceUrl,
            verificationStatus: 'RECOVERED',
            evidenceData: {
              outreachId: existing.id,
              kind: existing.kind,
              sourceUrl: existing.sourceUrl,
              targetUrl: updated.targetUrl,
            },
          },
        })
        .catch(() => null);
    }

    return {
      ...updated,
      lastContactedAt: updated.lastContactedAt?.toISOString() ?? null,
      recoveredAt: updated.recoveredAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteItem(projectId: string, itemId: string) {
    const existing = await this.prisma.backlinkOutreachItem.findFirst({
      where: { id: itemId, projectId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Outreach item not found.');
    await this.prisma.backlinkOutreachItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }
}
