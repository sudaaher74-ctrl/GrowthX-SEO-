export interface VisibilityFact {
  id: string;
  source: string;
  text: string;
  url?: string;
}
export interface VisibilitySource {
  id: string;
  label: string;
  available: boolean;
  updatedAt: string | null;
  detail: string;
  href: string;
}
export interface VisibilityContext {
  gatheredAt: string;
  businessName: string;
  domain: string;
  sources: VisibilitySource[];
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
export interface VisibilityAction {
  title: string;
  priority: "high" | "medium" | "low";
  evidenceIds: string[];
  steps: string[];
  measureBy: string;
  timeframe: string;
}
export interface VisibilityAssessment {
  inputFingerprint?: string;
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
  actions: VisibilityAction[];
}
export interface VisibilityAnswer {
  id: string;
  provider: string;
  model: string;
  promptText: string;
  rawResponse: string | null;
  errorMessage: string | null;
  createdAt: Date | string;
  analysis?: {
    brandMentioned: boolean;
    recommended: boolean;
    parsedJson?: unknown;
  } | null;
  mentions?: { brandName: string; isCustomer: boolean }[];
  citations?: { url: string; domain: string }[];
}
