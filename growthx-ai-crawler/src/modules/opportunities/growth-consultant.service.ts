import { Injectable, Logger } from '@nestjs/common';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { GrowthContextService } from './growth-context.service';

/**
 * Answers a question about a project from that project's own data.
 *
 * The system instruction is doing most of the work here, and it is written
 * against one specific failure. Asked "why did my traffic drop", a model with
 * a competitor's page count in its context will produce a fluent story in
 * which the competitor caused it — not because anything connects them, but
 * because both are in the window and a causal answer reads better than an
 * honest one. The brief states that competitor activity cannot be dated, and
 * these instructions say the rest.
 *
 * Nothing is sent to the model except the aggregated brief. No raw rows, no
 * customer records, and no OAuth token — GrowthContextService selects only
 * provider names off the table those live on.
 */
@Injectable()
export class GrowthConsultantService {
  private readonly logger = new Logger(GrowthConsultantService.name);

  private static readonly SYSTEM = [
    'You are the GrowthX growth consultant. You answer questions about one customer\'s website using only the evidence supplied.',
    '',
    'Rules, in order of importance:',
    '1. Every number you state must appear in the evidence. Never estimate, extrapolate, or round a figure into existence.',
    '2. Never assert a cause. The evidence records what changed, not why. If asked why something happened, say what moved, say what did not, and name the specific thing someone would need to look at to find out. A competitor publishing pages and a ranking falling in the same period is a coincidence until something links them, and nothing in the evidence can link them.',
    '3. Where the evidence says NOT CONNECTED or NOT MEASURED, say that. Do not treat it as zero and do not quietly leave it out — the absence is often the most useful thing you can tell someone.',
    '4. Be short. A few sentences and the numbers behind them. No preamble, no restating the question.',
    '5. If the evidence cannot answer the question, say so and say what would need connecting or crawling to answer it.',
  ].join('\n');

  constructor(
    private readonly context: GrowthContextService,
    private readonly ai: MultiAiRouterService,
  ) {}

  async ask(organizationId: string, projectId: string, question: string, days = 28) {
    const evidence = await this.context.brief(organizationId, projectId, days);

    const completion = await this.ai.generate({
      systemInstruction: GrowthConsultantService.SYSTEM,
      prompt: [`Question: ${question}`, '', evidence].join('\n'),
      // Reasoning rather than FAST: the judgement being asked for is which
      // of several signals matters, and a cheap model reliably answers that
      // with the most dramatic one.
      task: AiTask.REASONING,
      organizationId,
      maxTokens: 900,
    });

    return {
      answer: completion.text,
      // Returned alongside the answer so the customer can check it against the
      // same evidence the model saw. An answer nobody can audit is the thing
      // this whole design is trying to avoid.
      evidence,
      model: completion.model,
    };
  }
}
