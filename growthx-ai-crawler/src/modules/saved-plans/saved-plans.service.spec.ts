import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MarkStepDto, SavePlanDto } from './saved-plans.dto';
import { MAX_PLANS_PER_PROJECT, SavedPlansService } from './saved-plans.service';

const plan = (over: Partial<SavePlanDto> = {}): SavePlanDto => ({
  id: 'staged_1',
  title: 'Compete with country delight\'s Cow Milk 450ml',
  category: 'Business',
  source: 'BUSINESS_MARKETING_SIGNAL',
  priority: 'HIGH',
  impact: 'Linked from their homepage',
  effortHours: 2,
  deliverable: '# Plan\n1. Do this',
  status: 'STAGED',
  stagedAt: '2026-09-28T10:00:00.000Z',
  ...over,
});

function build() {
  const rows = new Map<string, any>();
  const done = new Map<string, Date>();
  const prisma = {
    savedPlan: {
      findMany: jest.fn(async ({ where }) => [...rows.values()].filter((r) => r.projectId === where.projectId)),
      findUnique: jest.fn(async ({ where }) => rows.get(`${where.projectId_id.projectId}/${where.projectId_id.id}`) ?? null),
      count: jest.fn(async ({ where }) => [...rows.values()].filter((r) => r.projectId === where.projectId).length),
      upsert: jest.fn(async ({ where, create, update }) => {
        const key = `${where.projectId_id.projectId}/${where.projectId_id.id}`;
        const row = rows.has(key) ? { ...rows.get(key), ...update } : { ...create };
        rows.set(key, row);
        return row;
      }),
      deleteMany: jest.fn(async ({ where }) => {
        const key = `${where.projectId}/${where.id}`;
        const had = rows.delete(key);
        return { count: had ? 1 : 0 };
      }),
    },
    actionStepDone: {
      findMany: jest.fn(async ({ where }) =>
        [...done.entries()].filter(([k]) => k.startsWith(`${where.projectId}/`)).map(([k, doneAt]) => ({ stepKey: k.split('/').slice(1).join('/'), doneAt })),
      ),
      findUnique: jest.fn(async ({ where }) => (done.has(`${where.projectId_stepKey.projectId}/${where.projectId_stepKey.stepKey}`) ? {} : null)),
      count: jest.fn(async () => done.size),
      upsert: jest.fn(async ({ create }) => done.set(`${create.projectId}/${create.stepKey}`, create.doneAt)),
      deleteMany: jest.fn(async ({ where }) => ({ count: done.delete(`${where.projectId}/${where.stepKey}`) ? 1 : 0 })),
    },
  };
  return { service: new SavedPlansService(prisma as any), prisma, rows };
}

describe('SavedPlansService', () => {
  it('keeps a saved plan on the server, so every device sees it', async () => {
    const { service } = build();
    await service.save('p1', plan());
    expect(await service.list('p1')).toEqual([
      expect.objectContaining({ id: 'staged_1', title: plan().title, status: 'STAGED', stagedAt: '2026-09-28T10:00:00.000Z' }),
    ]);
    expect(await service.list('p2')).toEqual([]);
  });

  it('never stores a retried save twice, and updates the one it has', async () => {
    const { service, rows } = build();
    await service.save('p1', plan());
    await service.save('p1', plan());
    await service.save('p1', plan({ status: 'EXECUTED' }));
    expect(rows.size).toBe(1);
    expect((await service.list('p1'))[0].status).toBe('EXECUTED');
  });

  it('removes a plan, and treats removing one already gone as done', async () => {
    const { service } = build();
    await service.save('p1', plan());
    expect(await service.remove('p1', 'staged_1')).toEqual({ removed: true });
    expect(await service.remove('p1', 'staged_1')).toEqual({ removed: false });
  });

  it('refuses a new plan past the cap, but still updates an existing one', async () => {
    const { service, prisma } = build();
    await service.save('p1', plan());
    prisma.savedPlan.count.mockResolvedValue(MAX_PLANS_PER_PROJECT);
    await expect(service.save('p1', plan({ id: 'new' }))).rejects.toThrow(/at most/);
    await expect(service.save('p1', plan({ status: 'EXECUTED' }))).resolves.toMatchObject({ status: 'EXECUTED' });
  });

  it('remembers action-plan steps marked done, with the time they were marked', async () => {
    const { service } = build();
    const key = 'p1::MISSING_CANONICAL';
    expect(await service.markStep('p1', { stepKey: key, done: true, doneAt: '2026-09-28T09:00:00.000Z' })).toEqual({
      [key]: '2026-09-28T09:00:00.000Z',
    });
    expect(await service.markStep('p1', { stepKey: key, done: false })).toEqual({});
  });
});

describe('what the API accepts', () => {
  const errorsFor = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('accepts a plan the browser saved', async () => {
    expect(await errorsFor(SavePlanDto, plan())).toEqual([]);
  });

  it('rejects an unknown priority or status, and an oversized plan', async () => {
    expect(await errorsFor(SavePlanDto, plan({ priority: 'URGENT' as any }))).toContain('priority');
    expect(await errorsFor(SavePlanDto, plan({ status: 'DONE' as any }))).toContain('status');
    expect(await errorsFor(SavePlanDto, plan({ deliverable: 'x'.repeat(20001) }))).toContain('deliverable');
    expect(await errorsFor(SavePlanDto, plan({ stagedAt: 'yesterday' }))).toContain('stagedAt');
  });

  it('needs a step and whether it is done', async () => {
    expect(await errorsFor(MarkStepDto, { stepKey: 'p1::X', done: true })).toEqual([]);
    expect(await errorsFor(MarkStepDto, { stepKey: '', done: 'yes' })).toEqual(expect.arrayContaining(['stepKey', 'done']));
  });
});
