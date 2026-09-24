import { CandidatePage, bestPage, pageSignals } from './page-signals';
import { brandTerms, questionGroup } from './question-group';
import { pageTopic, suggestQuestions } from './question-suggestions';
import { questionTerms } from './question-terms';
import { compareSignals, QuestionAnalysis } from './question-analysis.service';
import { roadmapTasks } from './roadmap-tasks';

function page(overrides: Partial<CandidatePage> = {}): CandidatePage {
  return {
    id: 'p1',
    url: 'https://aivaenterprises.com/organic-turmeric',
    title: 'Organic Turmeric Powder | Aiva Enterprises',
    metaDescription: null,
    h1: ['Organic Turmeric Powder'],
    h2: [],
    h3: [],
    pageType: 'PRODUCT',
    wordCount: 600,
    ...overrides,
  };
}

const BRAND = brandTerms('Aiva', ['aivaenterprises.com']);

describe('question groups', () => {
  it('puts a question naming the brand in Reputation, whatever spelling it uses', () => {
    expect(questionGroup('is Aiva legitimate and reliable', BRAND)).toBe('REPUTATION');
    expect(questionGroup('reviews of aivaenterprises.com', BRAND)).toBe('REPUTATION');
    expect(questionGroup('top alternatives to AIVA', BRAND)).toBe('REPUTATION');
  });

  it('keeps a buyer question in Buyer, and does not match the brand inside another word', () => {
    expect(questionGroup('best organic turmeric exporter in india', BRAND)).toBe('BUYER');
    expect(questionGroup('best saliva test kits', BRAND)).toBe('BUYER');
  });
});

describe('question terms', () => {
  it('keeps the words that carry meaning, and folds plurals', () => {
    expect(questionTerms('What are the best organic spices exporters in India?')).toEqual([
      'organic',
      'spice',
      'exporter',
      'india',
    ]);
  });
});

describe('page matching', () => {
  const pages = [
    page(),
    page({ id: 'p2', url: 'https://aivaenterprises.com/about', title: 'About us', h1: ['About Aiva'], pageType: 'ABOUT' }),
  ];

  it('finds the page whose title and headings cover the question', () => {
    expect(bestPage('best organic turmeric powder', pages)?.page.id).toBe('p1');
  });

  it('reports no page — a content gap — when nothing covers at least half the terms', () => {
    expect(bestPage('best basmati rice exporter', pages)).toBeNull();
  });
});

describe('page signals', () => {
  const html = `<html><body>
    <nav>Menu turmeric</nav>
    <h1>Organic Turmeric Powder</h1>
    <p>Aiva ships certified organic turmeric powder from Kerala farms to buyers in 20 countries, with lab reports on every lot and export paperwork handled for you.</p>
    <h2>Is your turmeric certified organic?</h2><h2>What is the minimum order?</h2>
  </body></html>`;

  it('reads a direct answer, FAQ headings and term coverage from the stored HTML', () => {
    const signals = pageSignals('best organic turmeric powder exporter', page({ h2: ['Is your turmeric certified organic?', 'What is the minimum order?'] }), html, ['ORGANIZATION']);
    expect(signals.directAnswer).toBe(true);
    expect(signals.faq).toBe(true);
    expect(signals.faqSource).toBe('HEADINGS');
    expect(signals.schemaTypes).toEqual(['ORGANIZATION']);
    expect(signals.missingTerms).toEqual(['exporter']);
    expect(signals.htmlAvailable).toBe(true);
  });

  it('counts FAQPage markup as an FAQ, and says so when no HTML was stored', () => {
    const signals = pageSignals('organic turmeric', page(), null, ['FAQ']);
    expect(signals.faqSource).toBe('SCHEMA');
    expect(signals.directAnswer).toBe(false);
    expect(signals.htmlAvailable).toBe(false);
  });
});

