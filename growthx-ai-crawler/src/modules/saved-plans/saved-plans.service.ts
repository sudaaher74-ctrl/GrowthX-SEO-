import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MarkStepDto, SavePlanDto } from './saved-plans.dto';

/** More than any customer saves by hand; stops a runaway client filling the table. */
export const MAX_PLANS_PER_PROJECT = 1000;
export const MAX_DONE_STEPS_PER_PROJECT = 2000;

export interface SavedPlanView {
  id: string;
  projectId: string;
  title: string;
  category: string;
  source: string;
  priority: string;
  impact: string;
  effortHours: number;
  deliverable: string;
  evidence?: string;
  affectedUrl?: string;
  status: string;
  stagedAt: string;
}

/**
 * Plans saved from every "Save as a plan" / "Get a plan" button, and the
 * action plan's "I've done this" ticks — per project, on the server.
 *
 * Both used to live only in the browser that made them. The browser still
 * keeps a copy so the screen answers instantly and works offline; this is
 * the copy every device and every colleague on the project reads.
 */
@Injectable()
export class SavedPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string): Promise<SavedPlanView[]> {
    const rows = await this.prisma.savedPlan.findMany({ where: { projectId }, orderBy: { stagedAt: 'desc' } });
    return rows.map(toView);
  }

  /** Creates the plan, or updates it when the id is already saved. Idempotent, so a retried save never duplicates. */
  async save(projectId: string, plan: SavePlanDto): Promise<SavedPlanView> {
    const existing = await this.prisma.savedPlan.findUnique({ where: { projectId_id: { projectId, id: plan.id } }, select: { id: true } });
    if (!existing && (await this.prisma.savedPlan.count({ where: { projectId } })) >= MAX_PLANS_PER_PROJECT) {
      throw new BadRequestException(`A project can keep at most ${MAX_PLANS_PER_PROJECT} saved plans. Remove some finished ones first.`);
    }
    const data = {
      title: plan.title,
      category: plan.category,
      source: plan.source,
      priority: plan.priority,
      impact: plan.impact ?? '',
      effortHours: plan.effortHours ?? 0,
      deliverable: plan.deliverable ?? '',
      evidence: plan.evidence ?? null,
      affectedUrl: plan.affectedUrl ?? null,
      status: plan.status,
      stagedAt: new Date(plan.stagedAt),
    };
    const row = await this.prisma.savedPlan.upsert({
      where: { projectId_id: { projectId, id: plan.id } },
      create: { projectId, id: plan.id, ...data },
      update: data,
    });
    return toView(row);
  }

  /** Removing a plan that is already gone is not an error: the result is the same. */
  async remove(projectId: string, id: string): Promise<{ removed: boolean }> {
    const { count } = await this.prisma.savedPlan.deleteMany({ where: { projectId, id } });
    return { removed: count > 0 };
  }

  /** When each action-plan step was marked done, by step. */
  async doneSteps(projectId: string): Promise<Record<string, string>> {
    const rows = await this.prisma.actionStepDone.findMany({ where: { projectId }, select: { stepKey: true, doneAt: true } });
    return Object.fromEntries(rows.map((r) => [r.stepKey, r.doneAt.toISOString()]));
  }

  async markStep(projectId: string, input: MarkStepDto): Promise<Record<string, string>> {
    if (input.done) {
      const doneAt = input.doneAt ? new Date(input.doneAt) : new Date();
      const exists = await this.prisma.actionStepDone.findUnique({
        where: { projectId_stepKey: { projectId, stepKey: input.stepKey } },
        select: { stepKey: true },
      });
      if (!exists && (await this.prisma.actionStepDone.count({ where: { projectId } })) >= MAX_DONE_STEPS_PER_PROJECT) {
        throw new BadRequestException('Too many steps marked done for this project.');
      }
      await this.prisma.actionStepDone.upsert({
        where: { projectId_stepKey: { projectId, stepKey: input.stepKey } },
        create: { projectId, stepKey: input.stepKey, doneAt },
        update: { doneAt },
      });
    } else {
      await this.prisma.actionStepDone.deleteMany({ where: { projectId, stepKey: input.stepKey } });
    }
    return this.doneSteps(projectId);
  }
}

function toView(row: {
  id: string;
  projectId: string;
  title: string;
  category: string;
  source: string;
  priority: string;
  impact: string;
  effortHours: number;
  deliverable: string;
  evidence: string | null;
  affectedUrl: string | null;
  status: string;
  stagedAt: Date;
}): SavedPlanView {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    category: row.category,
    source: row.source,
    priority: row.priority,
    impact: row.impact,
    effortHours: row.effortHours,
    deliverable: row.deliverable,
    ...(row.evidence ? { evidence: row.evidence } : {}),
    ...(row.affectedUrl ? { affectedUrl: row.affectedUrl } : {}),
    status: row.status,
    stagedAt: row.stagedAt.toISOString(),
  };
}
