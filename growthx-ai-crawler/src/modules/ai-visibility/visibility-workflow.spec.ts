import {
  classifyAnswer,
  assessmentInput,
  normalizeAssessment,
  normalizeBrief,
  replaceRepeatedBuyerQuestions,
} from "./visibility-workflow.logic";
import { VisibilityWorkflowService } from "./visibility-workflow.service";
import {
  VisibilityBrief,
  VisibilityContext,
} from "./visibility-workflow.types";
import { AiProvider } from "../ai-search/multi-ai-router/multi-ai-router.service";
import {
  assessmentSchema,
  briefSchema,
  measurementSchema,
} from "./visibility-workflow.schema";

const context: VisibilityContext = {
  gatheredAt: "2026-10-14T00:00:00Z",
  businessName: "Milquufresh",
  domain: "milquufresh.in",
  sources: [
    {
      id: "website",
      label: "Website Audit",
      available: true,
      updatedAt: null,
      detail: "Read",
      href: "/website",
    },
  ],
  facts: [
    {
      id: "page-home",
      source: "website",
      text: "Cow milk delivery in Panvel, Kharghar and Kamothe.",
    },
    { id: "ga4", source: "ga4", text: "Some sessions are from Delhi." },
  ],
  cities: [],
  keyEvents: null,
  limitations: [],
};
const draft = (): VisibilityBrief => ({
  businessName: "Milquufresh",
  summary: "A local dairy delivery business",
  offerings: ["cow milk"],
  locations: ["Panvel", "Kharghar", "Kamothe"],
  evidenceIds: ["page-home"],
  reviewed: true,
  analysts: [],
  questions: [
    "Best cow milk delivery in Panvel?",
    "Which cow milk subscription serves Kharghar?",
    "Where can I buy fresh cow milk in Kamothe?",
    "Which cow milk delivery offers morning delivery in Panvel?",
    "How do I compare cow milk suppliers in Kharghar?",
    "Which cow milk service offers a trial in Kamothe?",
    "Who supplies cow milk to families in Panvel?",
    "Where can I order cow milk online in Kharghar?",
    "Which cow milk delivery offers flexible subscriptions in Kamothe?",
    "What cow milk suppliers deliver daily in Panvel?",
  ].map((text, i) => ({
    text,
    offering: "cow milk",
    location: ["Panvel", "Kharghar", "Kamothe"][i % 3],
    intent: "purchase",
    rationale: "Delivery demand",
    evidenceIds: ["page-home"],
  })),
});

describe("business-context buyer questions", () => {
  it("accepts ten distinct local buyer questions from website evidence", () => {
    expect(normalizeBrief(draft(), context).questions).toHaveLength(10);
  });
  it("does not turn traffic from Delhi into a claimed service area", () => {
    expect(() =>
      normalizeBrief({ ...draft(), locations: ["Delhi"] }, context),
    ).toThrow("service areas");
  });
  it("rejects a branded question, duplicates, wrong offerings and unsupported evidence", () => {
    for (const update of [
      { text: "Is Milquufresh best in Panvel?" },
      { text: draft().questions[1].text },
      { offering: "housing" },
      { evidenceIds: ["invented"] },
    ]) {
      const d = draft();
      d.questions[0] = { ...d.questions[0], ...update };
      expect(() => normalizeBrief(d, context)).toThrow();
    }
  });
  it("requires exactly ten questions", () => {
    expect(() =>
      normalizeBrief(
        { ...draft(), questions: draft().questions.slice(1) },
        context,
      ),
    ).toThrow("exactly 10");
  });
  it("replaces a repeated model question using its cited offering and service area", () => {
    const d = draft();
    d.questions[9] = { ...d.questions[9], text: d.questions[0].text };
    expect(() => normalizeBrief(d, context)).toThrow("exactly 10");
    const repaired = normalizeBrief(replaceRepeatedBuyerQuestions(d), context);
    expect(repaired.questions).toHaveLength(10);
    expect(new Set(repaired.questions.map((q) => q.text)).size).toBe(10);
    expect(repaired.questions[9].text).toContain("cow milk");
    expect(repaired.questions[9].text).toContain("Panvel");
    expect(repaired.questions[9].evidenceIds).toEqual(["page-home"]);
  });
  it("does not prime a question with a tracked competitor name", () => {
    const d = draft();
    d.questions[0].text =
      "Is Local Dairy the best cow milk delivery in Panvel?";
    expect(() =>
      normalizeBrief(d, {
        ...context,
        facts: [
          ...context.facts,
          {
            id: "rival-0",
            source: "competitors",
            text: JSON.stringify({
              name: "Local Dairy",
              domain: "localdairy.test",
            }),
          },
        ],
      }),
    ).toThrow("tracked competitor");
  });
  it("allows explicit owner corrections and records their provenance", () => {
    expect(normalizeBrief(draft(), context, true)).toMatchObject({
      reviewed: true,
      evidenceIds: ["owner"],
    });
  });
});

