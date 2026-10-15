import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import { Interval } from "@nestjs/schedule";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { QueueService } from "../queue/queue.service";
import {
  AiProvider,
  AiTask,
  MultiAiRouterService,
} from "../ai-search/multi-ai-router/multi-ai-router.service";
import { extractAndParseJson } from "../ai-engine/utils/json-extractor.util";
import { redactSecretsForAi } from "../security/ai-sanitizer.util";
import { VisibilityContextService } from "./visibility-context.service";
import { MetricsEngineService } from "./metrics-engine.service";
import {
  VisibilityAssessment,
  VisibilityBrief,
  VisibilityContext,
} from "./visibility-workflow.types";
import {
  briefPrompt,
  classifyAnswer,
  CONTEXT_INSTRUCTION,
  list,
  normalizeAssessment,
  normalizeBrief,
  object,
  replaceRepeatedBuyerQuestions,
  str,
} from "./visibility-workflow.logic";
import {
  briefSchema,
  measurementSchema,
  assessmentSchema,
} from "./visibility-workflow.schema";

const ACTIVE = ["QUEUED", "PREPARING", "CHECKING", "PLANNING"];
const PROVIDERS = [AiProvider.GEMINI, AiProvider.SARVAM];
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type JobData = { id: string; phase: "PREPARE" | "CHECK" };
class BriefValidationFailure extends Error {}

