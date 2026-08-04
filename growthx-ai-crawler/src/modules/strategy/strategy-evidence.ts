/**
 * Shapes the evidence a strategy is built from, and turns it into a prompt.
 *
 * Separated from the service so the prompt can be asserted in tests without a
 * database — the risk with a strategy feature is that it quietly becomes
 * generic advice, and the defence is proving the customer's own numbers are in
 * the prompt.
 */

export interface StrategyEvidence {
  business: {
    projectName: string;
    domains: string[];
  };
  site: {
    pagesCrawled: number;
    lastCrawledAt: string | null;
    criticalIssues: number;
    highIssues: number;
    /** Most frequent issue types, worst first. */
    topIssueTypes: { issueType: string; count: number }[];
    /** A sample of real page titles, so advice can reference actual content. */
    samplePages: { url: string; title: string | null; wordCount: number }[];
  };
  aiVisibility: {
    citationSharePct: number | null;
    averagePosition: number | null;
    byAssistant: { assistant: string; citationSharePct: number }[];
    /** Prompts where a competitor is cited and the customer is not. */
    lostPrompts: { prompt: string; competitors: string[] }[];
    trackedPromptCount: number;
  };
  competitors: { domain: string; label: string | null }[];
}

/** The plan we ask the model to produce. */
export const STRATEGY_SCHEMA = {
  type: 'object',
  properties: {
    businessSummary: {
      type: 'string',
      description: 'Two or three sentences on what this business sells and to whom, inferred from the site.',
    },
    marketAnalysis: {
      type: 'object',
      properties: {
        positioning: { type: 'string' },
        targetAudience: { type: 'string' },
        demandSignals: { type: 'array', items: { type: 'string' } },
        competitiveThreats: { type: 'array', items: { type: 'string' } },
      },
      required: ['positioning', 'targetAudience', 'demandSignals', 'competitiveThreats'],
      additionalProperties: false,
    },
    seoRoadmap: {
      type: 'array',
      description: 'Sequenced actions. horizon is one of "30-day", "60-day", "90-day".',
      items: {
        type: 'object',
        properties: {
          horizon: { type: 'string' },
          action: { type: 'string' },
          why: { type: 'string' },
          effort: { type: 'string' },
          expectedImpact: { type: 'string' },
        },
        required: ['horizon', 'action', 'why', 'effort', 'expectedImpact'],
        additionalProperties: false,
      },
    },
    contentPlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          format: { type: 'string' },
          targetQuery: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['title', 'format', 'targetQuery', 'why'],
        additionalProperties: false,
      },
    },
    socialStrategy: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          platform: { type: 'string' },
          cadence: { type: 'string' },
          contentThemes: { type: 'array', items: { type: 'string' } },
          why: { type: 'string' },
        },
        required: ['platform', 'cadence', 'contentThemes', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['businessSummary', 'marketAnalysis', 'seoRoadmap', 'contentPlan', 'socialStrategy'],
  additionalProperties: false,
} as const;

export const STRATEGY_SYSTEM_PROMPT =
  'You are a growth strategist producing a plan for one specific business. ' +
  'Every recommendation must trace back to the evidence provided — cite the ' +
  'number or the page that motivates it. Do not produce generic SEO advice that ' +
  'would apply to any website; if the evidence is too thin to support a ' +
  'recommendation, say so instead of inventing one. Respond only with JSON ' +
  'matching the schema.';

function bullet(lines: string[]): string {
  return lines.length ? lines.map((l) => `- ${l}`).join('\n') : '- (none recorded)';
}

/** Renders the evidence as the user turn of the strategy request. */
export function buildStrategyPrompt(evidence: StrategyEvidence): string {
  const { business, site, aiVisibility, competitors } = evidence;

  const sections = [
    `# Business\nName: ${business.projectName}\nDomains: ${business.domains.join(', ') || '(none)'}`,

    `# Site audit\nPages crawled: ${site.pagesCrawled}\nLast crawled: ${site.lastCrawledAt ?? 'never'}\n` +
      `Critical issues: ${site.criticalIssues}\nHigh issues: ${site.highIssues}\n` +
      `Most common issues:\n${bullet(site.topIssueTypes.map((i) => `${i.issueType} (${i.count} pages)`))}`,

    `# Actual pages on the site\n${bullet(
      site.samplePages.map((p) => `${p.url} — "${p.title ?? 'untitled'}" (${p.wordCount} words)`),
    )}`,

    `# AI assistant visibility\n` +
      (aiVisibility.trackedPromptCount === 0
        ? 'No prompts are being tracked yet, so citation share is unknown. ' +
          'Treat AI visibility as unmeasured rather than assuming it is poor.'
        : `Tracked prompts: ${aiVisibility.trackedPromptCount}\n` +
          `Blended citation share: ${aiVisibility.citationSharePct ?? 'unknown'}%\n` +
          `Average position when cited: ${aiVisibility.averagePosition ?? 'n/a'}\n` +
          `Per assistant:\n${bullet(
            aiVisibility.byAssistant.map((a) => `${a.assistant}: ${a.citationSharePct}%`),
          )}\n` +
          `Prompts where competitors are cited and this business is not:\n${bullet(
            aiVisibility.lostPrompts.map((p) => `"${p.prompt}" — cited instead: ${p.competitors.join(', ')}`),
          )}`),

    `# Tracked competitors\n${bullet(competitors.map((c) => c.label ?? c.domain))}`,

    `# What to produce\n` +
      `A plan for THIS business. Ground the market read in the pages listed above. ` +
      `Sequence the SEO roadmap so the highest-impact fixes come first, using the ` +
      `issue counts. Build the content plan around the prompts being lost to ` +
      `competitors where those exist. Recommend social platforms that fit this ` +
      `audience, not a default list.`,
  ];

  return sections.join('\n\n');
}
