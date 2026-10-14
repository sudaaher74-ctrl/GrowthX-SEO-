export interface VisibilityFact {
  id: string;
  source: string;
  text: string;
  url?: string;
}
export interface VisibilityContext {
  gatheredAt: string;
  businessName: string;
  domain: string;
  sources: {
    id: string;
    label: string;
    available: boolean;
    updatedAt: string | null;
    detail: string;
    href: string;
  }[];
  facts: VisibilityFact[];
  cities: { city: string; country: string; sessions: number }[];
  keyEvents: number | null;
  limitations: string[];
}
export interface BuyerQuestion {
  text: string;
  offering: string;
  location: string;
  intent: string;
  rationale: string;
  evidenceIds: string[];
}
export interface VisibilityBrief {
  businessName: string;
  summary: string;
  offerings: string[];
  locations: string[];
  questions: BuyerQuestion[];
  evidenceIds: string[];
  reviewed: boolean;
  analysts: { provider: string; model: string; summary: string }[];
}
export interface VisibilityAssessment {
  provider: string;
  model: string;
  summary: string;
  localDemand: string;
  gaps: {
    competitor: string;
    observation: string;
    hypothesis: string;
    evidenceIds: string[];
  }[];
  actions: {
    title: string;
    priority: "high" | "medium" | "low";
    evidenceIds: string[];
    steps: string[];
    measureBy: string;
    timeframe: string;
  }[];
}
export interface VisibilityAnswer {
  id: string;
  provider: string;
  model: string;
  promptText: string;
  rawResponse: string | null;
  errorMessage: string | null;
  createdAt: string;
  analysis: {
    brandMentioned: boolean;
    recommended: boolean;
    parsedJson?: { recommendationQuote?: string };
  } | null;
  mentions: { brandName: string; isCustomer: boolean }[];
  citations: { url: string; domain: string }[];
}
export interface VisibilityJourney {
  id: string;
  projectId: string;
  status: string;
  phase: string;
  progress: number;
  scanId: string | null;
  context: VisibilityContext | null;
  brief: VisibilityBrief | null;
  analysis: VisibilityAssessment[] | null;
  errors: string[];
  createdAt: string;
  updatedAt: string;
}
export interface VisibilityJourneyResponse {
  journey: VisibilityJourney | null;
  answers: VisibilityAnswer[];
  providers: { provider: string; configured: boolean; model: string | null }[];
}
export const journeyRunning = (status?: string) =>
  !!status && ["QUEUED", "PREPARING", "CHECKING", "PLANNING"].includes(status);
export const providerName = (provider: string) =>
  provider === "GEMINI"
    ? "Gemini"
    : provider === "SARVAM"
      ? "Sarvam"
      : provider;
