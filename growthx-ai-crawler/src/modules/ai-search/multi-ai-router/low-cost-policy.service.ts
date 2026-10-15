import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { AiCompletion, AiRequest } from './multi-ai-router.types';
import { APPROVED_MODELS, ApprovedModel, costBucket, policyTokens } from './low-cost-policy';

@Injectable()
export class LowCostPolicyService {
  private catalog?: { expires: number; data: Map<string, any> };
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private limit(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const value = raw == null || raw === '' ? fallback : Number(raw);
    if (!Number.isFinite(value) || value < 0) throw new ServiceUnavailableException(`Invalid AI cost setting: ${key}`);
    return value;
  }

  async verifyPrice(model: ApprovedModel): Promise<void> {
    const ceiling = APPROVED_MODELS[model];
    if (!ceiling) throw new ForbiddenException('Model is outside the approved low-cost allowlist.');
    if (model.startsWith('gemini-')) {
      // Direct Google text-only tariff reviewed against its official pricing.
      // An expired review stops paid requests rather than trusting stale prices.
      const reviewed = this.config.get<string>('AI_GOOGLE_PRICES_VERIFIED_AT') || '2026-10-15';
      const age = Date.now() - Date.parse(reviewed);
      if (!Number.isFinite(age) || age < -86_400_000 || age > 7 * 86_400_000)
        throw new ServiceUnavailableException('Google model pricing review expired. Verify rates before resuming paid requests.');
      return;
    }
    if (!this.catalog || this.catalog.expires < Date.now()) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error('catalog unavailable');
        const body: any = await response.json();
        if (!Array.isArray(body.data)) throw new Error('invalid catalog');
        this.catalog = { expires: Date.now() + 3_600_000, data: new Map(body.data.map((m: any) => [m.id, m])) };
      } catch {
        throw new ServiceUnavailableException('Live model pricing could not be verified; paid request stopped.');
      }
    }
    const entry = this.catalog.data.get(model);
    if (!entry) throw new ServiceUnavailableException(`${model} is unavailable in the live OpenRouter catalog. No model was substituted.`);
    const input = Number(entry.pricing?.prompt) * 1_000_000;
    const output = Number(entry.pricing?.completion) * 1_000_000;
    const search = model === 'perplexity/sonar' ? Number(entry.pricing?.web_search) : 0;
    if (![input, output, search].every(n => Number.isFinite(n) && n >= 0) || input > ceiling.input || output > ceiling.output || search > ceiling.search)
      throw new ForbiddenException(`${model} exceeds its configured price ceiling.`);
    if (entry.reasoning?.mandatory) throw new ForbiddenException('Mandatory reasoning is disabled by the low-cost policy.');
  }

  async run(request: AiRequest, model: ApprovedModel, invoke: () => Promise<AiCompletion>): Promise<AiCompletion> {
    if (!request.organizationId) throw new ForbiddenException('AI requests require customer attribution for budget enforcement.');
    const category = costBucket(request);
    const task = category === 'VISIBILITY' ? 'VISIBILITY_MEASUREMENT' : request.task ?? 'FAST';
    const key = createHash('sha256').update(JSON.stringify({
      org: request.organizationId, project: request.projectId, task: request.task,
      model, prompt: request.prompt, system: request.systemInstruction, schema: request.jsonSchema,
      maxTokens: policyTokens(request), version: 1,
    })).digest('hex');
    // Only unchanged internal analysis may reuse output. Visibility always calls
    // the requested model afresh; saved scan answers remain historical evidence.
    if (category === 'INTERNAL') {
      const rows = await this.prisma.$queryRaw<any[]>`SELECT "completion" FROM "AiInternalAnalysisCache" WHERE "key"=${key} AND "expiresAt">NOW()`;
      if (rows[0]) {
        const completion = rows[0].completion as AiCompletion;
        return { ...completion, usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, actualCostUsd: 0, cached: true } };
      }
    }
    await this.verifyPrice(model);
    const rate = APPROVED_MODELS[model];
    const inputBytes = Buffer.byteLength(request.prompt + (request.systemInstruction ?? '') + JSON.stringify(request.jsonSchema ?? {}), 'utf8');
    if (inputBytes > 96_000) throw new ForbiddenException('AI input exceeds the low-cost context limit. Reduce the evidence supplied.');
    // UTF-8 bytes conservatively bound text tokens. Sonar may add retrieved
    // context, so reserve its full context window rather than just our prompt.
    const inputBound = model === 'perplexity/sonar' ? 127_072 : inputBytes + 1024;
    const reserved = (inputBound * rate.input + policyTokens(request) * rate.output) / 1_000_000 + rate.search;
    const fx = this.limit('AI_ACCOUNTING_INR_PER_USD', 100);
    if (!fx) throw new ServiceUnavailableException('AI accounting conversion must be positive.');
    const id = randomUUID();
    const started = Date.now();
    await this.prisma.$transaction(async tx => {
      // One PostgreSQL transaction lock protects reservations across API and
      // worker processes. In-flight spend is included before accepting a call.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(734193812)`;
      const org = await tx.organization.findUnique({ where: { id: request.organizationId }, select: { aiMonthlyBudgetUsd: true } });
      if (!org) throw new ForbiddenException('AI customer account was not found.');
      const totals = await tx.$queryRaw<any[]>`
        SELECT COALESCE(SUM(COALESCE("reservedCostUsd","estimatedCostUsd",0)),0)::float AS platform,
          COALESCE(SUM(CASE WHEN "organizationId"=${request.organizationId} THEN COALESCE("reservedCostUsd","estimatedCostUsd",0) ELSE 0 END),0)::float AS customer,
          COALESCE(SUM(CASE WHEN "organizationId"=${request.organizationId} AND COALESCE("budgetCategory",'INTERNAL')=${category} THEN COALESCE("reservedCostUsd","estimatedCostUsd",0) ELSE 0 END),0)::float AS bucket,
          COUNT(*) FILTER (WHERE "organizationId"=${request.organizationId} AND "taskType"='VISIBILITY_MEASUREMENT')::int AS measurements
        FROM "AiUsageRecord" WHERE "createdAt">=date_trunc('month',NOW() AT TIME ZONE 'UTC')`;
      const total = totals[0];
      const platformCap = this.limit('AI_PLATFORM_MONTHLY_INR', 1000) / fx;
      const customerCap = Math.min(this.limit('AI_CUSTOMER_MONTHLY_INR', 100) / fx, org.aiMonthlyBudgetUsd ?? Infinity);
      const defaults = { VISIBILITY: 70, INTERNAL: 20, FIX_ENGINE: 10 };
      const bucketCap = this.limit(`AI_${category}_MONTHLY_INR`, defaults[category]) / fx;
      if (Number(total.platform) + reserved > platformCap || Number(total.customer) + reserved > customerCap || Number(total.bucket) + reserved > bucketCap)
        throw new ForbiddenException(`The ${category.toLowerCase()} AI spending limit is reached. No paid request was sent.`);
      if (category === 'VISIBILITY' && Number(total.measurements) >= 300)
        throw new ForbiddenException('This customer has used its 300 monthly visibility requests, including failed attempts.');
      await tx.$executeRaw`INSERT INTO "AiUsageRecord" ("id","organizationId","projectId","taskType","provider","model","inputTokens","outputTokens","latencyMs","status","createdAt","budgetCategory","reservedCostUsd")
        VALUES (${id},${request.organizationId},${request.projectId ?? null},${task},${request.provider ?? 'GEMINI'},${model},0,0,0,'RESERVED',NOW(),${category},${reserved})`;
    }, { maxWait: 15_000, timeout: 20_000 });
    let result: AiCompletion;
    try {
      result = await invoke();
    } catch (error) {
      // A timeout may have been billed. Keep its reservation until reconciled;
      // never turn unknown vendor charges into zero or silently retry.
      await this.prisma.$executeRaw`UPDATE "AiUsageRecord" SET "status"='ERROR',"latencyMs"=${Date.now()-started},"error"='Provider request failed; worst-case reservation retained pending reconciliation.' WHERE "id"=${id}`;
      throw error;
    }
    const actual = result.usage.actualCostUsd;
    const estimate = result.usage.estimatedCostUsd;
    const accounted = actual != null && Number.isFinite(actual) && actual >= 0 ? actual : estimate;
    const held = accounted != null && Number.isFinite(accounted) && accounted >= 0 ? accounted : reserved;
    await this.prisma.$executeRaw`UPDATE "AiUsageRecord" SET "provider"=${result.provider},"model"=${result.model},"inputTokens"=${result.usage.inputTokens},"outputTokens"=${result.usage.outputTokens},"estimatedCostUsd"=${estimate},"actualCostUsd"=${actual ?? null},"webSearchCostUsd"=${result.usage.searchCostUsd ?? null},"generationId"=${result.usage.generationId ?? null},"reservedCostUsd"=${held},"latencyMs"=${Date.now()-started},"status"=${result.refused ? 'REFUSED' : 'OK'} WHERE "id"=${id}`;
    if (category === 'INTERNAL' && !result.refused && result.text) {
      // Caching is optional; accounting above is not.
      await this.prisma.$executeRaw`INSERT INTO "AiInternalAnalysisCache" ("key","completion","expiresAt") VALUES (${key},${JSON.stringify(result)}::jsonb,NOW()+INTERVAL '24 hours') ON CONFLICT ("key") DO UPDATE SET "completion"=EXCLUDED."completion","expiresAt"=EXCLUDED."expiresAt"`.catch(() => undefined);
    }
    return result;
  }
}
