import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { OrgContextService } from '../organizations/org-context.service';
import { VoiceToolsService } from './voice-tools.service';
import {
  VoiceChatRequest,
  VoiceAgentResult,
  VoiceIntent,
  VoiceToolName,
  VOICE_TOOLS,
} from './voice-agent.types';

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    tool: { type: 'string' },
    params: { type: 'object' },
    clarification: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['tool', 'params', 'confidence'],
  additionalProperties: false,
} as const;

const ALLOWED_TOOLS = new Set<string>(Object.keys(VOICE_TOOLS));

const NAVIGATE_ROUTES: Record<string, string> = {
  overview: '/dashboard',
  dashboard: '/dashboard',
  website: '/website',
  competitors: '/competitors',
  opportunities: '/opportunities',
  'content intelligence': '/content-intelligence',
  'content gaps': '/content-intelligence',
  reports: '/reports',
  'ai agent': '/engineer',
  engineer: '/engineer',
  monitoring: '/monitoring',
  search: '/search',
  analytics: '/analytics',
  settings: '/settings',
  integrations: '/integrations',
  'market research': '/market-research',
  strategy: '/strategy',
};

@Injectable()
export class VoiceAgentService {
  private readonly logger = new Logger(VoiceAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    private readonly orgContext: OrgContextService,
    private readonly tools: VoiceToolsService,
  ) {}

  // ─── Session management ─────────────────────────────────────────────────────

