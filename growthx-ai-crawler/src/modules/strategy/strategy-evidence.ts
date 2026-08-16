/**
 * Shapes the evidence a strategy is built from, and turns it into a prompt.
 *
 * Separated from the service so the prompt can be asserted in tests without a
 * database — the risk with a strategy feature is that it quietly becomes
 * generic advice, and the defence is proving the customer's own numbers are in
 * the prompt.
 */

import { EvidenceSource, Prisma } from '@prisma/client';

export interface StrategyEvidence {
  business: {
    projectName: string;
    domains: string[];
  };
  site: {
    /** The crawl these figures came from, so evidence can point back at it. */
    crawlJobId: string | null;
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
      description:
        'Sequenced actions. Every entry must cite the evidence key it rests on; ' +
        'an action with no supporting evidence key is discarded, so do not guess one.',
      items: {
        type: 'object',
        properties: {
          horizon: { type: 'string', enum: ['30-day', '60-day', '90-day'] },
          action: { type: 'string' },
          why: { type: 'string' },
          effort: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          impact: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] },
          owner: {
            type: 'string',
            description: 'Role expected to do the work, e.g. Developer, Content, SEO, Client.',
          },
          evidenceKey: {
            type: 'string',
            description: 'The key (e.g. "ISSUE-1") of the listed evidence that motivates this action.',
          },
        },
        required: ['horizon', 'action', 'why', 'effort', 'impact', 'owner', 'evidenceKey'],
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

/** One observation, labelled with the key the model must cite to use it. */
export interface KeyedEvidence {
  key: string;
  source: EvidenceSource;
  reference: string;
  observedAt: Date;
  summary: string;
  payload?: Prisma.InputJsonValue;
}

/**
 * Flattens the gathered evidence into individually citable records.
 *
 * Each gets a short key ("ISSUE-1", "PAGE-3") that appears in the prompt. The
 * model must name one on every recommendation, which is what lets us store a
 * real foreign key to the observation rather than a restatement of it. Anything
 * the customer merely configured — their competitor list, say — is left out:
 * that is context, not something we observed.
 */
export function buildEvidenceRecords(evidence: StrategyEvidence): KeyedEvidence[] {
  const { site, aiVisibility } = evidence;
  const records: KeyedEvidence[] = [];
  const crawledAt = site.lastCrawledAt ? new Date(site.lastCrawledAt) : new Date();

  if (site.crawlJobId) {
    records.push({
      key: 'CRAWL',
      source: 'CRAWL_PAGE',
      reference: `crawlJob:${site.crawlJobId}`,
      observedAt: crawledAt,
      summary: `Crawled ${site.pagesCrawled} pages: ${site.criticalIssues} critical and ${site.highIssues} high-severity issues open.`,
      payload: {
        pagesCrawled: site.pagesCrawled,
        criticalIssues: site.criticalIssues,
        highIssues: site.highIssues,
      },
    });
  }

  site.topIssueTypes.forEach((issue, i) => {
    records.push({
      key: `ISSUE-${i + 1}`,
      source: 'CRAWL_ISSUE',
      reference: `crawlJob:${site.crawlJobId}:issueType:${issue.issueType}`,
      observedAt: crawledAt,
      summary: `${issue.issueType} affects ${issue.count} page(s).`,
      payload: { issueType: issue.issueType, count: issue.count },
    });
  });

  site.samplePages.forEach((page, i) => {
    records.push({
      key: `PAGE-${i + 1}`,
      source: 'CRAWL_PAGE',
      reference: page.url,
      observedAt: crawledAt,
      summary: `${page.url} — "${page.title ?? 'untitled'}" (${page.wordCount} words).`,
      payload: { url: page.url, title: page.title, wordCount: page.wordCount },
    });
  });

  if (aiVisibility.trackedPromptCount > 0) {
    records.push({
      key: 'VISIBILITY',
      source: 'AI_VISIBILITY_CHECK',
      reference: `project-visibility:28d`,
      observedAt: new Date(),
      summary: `Cited in ${aiVisibility.citationSharePct ?? 0}% of AI answers across ${aiVisibility.trackedPromptCount} tracked prompts.`,
      payload: {
        citationSharePct: aiVisibility.citationSharePct,
        averagePosition: aiVisibility.averagePosition,
        byAssistant: aiVisibility.byAssistant,
      },
    });

    aiVisibility.lostPrompts.forEach((lost, i) => {
      records.push({
        key: `LOST-${i + 1}`,
        source: 'AI_VISIBILITY_CHECK',
        reference: `prompt:${lost.prompt}`,
        observedAt: new Date(),
        summary: `Not cited for "${lost.prompt}"; assistants cited ${lost.competitors.join(', ')} instead.`,
        payload: { prompt: lost.prompt, competitors: lost.competitors },
      });
    });
  }

  return records;
}

/** Renders the citable evidence list that the model must reference by key. */
export function renderEvidenceKeys(records: KeyedEvidence[]): string {
  if (!records.length) return '(no evidence available)';
  return records.map((r) => `[${r.key}] ${r.summary}`).join('\n');
}

/** Renders the evidence as the user turn of the strategy request. */
export function buildStrategyPrompt(evidence: StrategyEvidence, records: KeyedEvidence[] = []): string {
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

    `# Citable evidence\n` +
      `Each SEO roadmap entry must set evidenceKey to exactly one key below.\n` +
      `Use only these keys. An entry citing a key that is not listed is discarded,\n` +
      `so if nothing here supports an action, leave the action out.\n\n` +
      renderEvidenceKeys(records),

    `# What to produce\n` +
      `A plan for THIS business. Ground the market read in the pages listed above. ` +
      `Sequence the SEO roadmap so the highest-impact fixes come first, using the ` +
      `issue counts. Build the content plan around the prompts being lost to ` +
      `competitors where those exist. Recommend social platforms that fit this ` +
      `audience, not a default list.`,
  ];

  return sections.join('\n\n');
}