describe('question suggestions', () => {
  it("takes the topic from a page's heading, without the brand or section names", () => {
    expect(pageTopic(page(), BRAND)).toBe('organic turmeric powder');
    expect(pageTopic(page({ h1: ['Contact Us'], title: 'Contact Us' }), BRAND)).toBeNull();
  });

  it("suggests rival topics you have no page for, your own topics, and never a brand question", () => {
    const suggestions = suggestQuestions({
      ownPages: [page()],
      rivalPages: [
        { ...page({ id: 'r1', url: 'https://rival.com/basmati', title: 'Premium Basmati Rice', h1: ['Premium Basmati Rice'] }), competitorDomain: 'rival.com' },
        // Covered by the customer's own page: not a gap, not suggested as one.
        { ...page({ id: 'r2', url: 'https://rival.com/turmeric', title: 'Organic Turmeric Powder', h1: ['Organic Turmeric Powder'] }), competitorDomain: 'rival.com' },
      ],
      contentGaps: [],
      brand: BRAND,
      city: 'Pune',
      alreadyTracked: [],
    });

    expect(suggestions.map((s) => [s.text, s.source])).toEqual([
      ['best premium basmati rice in Pune', 'RIVAL_PAGE'],
      ['best organic turmeric powder in Pune', 'OWN_PAGE'],
    ]);
    expect(suggestions[0].evidenceUrl).toBe('https://rival.com/basmati');
  });

  it('does not suggest what is already tracked', () => {
    const suggestions = suggestQuestions({
      ownPages: [page()],
      rivalPages: [],
      contentGaps: [],
      brand: BRAND,
      city: null,
      alreadyTracked: ['best organic turmeric powder'],
    });
    expect(suggestions).toEqual([]);
  });
});

describe('roadmap tasks', () => {
  const ownSignals = pageSignals('best organic turmeric', page(), null, []);
  const rivalSignals = { ...ownSignals, faq: true, faqSource: 'SCHEMA' as const, schemaTypes: ['FAQ'] };

  function analysis(overrides: Partial<QuestionAnalysis>): QuestionAnalysis {
    return {
      id: 'q1',
      text: 'best organic turmeric',
      cluster: null,
      group: 'BUYER',
      outcome: 'NOT_CITED',
      answer: {
        assistant: 'SARVAM' as any,
        model: 'sarvam-105b',
        checkedAt: new Date('2026-09-20T06:00:00Z'),
        cited: false,
        position: null,
        competitorsCited: ['rival.com'],
        answerExcerpt: 'Rival Foods is a good choice.',
      },
      failure: null,
      verdict: 'PAGE_FOUND',
      ownPage: { url: 'https://aivaenterprises.com/organic-turmeric', title: 'x', matchScore: 1, signals: ownSignals, issues: [] },
      rivals: [],
      comparison: [],
      ...overrides,
    };
  }

  it('turns an uncited buyer question into a task on the page that should answer it, with the evidence', () => {
    const rivals = [{ domain: 'rival.com', label: 'Rival', crawled: true, page: { url: 'https://rival.com/t', title: 't', matchScore: 1, signals: rivalSignals } }];
    const [task] = roadmapTasks([analysis({ rivals, comparison: compareSignals(ownSignals, rivals) })]);

    expect(task).toMatchObject({
      groupKey: 'aivis::q1',
      category: 'AI_VISIBILITY',
      severity: 'HIGH',
      sampleUrls: ['https://aivaenterprises.com/organic-turmeric'],
    });
    expect(task.summary).toContain('named rival.com, not you');
    expect(task.summary).toContain('faq');
    expect(task.action).toContain('FAQ');
  });

  it('asks for a new page when none exists', () => {
    const [task] = roadmapTasks([analysis({ ownPage: null, verdict: 'CONTENT_GAP' })]);
    expect(task.title).toBe('Create a page that answers "best organic turmeric"');
    expect(task.affectedCount).toBe(0);
  });

  it('makes no task from a cited answer, an unmeasured question, or a reputation question', () => {
    expect(roadmapTasks([analysis({ outcome: 'CITED' })])).toEqual([]);
    expect(roadmapTasks([analysis({ outcome: 'NOT_MEASURED', answer: null })])).toEqual([]);
    expect(roadmapTasks([analysis({ group: 'REPUTATION' })])).toEqual([]);
  });
});
