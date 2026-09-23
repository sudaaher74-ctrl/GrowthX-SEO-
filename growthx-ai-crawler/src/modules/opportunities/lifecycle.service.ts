import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { FindingLifecycle, GrowthOpportunity, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export const ALLOWED_TRANSITIONS: Record<FindingLifecycle, FindingLifecycle[]> = {
  DETECTED: [FindingLifecycle.QUEUED],
  QUEUED: [FindingLifecycle.APPROVED, FindingLifecycle.SNOOZED, FindingLifecycle.DISMISSED, FindingLifecycle.RESOLVED],
  SNOOZED: [FindingLifecycle.QUEUED, FindingLifecycle.DISMISSED],
  DISMISSED: [FindingLifecycle.QUEUED],
  APPROVED: [FindingLifecycle.APPLYING, FindingLifecycle.QUEUED, FindingLifecycle.FAILED],
  APPLYING: [FindingLifecycle.VERIFYING, FindingLifecycle.FAILED],
  VERIFYING: [FindingLifecycle.VERIFIED, FindingLifecycle.FAILED],
  VERIFIED: [FindingLifecycle.MEASURED, FindingLifecycle.QUEUED],
  MEASURED: [FindingLifecycle.QUEUED],
  FAILED: [FindingLifecycle.QUEUED, FindingLifecycle.DISMISSED],
  RESOLVED: [FindingLifecycle.QUEUED],
};

export interface LifecycleActor {
  type: 'USER' | 'SYSTEM';
  id?: string;
}

export interface TransitionOptions {
  reason?: string;
  snoozeUntil?: Date;
}

export interface LifecycleTransitionRecord {
  from: FindingLifecycle;
  to: FindingLifecycle;
  at: string;
  actor: LifecycleActor;
  reason?: string | null;
}

@Injectable()
export class LifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transitions a finding from its current lifecycle state to a new state.
   * Enforces allowed transitions, requires reason for dismissals, and maintains an append-only audit trail.
   */
  async transition(
    findingId: string,
    to: FindingLifecycle,
    actor: LifecycleActor,
    options: TransitionOptions = {},
  ): Promise<GrowthOpportunity> {
    const finding = await this.prisma.growthOpportunity.findUnique({
      where: { id: findingId },
    });

    if (!finding) {
      throw new NotFoundException(`Finding with ID ${findingId} not found`);
    }

    const current = finding.lifecycle;
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];

    if (!allowed.includes(to)) {
      throw new ConflictException(
        `Cannot transition finding ${findingId} from ${current} to ${to}. Allowed transitions: [${allowed.join(', ')}]`,
      );
    }

    if (to === FindingLifecycle.DISMISSED) {
      if (!options.reason || options.reason.trim() === '') {
        throw new BadRequestException('A non-empty reason is required to dismiss a finding');
      }
    }

    if (to === FindingLifecycle.SNOOZED && !options.snoozeUntil) {
      throw new BadRequestException('A snoozeUntil date is required to snooze a finding');
    }

    const now = new Date();
    const transitionRecord: LifecycleTransitionRecord = {
      from: current,
      to,
      at: now.toISOString(),
      actor,
      reason: options.reason?.trim() ?? null,
    };

    const existingTransitions = Array.isArray(finding.transitions)
      ? (finding.transitions as unknown as LifecycleTransitionRecord[])
      : [];

    const updatedTransitions = [...existingTransitions, transitionRecord];

    // Dual-write legacy status
    let legacyStatus = 'OPEN';
    let dismissedAt: Date | null = finding.dismissedAt;

    if (to === FindingLifecycle.DISMISSED) {
      legacyStatus = 'DISMISSED';
      dismissedAt = now;
    } else if (
      to === FindingLifecycle.APPROVED ||
      to === FindingLifecycle.APPLYING ||
      to === FindingLifecycle.VERIFYING ||
      to === FindingLifecycle.VERIFIED ||
      to === FindingLifecycle.MEASURED
    ) {
      legacyStatus = 'ACTIONED';
    } else {
      legacyStatus = 'OPEN';
    }

    return this.prisma.growthOpportunity.update({
      where: { id: findingId },
      data: {
        lifecycle: to,
        status: legacyStatus,
        dismissedAt,
        dismissReason: to === FindingLifecycle.DISMISSED ? options.reason?.trim() : finding.dismissReason,
        snoozeUntil: to === FindingLifecycle.SNOOZED ? options.snoozeUntil : null,
        resolvedAt: to === FindingLifecycle.RESOLVED ? now : finding.resolvedAt,
        lastTransitionAt: now,
        transitions: updatedTransitions as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Periodic / nightly job that awakens snoozed findings whose snoozeUntil date has elapsed,
   * returning them to the QUEUED state.
   */
  async wakeSnoozedFindings(before: Date = new Date()): Promise<{ awakened: number }> {
    const snoozed = await this.prisma.growthOpportunity.findMany({
      where: {
        lifecycle: FindingLifecycle.SNOOZED,
        snoozeUntil: {
          lte: before,
        },
      },
      select: { id: true },
    });

    let count = 0;
    for (const item of snoozed) {
      try {
        await this.transition(
          item.id,
          FindingLifecycle.QUEUED,
          { type: 'SYSTEM' },
          { reason: 'Snooze expired' },
        );
        count++;
      } catch {
        // Individual transition failures do not abort the job
      }
    }

    return { awakened: count };
  }
}
