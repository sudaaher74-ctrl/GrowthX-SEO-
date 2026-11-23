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
  searchConsole?: {
    windowDays: number;
    clicks: number;
    impressions: number;
    topQueries: { query: string; clicks: number; impressions: number; ctrPct: number; position: number }[];
    lowCtrQueries: { query: string; clicks: number; impressions: number; ctrPct: number; position: number }[];
  } | null;
  analytics?: {
    windowDays: number;
    sessions: number;
    users: number;
    conversions: number | null;
    topChannels: { channel: string; sessions: number; sharePct: number }[];
  } | null;
  backlinks?: {
    verifiedCount: number;
    referringDomains: number;
    lostCount: number;
  } | null;
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

  if (evidence.searchConsole && (evidence.searchConsole.impressions > 0 || evidence.searchConsole.clicks > 0)) {
    const gsc = evidence.searchConsole;
    const ctrPct = gsc.impressions > 0 ? Number(((gsc.clicks / gsc.impressions) * 100).toFixed(2)) : 0;
    records.push({
      key: 'GSC-SUMMARY',
      source: 'SEARCH_CONSOLE',
      reference: `gsc:${gsc.windowDays}d`,
      observedAt: new Date(),
      summary: `Search Console (${gsc.windowDays}d): ${gsc.clicks} clicks across ${gsc.impressions} impressions (${ctrPct}% CTR).`,
      payload: { clicks: gsc.clicks, impressions: gsc.impressions, ctrPct },
    });

    const highlightQueries = gsc.lowCtrQueries.length > 0 ? gsc.lowCtrQueries : gsc.topQueries;
    highlightQueries.slice(0, 5).forEach((q, i) => {
      records.push({
        key: `GSC-QUERY-${i + 1}`,
        source: 'SEARCH_CONSOLE',
        reference: `gsc-query:${q.query}`,
        observedAt: new Date(),
        summary: `Query "${q.query}": ${q.clicks} clicks, ${q.impressions} impressions (${q.ctrPct}% CTR, avg pos ${q.position.toFixed(1)}).`,
        payload: q,
      });
    });
  }

  if (evidence.analytics && evidence.analytics.sessions > 0) {
    const ga = evidence.analytics;
    const topChan = ga.topChannels[0]
      ? ` Top channel: ${ga.topChannels[0].channel} (${ga.topChannels[0].sharePct}%).`
      : '';
    const convText =
      ga.conversions === null
        ? ' Key event conversions are not configured in GA4.'
        : ` ${ga.conversions} recorded conversions.`;
    records.push({
      key: 'GA4-SUMMARY',
      source: 'ANALYTICS',
      reference: `ga4:${ga.windowDays}d`,
      observedAt: new Date(),
      summary: `Analytics 4 (${ga.windowDays}d): ${ga.sessions} sessions from ${ga.users} users.${topChan}${convText}`,
      payload: {
        sessions: ga.sessions,
        users: ga.users,
        conversions: ga.conversions,
        topChannels: ga.topChannels.slice(0, 4),
      },
    });
  }

  if (evidence.backlinks && (evidence.backlinks.verifiedCount > 0 || evidence.backlinks.lostCount > 0)) {
    const bl = evidence.backlinks;
    records.push({
      key: 'BACKLINKS',
      source: 'CRAWL_PAGE',
      reference: 'backlinks:verified',
      observedAt: new Date(),
      summary: `Backlink authority: ${bl.verifiedCount} verified backlinks across ${bl.referringDomains} referring domains (${bl.lostCount} lost links detected).`,
      payload: bl,
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
  const { business, site, aiVisibility, competitors, searchConsole, analytics, backlinks } = evidence;

  const gscSection =
    searchConsole && (searchConsole.impressions > 0 || searchConsole.clicks > 0)
      ? `# Search Console (${searchConsole.windowDays}d)\n` +
        `Clicks: ${searchConsole.clicks} · Impressions: ${searchConsole.impressions}\n` +
        `Top queries:\n${bullet(
          searchConsole.topQueries.map(
            (q) => `"${q.query}" — ${q.clicks} clicks, ${q.impressions} impr (${q.ctrPct}% CTR, pos ${q.position.toFixed(1)})`,
          ),
        )}\n` +
        (searchConsole.lowCtrQueries.length > 0
          ? `High-impression low-CTR queries (CTR opportunity):\n${bullet(
              searchConsole.lowCtrQueries.map(
                (q) => `"${q.query}" — ${q.impressions} impr, ${q.clicks} clicks (${q.ctrPct}% CTR, pos ${q.position.toFixed(1)})`,
              ),
            )}`
          : '')
      : '# Search Console\nNot connected or no search data synced yet. Treat Google Search clicks/CTR as unmeasured.';

  const ga4Section =
    analytics && analytics.sessions > 0
      ? `# Google Analytics 4 (${analytics.windowDays}d)\n` +
        `Sessions: ${analytics.sessions} · Users: ${analytics.users} · Conversions: ${
          analytics.conversions === null ? 'Not configured (unmeasured)' : analytics.conversions
        }\n` +
        `Channel mix:\n${bullet(
          analytics.topChannels.map((c) => `${c.channel}: ${c.sessions} sessions (${c.sharePct}%)`),
        )}`
      : '# Google Analytics 4\nNot connected or no traffic data synced yet. Treat website sessions and conversions as unmeasured.';

  const backlinksSection =
    backlinks && (backlinks.verifiedCount > 0 || backlinks.lostCount > 0)
      ? `# Backlinks & Authority\nVerified backlinks: ${backlinks.verifiedCount} across ${backlinks.referringDomains} referring domains · Lost backlinks: ${backlinks.lostCount}`
      : '# Backlinks & Authority\nNo verified backlink scan recorded yet. Treat off-page authority as unmeasured.';

  const sections = [
    `# Business\nName: ${business.projectName}\nDomains: ${business.domains.join(', ') || '(none)'}`,

    `# Site audit\nPages crawled: ${site.pagesCrawled}\nLast crawled: ${site.lastCrawledAt ?? 'never'}\n` +
      `Critical issues: ${site.criticalIssues}\nHigh issues: ${site.highIssues}\n` +
      `Most common issues:\n${bullet(site.topIssueTypes.map((i) => `${i.issueType} (${i.count} pages)`))}`,

    `# Actual pages on the site\n${bullet(
      site.samplePages.map((p) => `${p.url} — "${p.title ?? 'untitled'}" (${p.wordCount} words)`),
    )}`,

    gscSection,

    ga4Section,

    backlinksSection,

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
      `A plan for THIS business. Ground the market read in the pages, search console, analytics, and authority signals above. ` +
      `Sequence the SEO roadmap so the highest-impact fixes come first, using the ` +
      `issue counts, high-impression low-CTR queries, and lost backlinks where observed. Build the content plan around the prompts being lost to ` +
      `competitors and real search queries where those exist. Recommend social platforms that fit this ` +
      `audience, not a default list.`,
  ];

  return sections.join('\n\n');
}
