/**
 * The contract between the model and the product.
 *
 * The answer is structured rather than prose so the UI can separate verified
 * evidence from inference, and so citation validation is a data check rather
 * than an attempt to parse claims out of paragraphs.
 */

export const CLASSIFY_SCHEMA = {
  name: 'research_classification',
  schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: [
          'MARKET_TREND',
          'COMPETITOR_COMPARISON',
          'CUSTOMER_INSIGHT',
          'AI_VISIBILITY_GAP',
          'CONTENT_OPPORTUNITY',
          'STRATEGIC_RECOMMENDATION',
        ],
      },
      searchQueries: {
        type: 'array',
        description: 'Two to four web search queries that would answer this question.',
        items: { type: 'string' },
      },
      clientDataQuery: {
        type: 'string',
        description: "A short phrase to search the client's own pages with.",
      },
    },
    required: ['intent', 'searchQueries', 'clientDataQuery'],
    additionalProperties: false,
  },
} as const;

export const ANSWER_SCHEMA = {
  name: 'market_research_answer',
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Executive summary, 2-4 sentences.' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      verifiedClaims: {
        type: 'array',
        description: 'Facts supported by the supplied sources. Each MUST cite at least one.',
        items: {
          type: 'object',
          properties: {
            claim: { type: 'string' },
            citationIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['claim', 'citationIds'],
          additionalProperties: false,
        },
      },
      inferences: {
        type: 'array',
        description: 'Reasoning that goes beyond the sources. Labelled as inference, never as fact.',
        items: {
          type: 'object',
          properties: {
            statement: { type: 'string' },
            reasoning: { type: 'string' },
            citationIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['statement', 'reasoning', 'citationIds'],
          additionalProperties: false,
        },
      },
      citationGaps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            gap: { type: 'string' },
            competitorsWinning: { type: 'array', items: { type: 'string' } },
            recommendedResponse: { type: 'string' },
            impact: { type: 'string', enum: ['high', 'medium', 'low'] },
            effort: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['topic', 'gap', 'competitorsWinning', 'recommendedResponse', 'impact', 'effort'],
          additionalProperties: false,
        },
      },
      recommendedActions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'CONTENT_BRIEF',
                'PAGE_REFRESH',
                'TECHNICAL_TASK',
                'TRACK_PROMPT',
                'COMPETITOR_WATCH',
                'OUTREACH_OPPORTUNITY',
              ],
            },
            title: { type: 'string' },
            description: { type: 'string' },
            evidenceCitationIds: { type: 'array', items: { type: 'string' } },
            expectedImpact: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            requiresApproval: { type: 'boolean' },
          },
          required: [
            'type',
            'title',
            'description',
            'evidenceCitationIds',
            'expectedImpact',
            'confidence',
            'requiresApproval',
          ],
          additionalProperties: false,
        },
      },
      evidenceGaps: {
        type: 'array',
        description: 'What could not be established from the available sources.',
        items: { type: 'string' },
      },
    },
    required: [
      'summary',
      'confidence',
      'verifiedClaims',
      'inferences',
      'citationGaps',
      'recommendedActions',
      'evidenceGaps',
    ],
    additionalProperties: false,
  },
} as const;

export const CLASSIFY_INSTRUCTIONS =
  'You route market research questions for an SEO agency. Read the question and ' +
  'return its intent plus the web searches that would answer it. Be concrete: ' +
  'prefer searches naming the industry, product category or competitor over ' +
  'generic phrases. Respond only with JSON matching the schema.';

/**
 * The rules the answer must obey. These are the product's trust guarantees, so
 * they are stated to the model as hard constraints and independently enforced
 * afterwards — the model is asked to comply, and then checked.
 */
export const ANSWER_INSTRUCTIONS = [
  'You are a market analyst for an SEO and growth agency, answering about ONE specific client.',
  '',
  'Rules, in order of importance:',
  '1. Every factual claim in verifiedClaims MUST cite at least one source id from the SOURCES list.',
  '2. You may cite ONLY the source ids listed. Never cite a source that is not there.',
  '3. Never invent URLs, publication dates, market size, traffic, search volume, revenue figures,',
  '   competitor capabilities, pricing or customer sentiment. If you do not have it, say so in evidenceGaps.',
  '4. Anything you conclude beyond what the sources state belongs in inferences, with your reasoning,',
  '   never in verifiedClaims.',
  '5. If the sources conflict, say so explicitly in the summary and lower your confidence.',
  '6. If the sources do not support an answer, return an empty verifiedClaims array, set confidence to',
  '   "low", and explain what is missing in evidenceGaps. Do not fill the gap with general knowledge.',
  '7. Ground citationGaps and recommendedActions in the client context supplied: their own pages,',
  '   competitors, tracked prompts and AI-visibility position.',
  '',
  'Respond only with JSON matching the schema.',
].join('\n');
