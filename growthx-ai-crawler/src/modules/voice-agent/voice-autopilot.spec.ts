import { VoiceAgentService, describeRun } from './voice-agent.service';

const view = (over: Record<string, unknown> = {}) => ({
  id: 'run1',
  projectId: 'p1',
  domain: 'brandkettle.co.in',
  status: 'AWAITING_CONFIRMATION',
  step: 'CONFIRM',
  suggestions: [
    { domain: 'teabox.com', name: 'Teabox', reason: '' },
    { domain: 'vahdamteas.com', name: 'Vahdam', reason: '' },
  ],
  competitors: [],
  sites: [{ domain: 'brandkettle.co.in', name: 'Your website', role: 'you', crawl: 'RUNNING', pagesCrawled: 3 }],
  log: [],
  error: null,
  reportReady: false,
  startedAt: '',
  finishedAt: null,
  ...over,
});

function setup() {
  const prisma = {
    project: { findUnique: jest.fn().mockResolvedValue({ organizationId: 'o1' }) },
    voiceMessage: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    agentToolCall: { create: jest.fn().mockResolvedValue({}) },
  };
  const autopilot = {
    start: jest.fn().mockResolvedValue(view({ status: 'DISCOVERING', step: 'FIND_COMPETITORS', suggestions: [] })),
    activeFor: jest.fn().mockResolvedValue({ id: 'run1', status: 'AWAITING_CONFIRMATION', suggestions: view().suggestions }),
    confirm: jest.fn((_id, _u, domains: string[]) =>
      Promise.resolve(view({ status: 'RUNNING', competitors: domains.map((d) => ({ domain: d, name: d, competitorId: d })) })),
    ),
    get: jest.fn().mockResolvedValue(view({ status: 'RUNNING', step: 'CRAWL_SITES' })),
  };
  const router = { generate: jest.fn() };
  const service = new VoiceAgentService(prisma as any, router as any, { assertMembership: jest.fn() } as any, {} as any, autopilot as any);
  return { service, autopilot, router };
}

const ask = (service: VoiceAgentService, text: string, projectId?: string) =>
  service.dispatch({ text, sessionId: 's1', projectId } as any, 'u1', 'o1');

describe('voice autopilot turns', () => {
  it('starts the autopilot from "my website is …" without asking the model, even with no project yet', async () => {
    const { service, autopilot, router } = setup();
    const res = await ask(service, 'My website is brand kettle dot co dot in, identify my competitors');
    expect(autopilot.start).toHaveBeenCalledWith({ userId: 'u1', organizationId: 'o1', domain: 'brandkettle.co.in', projectId: undefined });
    expect(router.generate).not.toHaveBeenCalled();
    expect(res.uiPayload).toEqual({ type: 'autopilot', runId: 'run1', projectId: 'p1' });
    expect(res.spokenSummary).toContain('looking for your competitors');
  });

  it('takes "yes, but remove Vahdam" as the confirmation', async () => {
    const { service, autopilot } = setup();
    const res = await ask(service, 'yes but remove Vahdam', 'p1');
    expect(autopilot.confirm).toHaveBeenCalledWith('run1', 'u1', ['teabox.com']);
    expect(res.spokenSummary).toContain("I've added teabox.com");
  });

  it('answers "how is it going" from the run', async () => {
    const { service, autopilot } = setup();
    autopilot.activeFor.mockResolvedValue({ id: 'run1', status: 'RUNNING', suggestions: [] });
    const res = await ask(service, "how's it going?", 'p1');
    expect(res.spokenSummary).toBe("I'm still reading your website. Your report comes right after.");
  });
});

describe('describeRun', () => {
  it('asks the confirmation question with the names found', () => {
    expect(describeRun(view() as any)).toBe(
      'I found Teabox and Vahdam. Are these your competitors? Say yes, or tell me which to remove or add.',
    );
  });
});
