/**
 * Mammouth AI Model Capability & Routing Configuration
 *
 * Configurable model selection layer for GrowthX SEO tasks.
 * Avoids hardcoding a single model and ensures tasks are routed
 * to models that actually support their required capabilities.
 */

export enum MammouthCapability {
  SEO_ANALYSIS = 'SEO_ANALYSIS',
  KEYWORD_ANALYSIS = 'KEYWORD_ANALYSIS',
  COMPETITOR_ANALYSIS = 'COMPETITOR_ANALYSIS',
  CONTENT_ANALYSIS = 'CONTENT_ANALYSIS',
  TECHNICAL_SEO_REASONING = 'TECHNICAL_SEO_REASONING',
  AEV_ANALYSIS = 'AEV_ANALYSIS',
  LONG_FORM_REASONING = 'LONG_FORM_REASONING',
  STRUCTURED_JSON = 'STRUCTURED_JSON',
}

export interface MammouthModelMetadata {
  id: string;
  displayName: string;
  capabilities: readonly MammouthCapability[];
  supportsJsonSchema: boolean;
  maxOutputTokens: number;
  description: string;
}

/**
 * Registry of available Mammouth models with verified capabilities.
 */
export const MAMMOUTH_MODELS: Readonly<Record<string, MammouthModelMetadata>> = {
  'mammouth-recommended': {
    id: 'mammouth-recommended',
    displayName: 'Mammouth Recommended (Auto-Optimized)',
    capabilities: [
      MammouthCapability.SEO_ANALYSIS,
      MammouthCapability.CONTENT_ANALYSIS,
      MammouthCapability.STRUCTURED_JSON,
      MammouthCapability.KEYWORD_ANALYSIS,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 8192,
    description: 'Default high-performance general SEO reasoning model with low latency.',
  },
  'gpt-4.1': {
    id: 'gpt-4.1',
    displayName: 'GPT-4.1',
    capabilities: [
      MammouthCapability.SEO_ANALYSIS,
      MammouthCapability.TECHNICAL_SEO_REASONING,
      MammouthCapability.STRUCTURED_JSON,
      MammouthCapability.AEV_ANALYSIS,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 8192,
    description: 'Robust technical SEO reasoning and strict JSON schema compliance.',
  },
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini',
    capabilities: [
      MammouthCapability.KEYWORD_ANALYSIS,
      MammouthCapability.CONTENT_ANALYSIS,
      MammouthCapability.STRUCTURED_JSON,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 4096,
    description: 'Lightweight, cost-efficient model for fast keyword categorization and meta tag generation.',
  },
  'gpt-5.4': {
    id: 'gpt-5.4',
    displayName: 'GPT-5.4',
    capabilities: [
      MammouthCapability.SEO_ANALYSIS,
      MammouthCapability.TECHNICAL_SEO_REASONING,
      MammouthCapability.LONG_FORM_REASONING,
      MammouthCapability.STRUCTURED_JSON,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 16384,
    description: 'Flagship deep reasoning model for complex architectural audits and code-level fixes.',
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    capabilities: [
      MammouthCapability.COMPETITOR_ANALYSIS,
      MammouthCapability.CONTENT_ANALYSIS,
      MammouthCapability.LONG_FORM_REASONING,
      MammouthCapability.AEV_ANALYSIS,
      MammouthCapability.STRUCTURED_JSON,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 8192,
    description: 'Superior nuanced competitor gap analysis, editorial roadmaps, and AEV brand comparison.',
  },
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    capabilities: [
      MammouthCapability.KEYWORD_ANALYSIS,
      MammouthCapability.CONTENT_ANALYSIS,
      MammouthCapability.STRUCTURED_JSON,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 4096,
    description: 'Fast summarization and high-throughput content extraction.',
  },
  'claude-opus-4-8': {
    id: 'claude-opus-4-8',
    displayName: 'Claude Opus 4.8',
    capabilities: [
      MammouthCapability.LONG_FORM_REASONING,
      MammouthCapability.COMPETITOR_ANALYSIS,
      MammouthCapability.TECHNICAL_SEO_REASONING,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 16384,
    description: 'Maximum depth reasoning for enterprise competitive teardowns and technical audits.',
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    capabilities: [
      MammouthCapability.KEYWORD_ANALYSIS,
      MammouthCapability.CONTENT_ANALYSIS,
      MammouthCapability.STRUCTURED_JSON,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 8192,
    description: 'High-speed multi-lingual keyword clustering and search intent tagging.',
  },
  'gemini-3.7-flash': {
    id: 'gemini-3.7-flash',
    displayName: 'Gemini 3.7 Flash',
    capabilities: [
      MammouthCapability.KEYWORD_ANALYSIS,
      MammouthCapability.SEO_ANALYSIS,
      MammouthCapability.AEV_ANALYSIS,
      MammouthCapability.STRUCTURED_JSON,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 8192,
    description: 'Fast multimodal and reasoning hybrid for search intelligence.',
  },
  'deepseek-v4-flash': {
    id: 'deepseek-v4-flash',
    displayName: 'DeepSeek V4 Flash',
    capabilities: [
      MammouthCapability.KEYWORD_ANALYSIS,
      MammouthCapability.CONTENT_ANALYSIS,
      MammouthCapability.STRUCTURED_JSON,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 8192,
    description: 'Ultra cost-effective model for bulk keyword processing and content entity mapping.',
  },
  'deepseek-r1-0528': {
    id: 'deepseek-r1-0528',
    displayName: 'DeepSeek R1',
    capabilities: [
      MammouthCapability.LONG_FORM_REASONING,
      MammouthCapability.TECHNICAL_SEO_REASONING,
      MammouthCapability.COMPETITOR_ANALYSIS,
    ],
    supportsJsonSchema: false,
    maxOutputTokens: 16384,
    description: 'Chain-of-thought mathematical and algorithmic ranking reasoning.',
  },
  'sonar-pro': {
    id: 'sonar-pro',
    displayName: 'Sonar Pro (Search Engine Intelligence)',
    capabilities: [
      MammouthCapability.AEV_ANALYSIS,
      MammouthCapability.COMPETITOR_ANALYSIS,
      MammouthCapability.SEO_ANALYSIS,
    ],
    supportsJsonSchema: true,
    maxOutputTokens: 8192,
    description: 'Search-grounded model optimal for AEV (AI Engine Visibility) & citation discovery.',
  },
};

/**
 * Default model assignment per capability.
 * Overridable via environment variables (e.g. MAMMOUTH_MODEL_SEO_ANALYSIS="gpt-4.1").
 */
/** Sentinel meaning "let the capability table choose", not a pinned model. */
export const AUTO_SELECT_MODEL = 'mammouth-recommended';

export const DEFAULT_CAPABILITY_MODELS: Readonly<Record<MammouthCapability, string>> = {
  [MammouthCapability.SEO_ANALYSIS]: 'mammouth-recommended',
  [MammouthCapability.KEYWORD_ANALYSIS]: 'gemini-2.5-flash',
  [MammouthCapability.COMPETITOR_ANALYSIS]: 'claude-sonnet-4-6',
  [MammouthCapability.CONTENT_ANALYSIS]: 'claude-sonnet-4-6',
  [MammouthCapability.TECHNICAL_SEO_REASONING]: 'gpt-5.4',
  [MammouthCapability.AEV_ANALYSIS]: 'sonar-pro',
  [MammouthCapability.LONG_FORM_REASONING]: 'deepseek-r1-0528',
  [MammouthCapability.STRUCTURED_JSON]: 'gpt-4.1',
};

/**
 * Resolves the optimal Mammouth model for a given SEO capability.
 */
export function resolveMammouthModelForCapability(
  capability: MammouthCapability,
  customConfig?: {
    envOverrides?: Record<string, string | undefined>;
    userSelectedModel?: string;
  },
): string {
  // 1. If the user explicitly pinned a model that supports this capability, honour it.
  //    'mammouth-recommended' is the auto-select sentinel, not a pin — the UI
  //    labels it "Auto-Optimized / intelligently selected based on task
  //    capability". Treating it as a pin silently shadowed the per-capability
  //    defaults below, sending keyword work to the generic model instead of
  //    gemini-2.5-flash and content work instead of claude-sonnet-4-6.
  if (customConfig?.userSelectedModel && customConfig.userSelectedModel !== AUTO_SELECT_MODEL) {
    const meta = MAMMOUTH_MODELS[customConfig.userSelectedModel];
    if (meta && meta.capabilities.includes(capability)) {
      return customConfig.userSelectedModel;
    }
  }

  // 2. Check env override (e.g. MAMMOUTH_MODEL_COMPETITOR_ANALYSIS)
  const envKey = `MAMMOUTH_MODEL_${capability}`;
  const envOverride = customConfig?.envOverrides?.[envKey];
  if (envOverride && MAMMOUTH_MODELS[envOverride]) {
    return envOverride;
  }

  // 3. Fallback to default capability model
  return DEFAULT_CAPABILITY_MODELS[capability] ?? 'mammouth-recommended';
}