@Injectable()
export class VisibilityWorkflowService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(VisibilityWorkflowService.name);
  private jobs?: Queue<JobData>;
  private worker?: Worker<JobData>;
  private startup?: Promise<void>;
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly context: VisibilityContextService,
    private readonly router: MultiAiRouterService,
    private readonly metrics: MetricsEngineService,
  ) {}

  onModuleInit() {
    this.startup = this.queue.ready.then(() => {
      const connection = this.queue.getRedisClient();
      if (!connection) return;
      this.jobs = new Queue<JobData>("ai-visibility-journeys", { connection });
      if (
        process.env.WORKER_MODE === "false" ||
        process.env.DISABLE_WORKERS === "true"
      )
        return;
      this.worker = new Worker<JobData>(
        "ai-visibility-journeys",
        (job) => this.process(job.data),
        {
          connection,
          concurrency: 1,
          lockDuration: 120_000,
          maxStalledCount: 2,
        },
      );
      this.worker.on("error", (err) =>
        this.logger.error(redactSecretsForAi(err.message)),
      );
      this.worker.on("failed", (job) => {
        if (job)
          void this.fail(
            job.data.id,
            "The background job stopped. Retry to resume saved work.",
          ).catch((err) => this.logger.error(err));
      });
    });
  }
  async onModuleDestroy() {
    await this.startup;
    await this.worker?.close();
    await this.jobs?.close();
  }

  private providers() {
    return PROVIDERS.filter((p) =>
      this.router.configuredProviders().includes(p),
    );
  }

  async read(projectId: string) {
    const journey = await this.prisma.aiVisibilityJourney.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    const answers = journey?.scanId ? await this.answers(journey.scanId) : [];
    const configured = this.providers();
    return {
      journey,
      answers,
      providers: PROVIDERS.map((provider) => ({
        provider,
        configured: configured.includes(provider),
        model: this.router.configuredModels()[provider] ?? null,
      })),
    };
  }

  async prepare(projectId: string) {
    await this.ready();
    if (!this.providers().length)
      throw new ServiceUnavailableException(
        "Configure Gemini or Sarvam before building AI Visibility.",
      );
    let journey;
    try {
      journey = await this.prisma.aiVisibilityJourney.create({
        data: { projectId },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          "An AI Visibility run is already in progress for this business.",
        );
      }
      throw err;
    }
    await this.enqueue({ id: journey.id, phase: "PREPARE" });
    return { id: journey.id, status: "QUEUED" };
  }

  async check(projectId: string, id: string, rawBrief?: unknown) {
    await this.ready();
    if (!this.providers().length)
      throw new ServiceUnavailableException(
        "Configure Gemini or Sarvam before checking answers.",
      );
    const journey = await this.prisma.aiVisibilityJourney.findFirst({
      where: { id, projectId },
    });
    if (!journey) throw new NotFoundException("AI Visibility run not found");
    if (
      !journey.brief ||
      !journey.context ||
      !["READY", "PARTIAL", "FAILED"].includes(journey.status)
    ) {
      throw new ConflictException(
        "Prepare and review the business questions before checking answers.",
      );
    }
    if (journey.scanId && rawBrief)
      throw new BadRequestException(
        "Start a new plan to change questions after answers have been collected.",
      );
    const brief = normalizeBrief(
      rawBrief ?? journey.brief,
      journey.context as unknown as VisibilityContext,
      true,
    );
    brief.analysts =
      (journey.brief as unknown as VisibilityBrief).analysts ?? [];
    try {
      const updated = await this.prisma.aiVisibilityJourney.updateMany({
        where: {
          id,
          projectId,
          status: journey.status,
          updatedAt: journey.updatedAt,
        },
        data: {
          status: "QUEUED",
          phase: "CHECK",
          brief: json(brief),
          errors: [],
        },
      });
      if (!updated.count)
        throw new ConflictException(
          "This run has changed. Refresh before trying again.",
        );
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      )
        throw new ConflictException("Another run is already in progress.");
      throw err;
    }
    await this.enqueue({ id, phase: "CHECK" });
    return { id, status: "QUEUED" };
  }

  private async ready() {
    await this.startup;
    if (!this.jobs || this.queue.getRedisClient()?.status !== "ready") {
      throw new ServiceUnavailableException(
        "The background queue is unavailable. Restore Redis and the worker before starting AI Visibility.",
      );
    }
  }
  private async enqueue(data: JobData) {
    try {
      const jobId = `${data.id}-${data.phase}`;
      const previous = await this.jobs!.getJob(jobId);
      if (previous) {
        const state = await previous.getState();
        if (state !== "completed" && state !== "failed") return;
        await previous.remove();
      }
      await this.jobs!.add(data.phase, data, {
        jobId,
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      });
    } catch {
      await this.fail(
        data.id,
        "Could not queue this run. Restore Redis and try again.",
      );
      throw new ServiceUnavailableException(
        "Could not queue AI Visibility. Try again after restoring the background queue.",
      );
    }
  }

  /** Repair the database/queue handoff after a crash, using the same job ID on every replica. */
  @Interval(60_000)
  async recoverQueuedWork() {
    if (!this.jobs || this.queue.getRedisClient()?.status !== "ready") return;
    const rows = await this.prisma.aiVisibilityJourney.findMany({
      where: {
        status: { in: ACTIVE },
        updatedAt: { lt: new Date(Date.now() - 120_000) },
      },
      orderBy: { updatedAt: "asc" },
      take: 20,
    });
    for (const row of rows) {
      const phase = row.phase === "CHECK" ? "CHECK" : "PREPARE";
      if (!(await this.jobs.getJob(`${row.id}-${phase}`)))
        await this.enqueue({ id: row.id, phase });
    }
  }
  private async fail(id: string, message: string) {
    await this.prisma.aiVisibilityJourney.updateMany({
      where: { id, status: { in: ACTIVE } },
      data: { status: "FAILED", errors: [message] },
    });
  }
  async process(job: JobData) {
    const row = await this.prisma.aiVisibilityJourney.findUnique({
      where: { id: job.id },
    });
    if (!row || !ACTIVE.includes(row.status)) return;
    try {
      if (job.phase === "PREPARE") await this.buildBrief(row.id, row.projectId);
      else await this.runChecks(row.id, row.projectId);
    } catch (err) {
      this.logger.error(
        `AI Visibility ${row.id}: ${redactSecretsForAi(str((err as Error)?.message))}`,
      );
      await this.fail(
        row.id,
        err instanceof BadRequestException
          ? err.message
          : "AI Visibility could not finish. Saved answers are retained; retry or check the provider configuration.",
      );
      // The persisted failure is the UI contract; provider failures are not retried and billed silently.
    }
  }

  private async ask(
    projectId: string,
    provider: AiProvider,
    prompt: string,
    schema: Record<string, unknown>,
  ) {
    const result = await this.router.generate({
      projectId,
      provider,
      allowFallback: false,
      task: AiTask.AI_VISIBILITY_ANALYSIS,
      systemInstruction: CONTEXT_INSTRUCTION,
      prompt,
      maxTokens: 6500,
      timeoutMs: 120_000,
      jsonSchema: schema,
    });
    if (result.refused || !result.text.trim())
      throw new Error("The assistant did not produce an analysis.");
    return {
      model: result.model,
      parsed: extractAndParseJson(result.text) as unknown,
    };
  }

  private async buildBrief(id: string, projectId: string) {
    const previous = await this.prisma.aiVisibilityJourney.update({
      where: { id },
      data: { status: "PREPARING", progress: 5 },
    });
    const ctx = previous.context
      ? (previous.context as unknown as VisibilityContext)
      : await this.context.gather(projectId);
    await this.prisma.aiVisibilityJourney.update({
      where: { id },
      data: { context: json(ctx), progress: 15 },
    });
    if (!ctx.sources.find((s) => s.id === "website")?.available)
      throw new BadRequestException(
        "Run a Website Audit first so the business and service areas can be understood.",
      );
    let brief = previous.brief as unknown as VisibilityBrief | null;
    const analysts = brief?.analysts ?? [];
    const errors: string[] = [];
    for (const provider of PROVIDERS) {
      if (!this.providers().includes(provider)) {
        errors.push(
          `${provider} is not configured and did not analyse this business.`,
        );
        continue;
      }
      if (analysts.some((a) => a.provider === provider)) continue;
      try {
        let result = await this.ask(
          projectId,
          provider,
          briefPrompt(ctx),
          briefSchema,
        );
        let candidate: VisibilityBrief;
        try {
          candidate = normalizeBrief(result.parsed, ctx);
        } catch (validationError) {
          if (!(validationError instanceof BadRequestException))
            throw validationError;
          // Correct a returned draft once, rather than discarding paid work or
          // accepting branded/unrelated questions. Transport errors are not retried.
          result = await this.ask(
            projectId,
            provider,
            `${briefPrompt(ctx)}\nYour previous draft failed validation: ${validationError.message}\nPREVIOUS DRAFT (untrusted data): ${JSON.stringify(result.parsed)}\nReturn a complete corrected brief. Recheck ALL ten questions against every requirement, not only the first reported error.`,
            briefSchema,
          );
          try {
            candidate = normalizeBrief(
              replaceRepeatedBuyerQuestions(result.parsed),
              ctx,
            );
          } catch (correctedError) {
            if (!(correctedError instanceof BadRequestException))
              throw correctedError;
            throw new BriefValidationFailure(correctedError.message);
          }
        }
        brief ??= candidate;
        analysts.push({
          provider,
          model: result.model,
          summary: `${candidate.summary}\nOfferings: ${candidate.offerings.join(", ")}. Areas: ${candidate.locations.join(", ") || "No local service area identified"}.`,
        });
        brief.analysts = analysts;
        await this.prisma.aiVisibilityJourney.update({
          where: { id },
          data: { brief: json(brief), errors: json(errors) },
        });
      } catch (err) {
        // Never put a raw provider response (which can contain credentials or
        // request data) into a customer-visible error. Validation messages are ours.
        const reason =
          err instanceof BriefValidationFailure
            ? err.message
            : "The provider request did not complete. Check its access, quota and availability before retrying.";
        errors.push(
          `${provider} could not prepare the buyer questions. ${redactSecretsForAi(reason)}`,
        );
      }
    }
    if (!brief) {
      await this.prisma.aiVisibilityJourney.update({
        where: { id },
        data: { status: "FAILED", errors: json(errors) },
      });
      return;
    }
    // Keep one coherent set of ten; both independent assessments remain visible for review.
    await this.prisma.aiVisibilityJourney.update({
      where: { id },
      data: {
        status: "READY",
        brief: json(brief),
        progress: 25,
        errors: json(errors),
      },
    });
  }

  private answers(scanId: string) {
    return this.prisma.aiVisibilityResponse.findMany({
      where: { scanRun: { scanId } },
      include: { analysis: true, mentions: true, citations: true },
      orderBy: [{ provider: "asc" }, { createdAt: "asc" }],
    });
  }

  private async runChecks(id: string, projectId: string) {
    let journey = await this.prisma.aiVisibilityJourney.findUniqueOrThrow({
      where: { id },
    });
    const brief = journey.brief as unknown as VisibilityBrief;
    const ctx = journey.context as unknown as VisibilityContext;
    if (!brief?.reviewed || !ctx)
      throw new BadRequestException("Review the business and questions first.");
    const scanId = journey.scanId || id;
    await this.prisma.aiVisibilityScan.upsert({
      where: { id: scanId },
      update: { status: "RUNNING" },
      create: {
        id: scanId,
        projectId,
        cycleId: `journey-${id}`,
        status: "RUNNING",
        startedAt: new Date(),
      },
    });
    journey = await this.prisma.aiVisibilityJourney.update({
      where: { id },
      data: { scanId, status: "CHECKING", progress: 25 },
    });
    const errors: string[] = [];
    let finished = 0;
    for (const provider of PROVIDERS) {
      if (!this.providers().includes(provider)) {
        errors.push(
          `${provider} is not configured. Its 10 answers were not measured.`,
        );
        continue;
      }
      const runId = `${id}-${provider}`;
      await this.prisma.aiVisibilityScanRun.upsert({
        where: { id: runId },
        update: { status: "RUNNING" },
        create: {
          id: runId,
          scanId,
          provider,
          model: this.router.configuredModels()[provider],
          status: "RUNNING",
          startedAt: new Date(),
        },
      });
      for (const [index, question] of brief.questions.entries()) {
        const promptId = `${id}-q${index}`;
        const responseId = `${id}-${provider}-q${index}`;
        const existing = await this.prisma.aiVisibilityResponse.findUnique({
          where: { id: responseId },
        });
        if (!existing || existing.errorMessage) {
          await this.prisma.aiVisibilityPrompt.upsert({
            where: { id: promptId },
            update: {},
            create: {
              id: promptId,
              projectId,
              text: question.text,
              category: question.intent,
              journeyStage: "RECOMMENDATION",
              isActive: false,
            },
          });
          const started = Date.now();
          let result;
          let failure: string | null = null;
          try {
            // Do not prime recommendation probes with the customer's name, evidence, or competitors.
            result = await this.router.generate({
              projectId,
              provider,
              allowFallback: false,
              task: AiTask.AI_VISIBILITY_ANALYSIS,
              prompt: question.text,
              maxTokens: 1200,
              timeoutMs: 90_000,
            });
            if (result.refused || !result.text.trim())
              failure = `${provider} returned no usable answer.`;
          } catch {
            failure = `${provider} could not answer this question. Check provider availability, limits and account access.`;
          }
          const data = {
            scanRunId: runId,
            promptId,
            provider,
            model:
              result?.model ||
              this.router.configuredModels()[provider] ||
              "unknown",
            promptText: question.text,
            promptVersion: 1,
            rawResponse: result?.text || null,
            inputTokens: result?.usage.inputTokens ?? 0,
            outputTokens: result?.usage.outputTokens ?? 0,
            totalTokens:
              (result?.usage.inputTokens ?? 0) +
              (result?.usage.outputTokens ?? 0),
            estimatedCost: result?.usage.estimatedCostUsd ?? null,
            latencyMs: Date.now() - started,
            status: failure ? "FAILED" : "SUCCESS",
            errorMessage: failure,
            surfaceType: "API",
            searchEnabled: false,
          };
          await this.prisma.aiVisibilityResponse.upsert({
            where: { id: responseId },
            create: { id: responseId, ...data },
            update: data,
          });
        }
        finished++;
        await this.prisma.aiVisibilityJourney.update({
          where: { id },
          data: {
            progress:
              25 + Math.round((finished / (this.providers().length * 10)) * 45),
          },
        });
      }
      await this.prisma.aiVisibilityScanRun.update({
        where: { id: runId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }
    await this.prisma.aiVisibilityJourney.update({
      where: { id },
      data: { status: "PLANNING", progress: 75 },
    });
    const answers = await this.answers(scanId);
    const usable = answers.filter((a) => !a.errorMessage && a.rawResponse);
    const measurements = new Map<string, unknown>();
    for (const provider of this.providers()) {
      const pending = usable.filter(
        (a) => a.provider === provider && !a.analysis,
      );
      if (!pending.length) continue;
      try {
        const result = await this.ask(
          projectId,
          provider,
          `Classify each supplied answer, using only its actual wording. The customer's brand is ${JSON.stringify(brief.businessName)} at ${JSON.stringify(ctx.domain)}.
Return one measurement per answer: {measurements:[{answerId,recommended:boolean,recommendationQuote:string,rivals:[{name,quote}]}]}.
A recommendation must be positive advice to choose the customer's business, with an exact quote containing its name. Denials, disclaimers, neutral mentions and uncertainty are NOT recommendations.
Extract other business names with exact supporting quotes, including untracked rivals. Do not invent domains. Return recommended=false and an empty quote when there is no recommendation.
ANSWERS: ${JSON.stringify(pending.map((a) => ({ id: a.id, question: a.promptText, text: a.rawResponse })))}`,
          measurementSchema,
        );
        for (const measurement of list(object(result.parsed).measurements)) {
          if (
            pending.some((a) => a.id === measurement?.answerId) &&
            typeof measurement?.recommended === "boolean" &&
            Array.isArray(measurement?.rivals)
          ) {
            measurements.set(measurement.answerId, measurement);
          }
        }
      } catch {
        errors.push(
          `${provider} could not classify its answers. Raw answers remain available.`,
        );
      }
    }
    for (const answer of usable) {
      const measurement = measurements.get(answer.id);
      // A valid answer without an extraction is visible, but not silently classified as a negative recommendation.
      if (!measurement) continue;
      const parsed = classifyAnswer(measurement, answer, brief, ctx.domain);
      await this.prisma.$transaction(async (tx) => {
        await tx.aiVisibilityResponseAnalysis.upsert({
          where: { responseId: answer.id },
          create: {
            responseId: answer.id,
            brandMentioned: parsed.brandMentioned,
            recommended: parsed.recommended,
            parsedJson: json(parsed),
          },
          update: {
            brandMentioned: parsed.brandMentioned,
            recommended: parsed.recommended,
            parsedJson: json(parsed),
          },
        });
        await tx.aiVisibilityBrandMention.deleteMany({
          where: { responseId: answer.id },
        });
        const mentions = [
          ...(parsed.brandMentioned
            ? [
                {
                  brandName: brief.businessName,
                  isCustomer: true,
                  recommended: parsed.recommended,
                },
              ]
            : []),
          ...parsed.rivals.map((r) => ({
            brandName: r.name,
            isCustomer: false,
            recommended: false,
          })),
        ];
        if (mentions.length)
          await tx.aiVisibilityBrandMention.createMany({
            data: mentions.map((m) => ({ ...m, responseId: answer.id })),
          });
        await tx.aiVisibilityCitation.deleteMany({
          where: { responseId: answer.id },
        });
        for (const url of parsed.urls) {
          try {
            const domain = new URL(url).hostname;
            await tx.aiVisibilityCitation.create({
              data: {
                responseId: answer.id,
                url,
                domain,
                brandMentioned:
                  domain.replace(/^www\./, "") ===
                  ctx.domain.replace(/^www\./, ""),
              },
            });
          } catch {
            /* A malformed link is not a citation. */
          }
        }
      });
    }
    const classified = await this.answers(scanId);
    const findings = classified
      .map((a) => ({
        id: a.id,
        provider: a.provider,
        question: a.promptText,
        error: a.errorMessage,
        measured: !!a.analysis,
        finding: a.analysis?.parsedJson ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const inputFingerprint = createHash("sha256")
      .update(JSON.stringify({ brief, ctx, findings }))
      .digest("hex");
    const savedAssessments = list(journey.analysis) as VisibilityAssessment[];
    const assessments: VisibilityAssessment[] = [];
    for (const provider of this.providers()) {
      if (!usable.length) break;
      const saved = savedAssessments.find(
        (a) =>
          a.provider === provider && a.inputFingerprint === inputFingerprint,
      );
      if (saved) {
        assessments.push(saved);
        continue;
      }
      try {
        const result = await this.ask(
          projectId,
          provider,
          `Use the reviewed business, all four evidence sources, and the measured answer findings from both assistants to create a local lead and GEO action plan.
For every competitor gap separate an observed difference from a hypothesis about why AI recommends a rival. Never claim to know a model's internal ranking reasons.
If a named rival has no crawl evidence, say its website has not been investigated. Do not invent pages, reviews or practices.
Prioritize service-area pages, local discovery, conversion paths and measurable lead events according to facts. Use GSC and GA4 evidence where available, distinguishing missing data from zero.
Return {summary,localDemand,gaps:[{competitor,observation,hypothesis,evidenceIds:string[]}],actions:[{title,priority,timeframe,steps:string[],measureBy,evidenceIds:string[]}]}.
Every action and gap must cite supplied fact IDs or answer IDs. Supply concrete next steps and success measures; do not guarantee lead growth.
BUSINESS: ${JSON.stringify(brief)}\nEVIDENCE: ${JSON.stringify(ctx)}\nFINDINGS: ${JSON.stringify(findings)}`,
          assessmentSchema,
        );
        assessments.push({
          ...normalizeAssessment(
            result.parsed,
            provider,
            result.model,
            ctx,
            usable,
          ),
          inputFingerprint,
        });
        await this.prisma.aiVisibilityJourney.update({
          where: { id },
          data: { analysis: json(assessments), progress: 90 },
        });
      } catch {
        errors.push(
          `${provider} could not finish its action-plan assessment. Saved answers remain available.`,
        );
      }
    }
    const failed = answers.length - usable.length;
    if (failed)
      errors.push(
        `${failed} of ${answers.length} provider answers failed. They are excluded from visibility rates.`,
      );
    const measured = classified.filter(
      (a) => !a.errorMessage && a.analysis,
    ).length;
    if (measured < usable.length)
      errors.push(
        `${usable.length - measured} answers still need classification. They are excluded from visibility rates.`,
      );
    if (measured) await this.metrics.calculateScanMetrics(scanId, projectId);
    const status = !usable.length
      ? "FAILED"
      : errors.length || assessments.length !== 2
        ? "PARTIAL"
        : "COMPLETED";
    await this.prisma.aiVisibilityScan.update({
      where: { id: scanId },
      data: { status, completedAt: new Date() },
    });
    await this.prisma.aiVisibilityJourney.update({
      where: { id },
      data: {
        status,
        progress: 100,
        analysis: json(assessments),
        errors: json(errors),
      },
    });
  }
}