describe("answer and action evidence", () => {
  const answer = {
    id: "a1",
    provider: "GEMINI",
    model: "test",
    promptText: "Milk?",
    rawResponse:
      "I recommend Milquufresh for cow milk. Other options include Local Dairy. https://example.com/milk",
    errorMessage: null,
    createdAt: new Date(),
  };
  it("keeps positive recommendations, literal rival quotes and answer links", () => {
    const parsed = classifyAnswer(
      {
        recommended: true,
        recommendationQuote: "I recommend Milquufresh for cow milk.",
        rivals: [
          { name: "Local Dairy", quote: "Other options include Local Dairy." },
          { name: "Invented Dairy", quote: "Invented Dairy is best." },
        ],
      },
      answer,
      draft(),
      context.domain,
    );
    expect(parsed).toMatchObject({
      brandMentioned: true,
      recommended: true,
      rivals: [
        { name: "Local Dairy", quote: "Other options include Local Dairy." },
      ],
      urls: ["https://example.com/milk"],
    });
  });
  it("rejects invented quotes and does not match brand substrings", () => {
    expect(
      classifyAnswer(
        { recommended: true, recommendationQuote: "Milquufresh is the best." },
        answer,
        draft(),
        context.domain,
      ).recommended,
    ).toBe(false);
    expect(
      classifyAnswer(
        {},
        { ...answer, rawResponse: "Milquufreshly is another company" },
        draft(),
        context.domain,
      ).brandMentioned,
    ).toBe(false);
  });
  it("does not turn a neutral mention into a recommendation", () => {
    expect(
      classifyAnswer({ recommended: false }, answer, draft(), context.domain),
    ).toMatchObject({ brandMentioned: true, recommended: false });
  });
  it("rejects an unsupported action plan rather than fabricating a result", () => {
    expect(() =>
      normalizeAssessment(
        {
          summary: "Plan",
          actions: [
            {
              title: "Do work",
              evidenceIds: ["invented"],
              steps: ["Do it"],
              measureBy: "Leads",
            },
          ],
        },
        "GEMINI",
        "model",
        context,
        [answer],
      ),
    ).toThrow("evidence-backed");
  });
});

