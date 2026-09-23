import * as fs from 'fs';
import * as path from 'path';
import { ISSUE_COPY, renderCopy } from './issue-copy';

describe('issue-copy', () => {
  const JARGON_BLOCKLIST = [
    'schema',
    'canonical',
    'h1',
    'meta',
    'crawl',
    'index',
    'serp',
    'geo',
    'llm',
    '4xx',
    '5xx',
  ];

  it('covers all issue types emitted by issue-engine.service.ts', () => {
    const engineSourcePath = path.join(__dirname, 'issue-engine.service.ts');
    const source = fs.readFileSync(engineSourcePath, 'utf-8');
    const matches = source.matchAll(/issueType:\s*['"]([A-Z0-9_]+)['"]/g);
    const discoveredTypes = new Set<string>();
    for (const m of matches) {
      discoveredTypes.add(m[1]);
    }

    expect(discoveredTypes.size).toBeGreaterThanOrEqual(25);

    for (const type of discoveredTypes) {
      expect(ISSUE_COPY).toHaveProperty(type);
      expect(ISSUE_COPY[type].title).toBeTruthy();
      expect(ISSUE_COPY[type].cost).toBeTruthy();
      expect(ISSUE_COPY[type].action).toBeTruthy();
      expect(ISSUE_COPY[type].technical).toBeTruthy();
    }
  });

  it('contains no jargon terms in customer-facing fields (title, cost, action)', () => {
    for (const [type, copy] of Object.entries(ISSUE_COPY)) {
      const combined = `${copy.title} ${copy.cost} ${copy.action}`.toLowerCase();
      for (const term of JARGON_BLOCKLIST) {
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        const hasJargon = regex.test(combined);
        if (hasJargon) {
          throw new Error(
            `Issue copy for ${type} contains blocklisted jargon "${term}": "${combined}"`,
          );
        }
        expect(hasJargon).toBe(false);
      }
    }
  });

  describe('renderCopy', () => {
    it('pluralises correctly at n = 1', () => {
      const missingTitle = renderCopy('MISSING_TITLE', { n: 1 });
      expect(missingTitle.title).toBe('1 page has no name in Google search results');
      expect(missingTitle.title).not.toContain('pages have');

      const longTitle = renderCopy('LONG_TITLE', { n: 1 });
      expect(longTitle.title).toBe('1 page title gets cut off halfway in Google');
      expect(longTitle.title).not.toContain('page titles get');

      const brokenLink = renderCopy('BROKEN_LINK_4XX', { n: 1 });
      expect(brokenLink.title).toBe("1 link on your site leads to pages that don't exist");

      const brokenImage = renderCopy('BROKEN_IMAGE', { n: 1 });
      expect(brokenImage.title).toBe("1 image doesn't load");
    });

    it('formats correctly at n > 1', () => {
      const rendered = renderCopy('MISSING_TITLE', { n: 42 });
      expect(rendered.title).toBe('42 pages have no name in Google search results');
    });

    it('handles null/undefined traffic cleanly without placeholder artefacts', () => {
      const renderedNull = renderCopy('MISSING_TITLE', { n: 5, traffic: null });
      expect(renderedNull.cost).not.toContain('null%');
      expect(renderedNull.cost).not.toContain('undefined');
      expect(renderedNull.cost).not.toContain('NaN');
      expect(renderedNull.cost).not.toContain('{traffic}');
      expect(renderedNull.cost).toBe(
        'Google invents a title from whatever text it finds, and it is usually wrong',
      );

      const renderedUndefined = renderCopy('MISSING_H1', { n: 3 });
      expect(renderedUndefined.cost).not.toContain('{traffic}');
      expect(renderedUndefined.cost).not.toContain('null%');
    });

    it('inserts traffic percentage when present', () => {
      const rendered = renderCopy('MISSING_TITLE', { n: 5, traffic: 18.5 });
      expect(rendered.cost).toContain('18.5% of your search traffic');
    });

    it('gracefully handles unknown issue types', () => {
      const rendered = renderCopy('UNKNOWN_PROBLEM', { n: 1 });
      expect(rendered.title).toBe('1 page has an issue (unknown problem)');
      expect(rendered.cost).toBeTruthy();
      expect(rendered.action).toBeTruthy();
    });
  });
});
