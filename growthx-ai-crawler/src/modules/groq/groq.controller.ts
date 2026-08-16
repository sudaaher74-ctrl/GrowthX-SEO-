import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { UsageMetric } from '@prisma/client';
import {
  MultiAiRouterService,
  AiProvider,
  AiTask,
} from '../ai-search/multi-ai-router/multi-ai-router.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { EntitlementsService } from '../billing/entitlements.service';
import { Metered } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';

/** A single turn in a conversation. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Single-message shorthand body. */
export interface SingleMessageBody {
  message?: string;
  /** Optional conversation history. When present, `message` is ignored. */
  messages?: ChatMessage[];
  /** Optional override for the system prompt. */
  systemPrompt?: string;
}

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);

/** Maximum combined content size to prevent abuse. */
const MAX_MESSAGE_CHARS = 10_000;

/** Default system prompt used when the caller does not supply one. */
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant for GrowthX AI SEO.
Give accurate, concise and practical answers.
When the user asks a technical question:
- explain the problem clearly
- provide practical steps
- provide code when necessary
- do not invent information
- ask for missing information only when necessary`;

@ApiTags('AI')
@ApiBearerAuth()
@Controller('api/ai')
// This endpoint spends money on every call. It was previously unauthenticated,
// which made it a public endpoint that draws down the account's LLM budget with
// no caller identity, no plan check and no usage record.
@UseGuards(JwtAuthGuard, EntitlementsGuard)
export class GroqController {
  private readonly logger = new Logger(GroqController.name);

  constructor(
    private readonly aiRouter: MultiAiRouterService,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementsService,
  ) {}

  // ----------------------------------------------------------------- /health

  @Get('health')
  @ApiOperation({ summary: 'Groq AI provider health check' })
  @ApiResponse({ status: 200, description: 'Provider configuration status' })
  getHealth() {
    const configured = this.aiRouter.configuredProviders().includes(AiProvider.GROQ);
    const model = this.config.get<string>('GROQ_MODEL') || 'llama-3.1-8b-instant';
    return {
      success: true,
      provider: 'groq',
      model,
      configured,
    };
  }

  // ------------------------------------------------------------------ /chat

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @Metered(Feature.MODEL_GROQ, UsageMetric.AI_ANALYSES)
  @ApiOperation({ summary: 'Chat with Groq Llama 3.1 8B Instant' })
  @ApiResponse({ status: 200, description: 'AI response' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'Plan does not include this model, or quota is spent' })
  @ApiResponse({ status: 500, description: 'AI service error' })
  async chat(@Req() req: any, @Body() body: SingleMessageBody) {
    // ── 1. Build message array ──────────────────────────────────────────────

    let messages: ChatMessage[];

    if (Array.isArray(body.messages) && body.messages.length > 0) {
      // Multi-turn conversation mode
      messages = body.messages;
    } else if (typeof body.message === 'string') {
      // Single-message shorthand
      messages = [{ role: 'user', content: body.message }];
    } else {
      throw new BadRequestException('Provide either "message" (string) or "messages" (array).');
    }

    // ── 2. Validate ─────────────────────────────────────────────────────────

    for (const msg of messages) {
      if (!ALLOWED_ROLES.has(msg.role)) {
        throw new BadRequestException(
          `Invalid role "${msg.role}". Allowed: system, user, assistant.`,
        );
      }
      if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
        throw new BadRequestException('Each message must have non-empty string "content".');
      }
    }

    // Guard: strip 'system' messages from the array — the router injects its own
    // system instruction; having two system messages can confuse some providers.
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    if (conversationMessages.length === 0) {
      throw new BadRequestException('At least one user or assistant message is required.');
    }

    const lastUserMessage = [...conversationMessages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage || lastUserMessage.content.trim().length === 0) {
      throw new BadRequestException('The last message must be a non-empty user message.');
    }

    // Size guard
    const totalChars = conversationMessages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > MAX_MESSAGE_CHARS) {
      throw new BadRequestException(
        `Request too large. Total message content must not exceed ${MAX_MESSAGE_CHARS} characters.`,
      );
    }

    // ── 3. Check configuration ───────────────────────────────────────────────

    if (!this.aiRouter.configuredProviders().includes(AiProvider.GROQ)) {
      this.logger.warn('GROQ_API_KEY is not configured.');
      return {
        success: false,
        error: 'AI service is not configured.',
      };
    }

    // ── 4. Build prompt for the router ───────────────────────────────────────
    //
    // MultiAiRouterService accepts a single `prompt` string and an optional
    // `systemInstruction`. For multi-turn conversations we serialize the history
    // into the prompt so the model receives full context.

    const systemInstruction = body.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;

    let prompt: string;
    if (conversationMessages.length === 1) {
      prompt = conversationMessages[0].content;
    } else {
      // Serialize conversation as a clearly-labelled transcript
      prompt = conversationMessages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');
    }

    // ── 5. Call Groq via the router ──────────────────────────────────────────

    try {
      const completion = await this.aiRouter.generate({
        prompt,
        systemInstruction,
        task: AiTask.FAST,           // Groq excels at FAST; it's #1 in the chain
        provider: AiProvider.GROQ,   // Force Groq — this endpoint is Groq-specific
        // Set by EntitlementsGuard. Passing it lets the router enforce which
        // vendors this organization's plan may reach.
        organizationId: req.organizationId,
      });

      await this.entitlements.recordUsage(req.organizationId, UsageMetric.AI_ANALYSES);

      this.logger.log(
        `Groq response: ${completion.usage.inputTokens}in / ${completion.usage.outputTokens}out`,
      );

      return {
        success: true,
        response: completion.text,
        usage: {
          inputTokens: completion.usage.inputTokens,
          outputTokens: completion.usage.outputTokens,
          totalTokens: completion.usage.inputTokens + completion.usage.outputTokens,
          estimatedCostUsd: completion.usage.estimatedCostUsd,
        },
        model: completion.model,
      };
    } catch (error: any) {
      // Rate-limit detection (Groq returns 429)
      if (error?.status === 429 || /rate.?limit/i.test(error?.message ?? '')) {
        this.logger.warn(`Groq rate limit hit: ${error.message}`);
        return {
          success: false,
          error: 'AI service is temporarily rate limited. Please try again in a moment.',
        };
      }

      // All other errors — log detail, return safe message
      this.logger.error(`Groq API error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('AI service is temporarily unavailable.');
    }
  }
}