function harness(failSarvam = false) {
  let row: any = {
    id: "journey",
    projectId: "project",
    status: "QUEUED",
    phase: "CHECK",
    context,
    brief: draft(),
    scanId: null,
    updatedAt: new Date(),
  };
  const responses = new Map<string, any>();
  const prisma: any = {
    aiVisibilityJourney: {
      findUnique: jest.fn(async () => row),
      findUniqueOrThrow: jest.fn(async () => row),
      findMany: jest.fn(async () => [row]),
      findFirst: jest.fn(async ({ where }: any) =>
        where.projectId === row.projectId ? row : null,
      ),
      update: jest.fn(async ({ data }: any) => (row = { ...row, ...data })),
      updateMany: jest.fn(async ({ data }: any) => {
        row = { ...row, ...data };
        return { count: 1 };
      }),
      create: jest.fn(async () => row),
    },
    aiVisibilityScan: { upsert: jest.fn(), update: jest.fn() },
    aiVisibilityScanRun: { upsert: jest.fn(), update: jest.fn() },
    aiVisibilityPrompt: { upsert: jest.fn() },
    aiVisibilityResponse: {
      findUnique: jest.fn(
        async ({ where }: any) => responses.get(where.id) ?? null,
      ),
      findMany: jest.fn(async () => [...responses.values()]),
      upsert: jest.fn(async ({ create, update, where }: any) => {
        const value = {
          createdAt: new Date(),
          mentions: [],
          citations: [],
          analysis: null,
          ...(responses.get(where.id)
            ? { ...responses.get(where.id), ...update }
            : create),
        };
        responses.set(where.id, value);
        return value;
      }),
    },
    aiVisibilityResponseAnalysis: {
      upsert: jest.fn(async ({ create }: any) => {
        responses.get(create.responseId).analysis = create;
      }),
    },
    aiVisibilityBrandMention: {
      deleteMany: jest.fn(),
      createMany: jest.fn(async ({ data }: any) => {
        for (const d of data) responses.get(d.responseId).mentions.push(d);
      }),
    },
    aiVisibilityCitation: { deleteMany: jest.fn(), create: jest.fn() },
  };
  prisma.$transaction = (fn: any) => fn(prisma);
  const router: any = {
    configuredProviders: () => [AiProvider.GEMINI, AiProvider.SARVAM],
    configuredModels: () => ({ GEMINI: "gemini-test", SARVAM: "sarvam-test" }),
    generate: jest.fn(async (req: any) => {
      if (failSarvam && req.provider === AiProvider.SARVAM)
        throw new Error("Provider unavailable");
      let text =
        "I recommend Milquufresh for cow milk. Other options include Local Dairy.";
      if (req.jsonSchema === briefSchema) {
        text = JSON.stringify(draft());
      } else if (req.jsonSchema === measurementSchema) {
        const answers = JSON.parse(req.prompt.split("ANSWERS: ")[1]);
        text = JSON.stringify({
          measurements: answers.map((a: any) => ({
            answerId: a.id,
            recommended: true,
            recommendationQuote: "I recommend Milquufresh for cow milk.",
            rivals: [
              {
                name: "Local Dairy",
                quote: "Other options include Local Dairy.",
              },
            ],
          })),
        });
      } else if (req.jsonSchema === assessmentSchema) {
        text = JSON.stringify({
          summary: "Improve local conversion paths",
          localDemand: "City traffic needs review; lead events are unknown.",
          gaps: [],
          actions: [
            {
              title: "Clarify service areas",
              priority: "high",
              evidenceIds: ["page-home"],
              steps: ["Publish delivery eligibility for Panvel."],
              measureBy: "Qualified delivery enquiries",
              timeframe: "Week 1",
            },
          ],
        });
      }
      return {
        provider: req.provider,
        model: `${req.provider}-test`,
        text,
        refused: false,
        usage: { inputTokens: 10, outputTokens: 20, estimatedCostUsd: null },
      };
    }),
  };
  const metrics: any = { calculateScanMetrics: jest.fn() };
  const source = { gather: jest.fn(async () => context) };
  const service = new VisibilityWorkflowService(
    prisma,
    { getRedisClient: () => ({ status: "ready" }) } as any,
    source as any,
    router,
    metrics,
  );
  (service as any).jobs = {
    add: jest.fn(),
    getJob: jest.fn().mockResolvedValue(null),
  };
  return {
    service,
    prisma,
    router,
    metrics,
    responses,
    source,
    row: () => row,
    reset: () => {
      row.status = "QUEUED";
    },
    setSarvamFailure: (value: boolean) => {
      failSarvam = value;
    },
  };
}

