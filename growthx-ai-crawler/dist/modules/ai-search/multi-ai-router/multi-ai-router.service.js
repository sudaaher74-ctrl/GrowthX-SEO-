"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MultiAiRouterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiAiRouterService = exports.AiTask = exports.AiProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = require("@anthropic-ai/sdk");
const genai_1 = require("@google/genai");
const openai_1 = require("openai");
const entitlements_service_1 = require("../../billing/entitlements.service");
const plans_catalog_1 = require("../../billing/plans.catalog");
var AiProvider;
(function (AiProvider) {
    AiProvider["GEMINI"] = "GEMINI";
    AiProvider["OPENAI"] = "OPENAI";
    AiProvider["ANTHROPIC"] = "ANTHROPIC";
})(AiProvider || (exports.AiProvider = AiProvider = {}));
/** What the caller wants done, independent of which vendor ends up serving it. */
var AiTask;
(function (AiTask) {
    /** Deep SEO reasoning, strategy, competitive analysis. */
    AiTask["REASONING"] = "REASONING";
    /** Generating code patches for the autonomous engineer. */
    AiTask["CODE_GEN"] = "CODE_GEN";
    /** Cheap, high-volume extraction and classification. */
    AiTask["FAST"] = "FAST";
})(AiTask || (exports.AiTask = AiTask = {}));
/**
 * Published Anthropic rates. Other vendors are left out deliberately: we report
 * token counts for them but no cost, because a wrong margin number is worse
 * than an absent one. Set GEMINI_RATE_* / OPENAI_RATE_* to fill them in.
 */