  async createSession(userId: string, orgId: string, projectId?: string): Promise<string> {
    const session = await this.prisma.voiceSession.create({
      data: { userId, orgId, projectId: projectId ?? null },
    });
    return session.id;
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.voiceSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 }, toolCalls: { orderBy: { createdAt: 'asc' }, take: 20 } },
    });
    if (!session) throw new NotFoundException('Voice session not found');
    if (session.userId !== userId) throw new ForbiddenException('Access denied');
    return session;
  }

  // ─── Main dispatch ───────────────────────────────────────────────────────────

  async dispatch(req: VoiceChatRequest, userId: string, orgId: string): Promise<VoiceAgentResult> {
    // Validate project membership
    if (req.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: req.projectId },
        select: { organizationId: true },
      });
      if (!project) throw new NotFoundException('Project not found');
      await this.orgContext.assertMembership(userId, project.organizationId);
    }

    // Persist user message
    await this.persistMessage(req.sessionId, 'user', req.text);

    let result: VoiceAgentResult;

    // If this is a confirmed continuation, execute directly
    if (req.confirmed && req.pendingTool && ALLOWED_TOOLS.has(req.pendingTool)) {
      result = await this.executeTool(req.pendingTool, req.pendingParams ?? {}, req.projectId, userId, orgId);
    } else {
      // Classify intent
      const intent = await this.classifyIntent(req.text, req.projectId);
      result = await this.handleIntent(intent, req.projectId, userId, orgId);
    }

    // Persist assistant response
    await this.persistMessage(req.sessionId, 'assistant', result.spokenSummary);

    // Log tool call
    if (result.tool && !result.confirmationRequired) {
      await this.prisma.agentToolCall.create({
        data: {
          sessionId: req.sessionId,
          toolName: result.tool,
          input: (req.pendingParams ?? {}) as any,
          output: result.data as any,
          status: result.success ? 'SUCCESS' : 'FAILED',
          errorMsg: result.error ?? null,
        },
      });
    }

    return result;
  }

  // ─── Intent classification ────────────────────────────────────────────────────

  private async classifyIntent(text: string, projectId?: string): Promise<VoiceIntent> {
    const allowedTools = Object.keys(VOICE_TOOLS).join(', ');
    const navRoutes = Object.keys(NAVIGATE_ROUTES).join(', ');

    const prompt = `You are an intent classifier for an AI SEO voice assistant called Aiva.

User said: "${text}"

Classify this into one of these exact tool names: ${allowedTools}

Navigation keywords map to: ${navRoutes}

For navigation, set tool="navigate" and params={"destination":"<keyword>"}
For competitor commands, extract domain from user text and set params={"domain":"<domain>"}
For crawl commands, set params={}
For addCompetitor: params={"domain":"<competitor domain>"}
For removeCompetitor: params={"domain":"<competitor domain>"}
For generateReport: params={}
For generateStrategy: params={}
For findContentGaps: params={}
For getTopRecommendations: params={}
For getAuditSummary: params={}
For unknown requests: tool="getTopRecommendations", params={}, confidence=0.3

Respond with JSON only, no explanation.`;

    try {
      const completion = await this.router.generate({
        prompt,
        systemInstruction: 'You classify user voice commands. Reply with valid JSON only.',
        task: AiTask.FAST,
        organizationId: undefined,
        jsonSchema: INTENT_SCHEMA as unknown as Record<string, unknown>,
      });

      if (completion.refused || !completion.text.trim()) {
        return this.fallbackIntent(text);
      }

      const parsed = JSON.parse(completion.text) as VoiceIntent;
      if (!ALLOWED_TOOLS.has(parsed.tool)) {
        return this.fallbackIntent(text);
      }
      return { ...parsed, confidence: parsed.confidence ?? 0.5 };
    } catch (err) {
      this.logger.warn(`Intent classification failed: ${err.message}`);
      return this.fallbackIntent(text);
    }
  }

  private fallbackIntent(text: string): VoiceIntent {
    const lower = text.toLowerCase();
    if (lower.includes('crawl') || lower.includes('scan') || lower.includes('audit my website')) {
      return { tool: 'crawlWebsite', params: {}, confidence: 0.8 };
    }
    if (lower.includes('competitor') && lower.includes('add')) {
      return { tool: 'addCompetitor', params: {}, confidence: 0.6, clarification: 'Which competitor domain should I add?' };
    }
    if (lower.includes('content gap') || lower.includes('gap')) {
      return { tool: 'findContentGaps', params: {}, confidence: 0.8 };
    }
    if (lower.includes('opportunit')) {
      return { tool: 'detectOpportunities', params: {}, confidence: 0.8 };
    }
    if (lower.includes('report')) {
      return { tool: 'generateReport', params: {}, confidence: 0.7 };
    }
    if (lower.includes('strateg')) {
      return { tool: 'generateStrategy', params: {}, confidence: 0.7 };
    }
    return { tool: 'getTopRecommendations', params: {}, confidence: 0.4 };
  }

  // ─── Intent → action ─────────────────────────────────────────────────────────

  private async handleIntent(
    intent: VoiceIntent,
    projectId: string | undefined,
    userId: string,
    orgId: string,
  ): Promise<VoiceAgentResult> {
    if (intent.clarification && intent.confidence < 0.5) {
      return {
        success: true,
        tool: null,
        data: null,
        spokenSummary: intent.clarification,
      };
    }

    const toolDef = VOICE_TOOLS[intent.tool];
    if (!toolDef) {
      return { success: false, tool: null, data: null, spokenSummary: "Sorry, I didn't understand that. Could you rephrase?" };
    }

    // Confirmation guard
    if (toolDef.requiresConfirmation) {
      const confirmMessage = this.buildConfirmationMessage(intent.tool, intent.params);
      return {
        success: true,
        tool: intent.tool,
        data: null,
        spokenSummary: confirmMessage,
        confirmationRequired: { message: confirmMessage, blocking: true },
      };
    }

    return this.executeTool(intent.tool, intent.params, projectId, userId, orgId);
  }

  private buildConfirmationMessage(tool: VoiceToolName, params: Record<string, any>): string {
    switch (tool) {
      case 'crawlWebsite':
        return "I'll start crawling your website. This may take a few minutes. Should I continue?";
      case 'cancelCrawl':
        return 'Should I cancel the current crawl?';
      case 'addCompetitor':
        return params.domain
          ? `Should I add ${params.domain} as a competitor?`
          : 'Which competitor domain should I add?';
      case 'removeCompetitor':
        return params.domain
          ? `Should I remove ${params.domain} from your competitors?`
          : 'Which competitor should I remove?';
      case 'runSeoAudit':
        return 'Should I run a full SEO audit? This may take a few minutes.';
      case 'generateReport':
        return 'Should I generate a full SEO report?';
      case 'generateStrategy':
        return 'Should I generate an AI-powered SEO strategy? This uses your latest audit data.';
      case 'crawlCompetitor':
        return params.domain
          ? `Should I crawl ${params.domain} for competitor analysis?`
          : 'Which competitor site should I crawl?';
      default:
        return 'Should I proceed with this action?';
    }
  }

  // ─── Tool execution ──────────────────────────────────────────────────────────

  private async executeTool(
    tool: VoiceToolName,
    params: Record<string, any>,
    projectId: string | undefined,
    userId: string,
    orgId: string,
  ): Promise<VoiceAgentResult> {
    this.logger.log(`Executing voice tool: ${tool} for project ${projectId}`);

    try {
      switch (tool) {
        case 'crawlWebsite':
          return await this.tools.crawlWebsite(projectId!, userId, orgId);
        case 'getCrawlStatus':
          return await this.tools.getCrawlStatus(projectId!, userId, orgId);
        case 'cancelCrawl':
          return await this.tools.cancelCrawl(params.jobId, userId, orgId);
        case 'addCompetitor':
          return await this.tools.addCompetitor(projectId!, params.domain, userId, orgId);
        case 'listCompetitors':
          return await this.tools.listCompetitors(projectId!, userId, orgId);
        case 'removeCompetitor':
          return await this.tools.removeCompetitor(projectId!, params.domain, userId, orgId);
        case 'compareWebsites':
          return await this.tools.compareWebsites(projectId!, userId, orgId);
        case 'runSeoAudit':
          return await this.tools.runSeoAudit(projectId!, userId, orgId);
        case 'findContentGaps':
          return await this.tools.findContentGaps(projectId!, userId, orgId);
        case 'detectOpportunities':
          return await this.tools.detectOpportunities(projectId!, userId, orgId);
        case 'getTopRecommendations':
          return await this.tools.getTopRecommendations(projectId!, userId, orgId);
        case 'generateReport':
          return await this.tools.generateReport(projectId!, userId, orgId);
        case 'generateStrategy':
          return await this.tools.generateStrategy(projectId!, userId, orgId);
        case 'getAuditSummary':
          return await this.tools.getAuditSummary(projectId!, userId, orgId);
        case 'crawlCompetitor':
          return await this.tools.crawlCompetitor(projectId!, params.domain, userId, orgId);
        case 'navigate': {
          const destination = (params.destination as string)?.toLowerCase() ?? '';
          const route = NAVIGATE_ROUTES[destination] ?? '/dashboard';
          return {
            success: true,
            tool: 'navigate',
            data: { route },
            spokenSummary: `Opening ${destination}.`,
            navigateTo: route,
          };
        }
        default:
          return { success: false, tool: null, data: null, spokenSummary: "I don't know how to do that yet." };
      }
    } catch (err: any) {
      this.logger.error(`Voice tool ${tool} failed: ${err.message}`);
      return {
        success: false,
        tool,
        data: null,
        spokenSummary: `Something went wrong: ${err.message ?? 'Please try again.'}`,
        error: err.message,
      };
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async persistMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
    try {
      await this.prisma.voiceMessage.create({ data: { sessionId, role, content } });
    } catch (err) {
      this.logger.warn(`Failed to persist voice message: ${err.message}`);
    }
  }
}