describe("durable visibility workflow", () => {
  it('bounds a full multi-model plan while preserving every source and answer identity', () => {
    const full = { ...context, facts: Array.from({length:45}, (_, index) => ({ id:`fact-${index}`, source:['website','gsc','ga4','competitors'][index%4], text:'Evidence तथ्य '.repeat(1000) })) };
    const findings = Array.from({length:100}, (_, index) => ({ id:`answer-${index}`, provider:['GEMINI','OPENAI','ANTHROPIC','PERPLEXITY','GROK'][index%5], error:null, measured:true, finding:{ brandMentioned:index===0, recommended:false, rivals:[{name:'Local Dairy',quote:'Long exact quote '.repeat(1000)}] } }));
    const payload = assessmentInput(draft(), full, findings);
    expect(Buffer.byteLength(payload)).toBeLessThanOrEqual(80_000);
    const parsed = JSON.parse(payload);
    expect(parsed.evidence.facts.map((fact:any)=>fact.id)).toEqual(full.facts.map(fact=>fact.id));
    expect(parsed.findings.map((answer:any)=>answer.id)).toEqual(findings.map(answer=>answer.id));
    expect(parsed.findings[0]).toMatchObject({brandMentioned:true,rivals:['Local Dairy']});
    expect(full.facts[0].text).toContain('Evidence तथ्य '.repeat(1000));
  });
  it("uses twenty questions, cheap internal analysis, and preserves an unavailable Grok as a partial measurement", async () => {
    const previousPolicy = process.env.AI_LOW_COST_POLICY;
    process.env.AI_LOW_COST_POLICY = 'true';
    try {
      const h = harness();
      h.router.lowCostEnabled = () => true;
      h.router.configuredProviders = () => [AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.ANTHROPIC, AiProvider.PERPLEXITY, AiProvider.GROK];
      h.router.configuredModels = () => ({ GEMINI: 'gemini-2.5-flash', OPENAI: 'openai/gpt-4.1-mini', ANTHROPIC: 'anthropic/claude-haiku-4.5', PERPLEXITY: 'perplexity/sonar', GROK: 'x-ai/grok-4-fast' });
      const brief = draft();
      brief.questions = [...brief.questions, ...brief.questions.map(q => ({ ...q, text: `${q.text} For a household?` }))];
      const base = h.router.generate.getMockImplementation();
      h.router.generate.mockImplementation(async (req: any) => {
        if (req.provider === AiProvider.GROK) throw new Error('Approved model unavailable');
        if (req.jsonSchema === briefSchema) return { model: 'gemini-3.1-flash-lite', text: JSON.stringify(brief) };
        return base(req);
      });
      h.row().brief = null;
      await h.service.process({ id: 'journey', phase: 'PREPARE' });
      expect(h.row().status).toBe('READY');
      expect(h.row().brief.questions).toHaveLength(20);
      expect(h.row().brief.analysts).toHaveLength(1);
      h.row().brief.reviewed = true;
      h.row().scanId = 'scan';
      h.reset();
      h.router.generate.mockClear();
      await h.service.process({ id: 'journey', phase: 'CHECK' });
      const calls = h.router.generate.mock.calls.map(([req]: any[]) => req);
      expect(calls.filter((req: any) => req.freshMeasurement)).toHaveLength(100);
      expect(calls.filter((req: any) => req.jsonSchema).every((req: any) => req.provider === AiProvider.GEMINI)).toBe(true);
      expect([...h.responses.values()].filter(a => a.analysis)).toHaveLength(80);
      expect(h.row().analysis).toHaveLength(1);
      expect(h.row().status).toBe('PARTIAL');
    } finally { process.env.AI_LOW_COST_POLICY = previousPolicy; }
  });
  it("lists configured OpenRouter and completes its full workflow when it is the only provider", async () => {
    const h = harness();
    h.router.configuredProviders = () => [AiProvider.OPENROUTER];
    h.router.configuredModels = () => ({ OPENROUTER: "openai/gpt-4o-mini" });
    h.prisma.aiVisibilityJourney.findFirst = jest.fn(async () => h.row());
    const data = await h.service.read("project");
    expect(data.providers).toContainEqual({
      provider: AiProvider.OPENROUTER,
      configured: true,
      model: "openai/gpt-4o-mini",
      unavailableReason: null,
    });
    h.row().brief = null;
    await h.service.process({ id: "journey", phase: "PREPARE" });
    expect(h.row().status).toBe("READY");
    expect(h.row().brief.analysts.map((a: any) => a.provider)).toEqual([AiProvider.OPENROUTER]);
    h.row().brief.reviewed = true;
    h.reset();
    await h.service.process({ id: "journey", phase: "CHECK" });
    expect(h.responses.size).toBe(10);
    expect(h.row().analysis).toHaveLength(1);
    expect(h.row().status).toBe("COMPLETED");
    expect(h.router.generate.mock.calls.every(([request]: any[]) => request.provider === AiProvider.OPENROUTER)).toBe(true);
  });
  it("corrects missing locations and branded drafts once before saving ten buyer questions", async () => {
    const h = harness();
    h.row().brief = null;
    const invalid = draft();
    invalid.questions[2].text =
      "What is the recommended quantity of cow milk for a family?";
    invalid.questions[9].text =
      "How does Milquufresh cow milk compare in Panvel?";
    h.router.generate.mockResolvedValueOnce({
      model: "test",
      text: JSON.stringify(invalid),
    });
    await h.service.process({ id: "journey", phase: "PREPARE" });
    expect(h.row().status).toBe("READY");
    expect(h.row().brief.questions).toHaveLength(10);
    expect(h.router.generate).toHaveBeenCalledTimes(3);
    const correction = h.router.generate.mock.calls[1][0];
    expect(correction.prompt).toContain("Question 3:");
    expect(correction.prompt).toContain("Recheck ALL 10 questions");
    expect(correction.provider).toBe(AiProvider.GEMINI);
    expect(correction.allowFallback).toBe(false);
  });
  it("keeps a valid corrected brief when the model repeats one question", async () => {
    const h = harness();
    h.row().brief = null;
    const first = draft();
    first.questions[2].text =
      "What is the recommended quantity of cow milk for a family?";
    const corrected = draft();
    corrected.questions[9] = {
      ...corrected.questions[9],
      text: corrected.questions[0].text,
    };
    h.router.generate
      .mockResolvedValueOnce({ model: "test", text: JSON.stringify(first) })
      .mockResolvedValueOnce({
        model: "test",
        text: JSON.stringify(corrected),
      });
    await h.service.process({ id: "journey", phase: "PREPARE" });
    expect(h.row().status).toBe("READY");
    expect(h.row().brief.questions).toHaveLength(10);
    expect(new Set(h.row().brief.questions.map((q: any) => q.text)).size).toBe(
      10,
    );
    expect(h.row().brief.analysts).toHaveLength(2);
  });
  it("bounds failed corrections and explains the validation failure without saving invalid work", async () => {
    const h = harness();
    h.row().brief = null;
    const invalid = draft();
    invalid.questions[2].text =
      "What is the recommended quantity of cow milk for a family?";
    h.router.generate.mockResolvedValue({
      model: "test",
      text: JSON.stringify(invalid),
    });
    await h.service.process({ id: "journey", phase: "PREPARE" });
    expect(h.router.generate).toHaveBeenCalledTimes(4);
    expect(h.row().status).toBe("FAILED");
    expect(h.row().brief).toBeNull();
    expect(h.row().errors).toHaveLength(2);
    expect(h.row().errors[0]).toContain("Question 3:");
  });
  it("does not retry provider failures or expose provider payloads", async () => {
    const h = harness();
    h.row().brief = null;
    h.router.generate.mockRejectedValue(
      new Error("HTTP 403 private-provider-key"),
    );
    await h.service.process({ id: "journey", phase: "PREPARE" });
    expect(h.router.generate).toHaveBeenCalledTimes(2);
    expect(h.row().status).toBe("FAILED");
    expect(JSON.stringify(h.row().errors)).not.toContain(
      "private-provider-key",
    );
    expect(h.row().errors[0]).toContain("access, quota and availability");
  });
  it("collects 20 unprimed answers, classifies both providers and persists two plans", async () => {
    const h = harness();
    await h.service.process({ id: "journey", phase: "CHECK" });
    expect(h.responses.size).toBe(20);
    expect(h.row()).toMatchObject({ status: "COMPLETED", progress: 100 });
    expect(h.row().analysis).toHaveLength(2);
    const probes = h.router.generate.mock.calls
      .map((c: any[]) => c[0])
      .filter((r: any) => !r.jsonSchema);
    expect(probes).toHaveLength(20);
    for (const p of probes) {
      expect(p.systemInstruction).toContain('no more than 200 words');
      expect(p.systemInstruction).not.toMatch(/Milquufresh|Panvel|Local Dairy/i);
      expect(p.prompt).not.toContain("Milquufresh");
      expect(p.allowFallback).toBe(false);
    }
    expect(h.metrics.calculateScanMetrics).toHaveBeenCalledWith(
      "journey",
      "project",
    );
  });
  it("retains truncated text, explains the output limit, and excludes it from measurements", async () => {
    const h = harness();
    const base = h.router.generate.getMockImplementation();
    h.router.generate.mockImplementation(async (request: any) => {
      const result = await base(request);
      return request.freshMeasurement && request.provider === AiProvider.GEMINI
        ? { ...result, refused: true, text: 'Saved partial answer', usage: { ...result.usage, outputTokens: 800 } }
        : result;
    });
    await h.service.process({ id: 'journey', phase: 'CHECK' });
    const truncated = [...h.responses.values()].filter(answer => answer.provider === AiProvider.GEMINI);
    expect(truncated).toHaveLength(10);
    expect(truncated.every(answer => answer.rawResponse === 'Saved partial answer' && answer.errorMessage.includes('output limit') && !answer.analysis)).toBe(true);
    expect(h.row().status).toBe('PARTIAL');
  });
  it("resumes from saved answers without spending on successful probes again", async () => {
    const h = harness();
    await h.service.process({ id: "journey", phase: "CHECK" });
    h.router.generate.mockClear();
    h.reset();
    await h.service.process({ id: "journey", phase: "CHECK" });
    expect(h.router.generate).not.toHaveBeenCalled();
    expect(h.responses.size).toBe(20);
  });
  it('rebuilds only the plan without rebilling successful or failed provider questions', async () => {
    const h = harness(true);
    await h.service.process({ id:'journey', phase:'CHECK' });
    h.row().analysis=[];
    h.router.generate.mockClear();
    await h.service.check('project','journey',undefined,true);
    await h.service.process({ id:'journey',phase:'PLAN' });
    expect(h.router.generate.mock.calls.every(([request]:any[])=>!request.freshMeasurement)).toBe(true);
    expect(h.responses.size).toBe(20);
    expect(h.row().analysis).toHaveLength(1);
  });
  it("retains one provider’s evidence when the other fails and reports partial completion", async () => {
    const h = harness(true);
    await h.service.process({ id: "journey", phase: "CHECK" });
    expect(h.row().status).toBe("PARTIAL");
    expect(
      [...h.responses.values()].filter((a) => a.errorMessage),
    ).toHaveLength(10);
    expect([...h.responses.values()].filter((a) => a.analysis)).toHaveLength(
      10,
    );
    expect(h.row().analysis).toHaveLength(1);
  });
  it("refreshes both plans after a failed provider later contributes new evidence", async () => {
    const h = harness(true);
    await h.service.process({ id: "journey", phase: "CHECK" });
    h.router.generate.mockClear();
    h.setSarvamFailure(false);
    h.reset();
    await h.service.process({ id: "journey", phase: "CHECK" });
    const calls = h.router.generate.mock.calls.map((c: any[]) => c[0]);
    expect(calls.filter((r: any) => !r.jsonSchema)).toHaveLength(10);
    expect(
      calls.filter((r: any) => r.jsonSchema === assessmentSchema),
    ).toHaveLength(2);
    expect(h.row().status).toBe("COMPLETED");
  });
  it("reuses the evidence and both saved business interpretations after restart", async () => {
    const h = harness();
    h.row().brief = null;
    h.row().context = null;
    await h.service.process({ id: "journey", phase: "PREPARE" });
    expect(h.row().status).toBe("READY");
    expect(h.row().brief.analysts).toHaveLength(2);
    h.router.generate.mockClear();
    h.reset();
    await h.service.process({ id: "journey", phase: "PREPARE" });
    expect(h.source.gather).toHaveBeenCalledTimes(1);
    expect(h.router.generate).not.toHaveBeenCalled();
  });
  it("repairs a lost queue handoff but leaves an existing job alone", async () => {
    const h = harness();
    const jobs = (h.service as any).jobs;
    await h.service.recoverQueuedWork();
    expect(jobs.add).toHaveBeenCalledWith(
      "CHECK",
      { id: "journey", phase: "CHECK" },
      expect.objectContaining({ jobId: "journey-CHECK" }),
    );
    jobs.add.mockClear();
    jobs.getJob.mockResolvedValue({});
    await h.service.recoverQueuedWork();
    expect(jobs.add).not.toHaveBeenCalled();
  });
  it("rejects a stale concurrent confirmation before queueing another paid job", async () => {
    const h = harness();
    h.row().status = "READY";
    h.prisma.aiVisibilityJourney.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      h.service.check("project", "journey", draft()),
    ).rejects.toThrow("has changed");
    expect((h.service as any).jobs.add).not.toHaveBeenCalled();
  });
  it("scopes mutations to the project and rejects double-checks", async () => {
    const h = harness();
    await expect(h.service.check("another-project", "journey")).rejects.toThrow(
      "not found",
    );
    await expect(h.service.check("project", "journey")).rejects.toThrow(
      "Prepare and review",
    );
    expect((h.service as any).jobs.add).not.toHaveBeenCalled();
  });
  it("never starts paid work while the queue is unavailable", async () => {
    const h = harness();
    (h.service as any).jobs = undefined;
    await expect(h.service.prepare("project")).rejects.toThrow(
      "queue is unavailable",
    );
    expect(h.prisma.aiVisibilityJourney.create).not.toHaveBeenCalled();
  });
});