const ANTHROPIC_RATES = {
    'claude-opus-5': { input: 5, output: 25 },
    'claude-sonnet-5': { input: 3, output: 15 },
    'claude-haiku-4-5': { input: 1, output: 5 },
};
/** Which vendor each task prefers, best first. */
const TASK_PREFERENCE = {
    [AiTask.REASONING]: [AiProvider.ANTHROPIC, AiProvider.GEMINI, AiProvider.OPENAI],
    [AiTask.CODE_GEN]: [AiProvider.ANTHROPIC, AiProvider.OPENAI, AiProvider.GEMINI],
    [AiTask.FAST]: [AiProvider.GEMINI, AiProvider.OPENAI, AiProvider.ANTHROPIC],
};
const PROVIDER_FEATURE = {
    [AiProvider.GEMINI]: plans_catalog_1.Feature.MODEL_GEMINI,
    [AiProvider.OPENAI]: plans_catalog_1.Feature.MODEL_GPT,
    [AiProvider.ANTHROPIC]: plans_catalog_1.Feature.MODEL_CLAUDE,
};
let MultiAiRouterService = MultiAiRouterService_1 = class MultiAiRouterService {
    constructor(config, entitlements) {
        this.config = config;
        this.entitlements = entitlements;
        this.logger = new common_1.Logger(MultiAiRouterService_1.name);
        this.anthropicModel = this.config.get('ANTHROPIC_MODEL') || 'claude-opus-5';
        this.geminiModel = this.config.get('GEMINI_MODEL') || 'gemini-2.5-pro';
        this.openaiModel = this.config.get('OPENAI_MODEL') || 'gpt-4o';
        this.serverSideFallbackEnabled = this.config.get('ANTHROPIC_SERVER_SIDE_FALLBACK') !== 'false';
        const anthropicKey = this.config.get('ANTHROPIC_API_KEY');
        if (this.isRealKey(anthropicKey))
            this.anthropic = new sdk_1.default({ apiKey: anthropicKey });
        const openaiKey = this.config.get('OPENAI_API_KEY');
        if (this.isRealKey(openaiKey))
            this.openai = new openai_1.OpenAI({ apiKey: openaiKey });
        const geminiKey = this.config.get('GEMINI_API_KEY');
        if (this.isRealKey(geminiKey))
            this.gemini = new genai_1.GoogleGenAI({ apiKey: geminiKey });
        this.logger.log(`AI providers configured: ${this.configuredProviders().join(', ') || 'none'}`);
    }
    /** Placeholder values from .env.example must not count as configured. */
    isRealKey(value) {
        return Boolean(value) && !value.startsWith('your_');
    }
    configuredProviders() {
        const configured = [];
        if (this.gemini)
            configured.push(AiProvider.GEMINI);
        if (this.openai)
            configured.push(AiProvider.OPENAI);
        if (this.anthropic)
            configured.push(AiProvider.ANTHROPIC);
        return configured;
    }
    /**
     * Runs a prompt against the best vendor the caller's plan allows.
     *
     * Selection order: an explicitly requested provider (403 if not in plan) →
     * the task's preference list, filtered to what the plan allows and what has
     * credentials. If the chosen vendor errors or its safety classifiers decline,
     * the next allowed vendor is tried.
     */
    async generate(request) {
        const task = request.task ?? AiTask.REASONING;
        const allowed = await this.allowedProviders(request.organizationId);
        if (request.provider) {
            if (!allowed.includes(request.provider)) {
                await this.assertProviderEntitled(request.organizationId, request.provider);
                throw new common_1.ServiceUnavailableException(`${request.provider} is not configured on this server.`);
            }
            return this.invoke(request.provider, request, task);
        }
        const chain = TASK_PREFERENCE[task].filter((p) => allowed.includes(p));
        if (chain.length === 0) {
            throw new common_1.ServiceUnavailableException('No AI provider is available for this plan. Check plan entitlements and provider API keys.');
        }
        let lastError;
        for (const provider of chain) {
            try {
                const completion = await this.invoke(provider, request, task);
                if (completion.refused && chain.length > 1) {
                    this.logger.warn(`${provider} declined the request; trying the next provider.`);
                    lastError = new Error(`${provider} declined the request.`);
                    continue;
                }
                return completion;
            }
            catch (error) {
                this.logger.warn(`${provider} failed: ${error.message}. Falling through.`);
                lastError = error;
            }
        }
        throw new common_1.ServiceUnavailableException(`All available AI providers failed. Last error: ${lastError?.message ?? 'unknown'}`);
    }
    /** Vendors the org's plan permits, intersected with what has credentials. */
    async allowedProviders(organizationId) {
        const configured = this.configuredProviders();
        if (!organizationId)
            return configured;
        const entitlements = await this.entitlements.getEntitlements(organizationId);
        return configured.filter((provider) => entitlements.features.includes(PROVIDER_FEATURE[provider]));
    }
    /** Raises the plan-upgrade 403 when the block is entitlement rather than config. */
    async assertProviderEntitled(organizationId, provider) {
        if (!organizationId)
            return;
        await this.entitlements.assertFeature(organizationId, PROVIDER_FEATURE[provider]);
    }
    invoke(provider, request, task) {
        switch (provider) {
            case AiProvider.ANTHROPIC:
                return this.callAnthropic(request, task);
            case AiProvider.OPENAI:
                return this.callOpenAi(request);
            case AiProvider.GEMINI:
                return this.callGemini(request);
        }
    }
    // ---------------------------------------------------------------- Anthropic
    async callAnthropic(request, task) {
        if (!this.anthropic)
            throw new common_1.ServiceUnavailableException('ANTHROPIC_API_KEY is not configured.');
        // Thinking is on by default on Opus 5 and counts against max_tokens, so the
        // budget has to cover reasoning as well as the answer or replies truncate.
        const maxTokens = request.maxTokens ?? 8000;
        const body = {
            model: this.anthropicModel,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: request.prompt }],
            output_config: {
                effort: task === AiTask.FAST ? 'low' : 'high',
                ...(request.jsonSchema ? { format: { type: 'json_schema', schema: request.jsonSchema } } : {}),
            },
        };
        if (request.systemInstruction)
            body.system = request.systemInstruction;
        // No temperature / top_p / top_k — those are rejected on this model family.
        const message = this.serverSideFallbackEnabled
            ? await this.anthropicWithFallback(body)
            : await this.anthropic.messages.create(body);
        // Safety classifiers decline with HTTP 200, so this must be checked before
        // reading content — otherwise an empty content array throws.
        const refused = message.stop_reason === 'refusal';
        const text = refused
            ? ''
            : message.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('');
        if (refused) {
            this.logger.warn(`Anthropic declined the request (${message.stop_details?.category ?? 'unspecified'}).`);
        }
        return {
            provider: AiProvider.ANTHROPIC,
            model: message.model,
            text,
            usage: this.usage(message.usage?.input_tokens ?? 0, message.usage?.output_tokens ?? 0, ANTHROPIC_RATES[message.model] ?? ANTHROPIC_RATES[this.anthropicModel]),
            refused,
        };
    }
    /**
     * Asks Anthropic to re-serve a declined request on its recommended fallback
     * model. The beta may not be enabled on every account, so a rejection here
     * disables the flag and retries plainly rather than failing the caller.
     */
    async anthropicWithFallback(body) {
        try {
            return await this.anthropic.beta.messages.create({
                ...body,
                betas: ['server-side-fallback-2026-07-01'],
                fallbacks: 'default',
            });
        }
        catch (error) {
            const message = String(error?.message ?? '');
            if (!/beta|fallback/i.test(message))
                throw error;
            this.logger.warn(`Server-side fallback unavailable (${message}); continuing without it.`);
            this.serverSideFallbackEnabled = false;
            return this.anthropic.messages.create(body);
        }
    }
    // ------------------------------------------------------------------- OpenAI
    async callOpenAi(request) {
        if (!this.openai)
            throw new common_1.ServiceUnavailableException('OPENAI_API_KEY is not configured.');
        const messages = [];
        if (request.systemInstruction)
            messages.push({ role: 'system', content: request.systemInstruction });
        messages.push({ role: 'user', content: request.prompt });
        const response = await this.openai.chat.completions.create({
            model: this.openaiModel,
            messages,
            max_tokens: request.maxTokens ?? 4000,
            ...(request.jsonSchema
                ? {
                    response_format: {
                        type: 'json_schema',
                        json_schema: { name: 'growthx_response', schema: request.jsonSchema, strict: true },
                    },
                }
                : {}),
        });
        return {
            provider: AiProvider.OPENAI,
            model: response.model,
            text: response.choices[0]?.message?.content ?? '',
            usage: this.usage(response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0, this.envRate('OPENAI')),
            refused: false,
        };
    }
    // ------------------------------------------------------------------- Gemini
    async callGemini(request) {
        if (!this.gemini)
            throw new common_1.ServiceUnavailableException('GEMINI_API_KEY is not configured.');
        const response = await this.gemini.models.generateContent({
            model: this.geminiModel,
            contents: request.prompt,
            config: {
                systemInstruction: request.systemInstruction,
                temperature: 0.2,
                ...(request.jsonSchema
                    ? { responseMimeType: 'application/json', responseSchema: request.jsonSchema }
                    : {}),
            },
        });
        const metadata = response.usageMetadata ?? {};
        return {
            provider: AiProvider.GEMINI,
            model: this.geminiModel,
            text: response.text || '',
            usage: this.usage(metadata.promptTokenCount ?? 0, metadata.candidatesTokenCount ?? 0, this.envRate('GEMINI')),
            refused: false,
        };
    }
    // -------------------------------------------------------------------- Costs
    /** Operator-supplied rates for vendors whose pricing we don't hard-code. */
    envRate(prefix) {
        const input = Number(this.config.get(`${prefix}_RATE_INPUT_PER_MTOK`));
        const output = Number(this.config.get(`${prefix}_RATE_OUTPUT_PER_MTOK`));
        return Number.isFinite(input) && Number.isFinite(output) && input > 0 ? { input, output } : undefined;
    }
    usage(inputTokens, outputTokens, rate) {
        const estimatedCostUsd = rate
            ? Number(((inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output).toFixed(6))
            : null;
        return { inputTokens, outputTokens, estimatedCostUsd };
    }
};
exports.MultiAiRouterService = MultiAiRouterService;
exports.MultiAiRouterService = MultiAiRouterService = MultiAiRouterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        entitlements_service_1.EntitlementsService])
], MultiAiRouterService);
//# sourceMappingURL=multi-ai-router.service.js.map