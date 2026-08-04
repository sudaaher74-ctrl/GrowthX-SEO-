import { ConfigService } from '@nestjs/config';
import { EntitlementsService } from '../../billing/entitlements.service';
export declare enum AiProvider {
    GEMINI = "GEMINI",
    OPENAI = "OPENAI",
    ANTHROPIC = "ANTHROPIC"
}
/** What the caller wants done, independent of which vendor ends up serving it. */
export declare enum AiTask {
    /** Deep SEO reasoning, strategy, competitive analysis. */
    REASONING = "REASONING",
    /** Generating code patches for the autonomous engineer. */
    CODE_GEN = "CODE_GEN",
    /** Cheap, high-volume extraction and classification. */
    FAST = "FAST"
}
export interface AiRequest {
    prompt: string;
    systemInstruction?: string;
    task?: AiTask;
    /** Force a specific vendor. Denied with 403 if the plan does not include it. */
    provider?: AiProvider;
    /** When present, the organization's plan decides which vendors are reachable. */
    organizationId?: string;
    /** JSON Schema. When supplied, the response is constrained to match it. */
    jsonSchema?: Record<string, unknown>;
    maxTokens?: number;
}
export interface AiUsage {
    inputTokens: number;
    outputTokens: number;
    /** Null when we have no published rate for the model — never a guessed number. */
    estimatedCostUsd: number | null;
}
export interface AiCompletion {
    provider: AiProvider;
    model: string;
    text: string;
    usage: AiUsage;
    /** Set when the vendor's safety classifiers declined rather than answered. */
    refused: boolean;
}
export declare class MultiAiRouterService {
    private readonly config;
    private readonly entitlements;
    private readonly logger;
    private readonly anthropicModel;
    private readonly geminiModel;
    private readonly openaiModel;
    private anthropic?;
    private openai?;
    private gemini?;
    /**
     * Anthropic's server-side refusal fallback re-serves a declined request on
     * another model inside the same call. It is behind a beta flag, so a
     * rejection here degrades to a plain call rather than failing the request.
     */
    private serverSideFallbackEnabled;
    constructor(config: ConfigService, entitlements: EntitlementsService);
    /** Placeholder values from .env.example must not count as configured. */
    private isRealKey;
    configuredProviders(): AiProvider[];
    /**
     * Runs a prompt against the best vendor the caller's plan allows.
     *
     * Selection order: an explicitly requested provider (403 if not in plan) →
     * the task's preference list, filtered to what the plan allows and what has
     * credentials. If the chosen vendor errors or its safety classifiers decline,
     * the next allowed vendor is tried.
     */
    generate(request: AiRequest): Promise<AiCompletion>;
    /** Vendors the org's plan permits, intersected with what has credentials. */
    private allowedProviders;
    /** Raises the plan-upgrade 403 when the block is entitlement rather than config. */
    private assertProviderEntitled;
    private invoke;
    private callAnthropic;
    /**
     * Asks Anthropic to re-serve a declined request on its recommended fallback
     * model. The beta may not be enabled on every account, so a rejection here
     * disables the flag and retries plainly rather than failing the caller.
     */
    private anthropicWithFallback;
    private callOpenAi;
    private callGemini;
    /** Operator-supplied rates for vendors whose pricing we don't hard-code. */
    private envRate;
    private usage;
}
