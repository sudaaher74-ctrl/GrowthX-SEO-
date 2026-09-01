export type AivaState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'confirming'
  | 'working'
  | 'speaking'
  | 'completed'
  | 'error';

export type VoiceToolName =
  | 'crawlWebsite'
  | 'getCrawlStatus'
  | 'cancelCrawl'
  | 'addCompetitor'
  | 'listCompetitors'
  | 'removeCompetitor'
  | 'compareWebsites'
  | 'runSeoAudit'
  | 'findContentGaps'
  | 'detectOpportunities'
  | 'getTopRecommendations'
  | 'generateReport'
  | 'generateStrategy'
  | 'navigate'
  | 'getAuditSummary'
  | 'crawlCompetitor';

export interface VoiceTool {
  name: VoiceToolName;
  /** True when the tool modifies data or starts a long-running job. */
  requiresConfirmation: boolean;
  /** Maximum page count before we upgrade the confirmation requirement. */
  largeCrawlThreshold?: number;
}

export const VOICE_TOOLS: Record<VoiceToolName, VoiceTool> = {
  crawlWebsite: { name: 'crawlWebsite', requiresConfirmation: true },
  getCrawlStatus: { name: 'getCrawlStatus', requiresConfirmation: false },
  cancelCrawl: { name: 'cancelCrawl', requiresConfirmation: true },
  addCompetitor: { name: 'addCompetitor', requiresConfirmation: true },
  listCompetitors: { name: 'listCompetitors', requiresConfirmation: false },
  removeCompetitor: { name: 'removeCompetitor', requiresConfirmation: true },
  compareWebsites: { name: 'compareWebsites', requiresConfirmation: false },
  runSeoAudit: { name: 'runSeoAudit', requiresConfirmation: true },
  findContentGaps: { name: 'findContentGaps', requiresConfirmation: false },
  detectOpportunities: { name: 'detectOpportunities', requiresConfirmation: false },
  getTopRecommendations: { name: 'getTopRecommendations', requiresConfirmation: false },
  generateReport: { name: 'generateReport', requiresConfirmation: true },
  generateStrategy: { name: 'generateStrategy', requiresConfirmation: true },
  navigate: { name: 'navigate', requiresConfirmation: false },
  getAuditSummary: { name: 'getAuditSummary', requiresConfirmation: false },
  crawlCompetitor: { name: 'crawlCompetitor', requiresConfirmation: true },
};

export interface VoiceIntent {
  tool: VoiceToolName;
  params: Record<string, string | number | boolean>;
  /** Natural language clarification for the user if needed. */
  clarification?: string;
  /** Confidence 0–1 from intent classifier. */
  confidence: number;
}

export interface ConfirmationRequired {
  message: string;
  /** True if this is blocking — user MUST confirm before tool runs. */
  blocking: boolean;
}

export interface VoiceAgentResult {
  success: boolean;
  tool: VoiceToolName | null;
  data: unknown;
  /** Short sentence(s) for TTS. Always present even on error. */
  spokenSummary: string;
  /** Route to navigate to after the action. */
  navigateTo?: string;
  /** Populated when confirmation is needed before the tool can run. */
  confirmationRequired?: ConfirmationRequired;
  /** Technical error details (not for TTS). */
  error?: string;
}

export interface VoiceChatRequest {
  text: string;
  sessionId: string;
  projectId: string;
  /** True when user confirmed a previously requested action. */
  confirmed?: boolean;
  /** Tool + params from the pending confirmation, echoed back by the client. */
  pendingTool?: VoiceToolName;
  pendingParams?: Record<string, string | number | boolean>;
}

export interface VoiceSessionDto {
  sessionId: string;
  projectId: string | null;
  orgId: string;
  createdAt: string;
}
