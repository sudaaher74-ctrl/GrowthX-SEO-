import { crawlFailed, crawlToShow, crawlUsable, FULL_CRAWL, USABLE_CRAWL } from './crawl-selection';

const c = (id: string, status: string, pagesCrawled = 0) => ({ id, status, pagesCrawled });

/**
 * A failed re-audit used to replace a good audit on every screen, because
 * each read "the latest crawl" whatever had happened to it.
 */
describe('crawlToShow', () => {
  it('shows the last good crawl when the newest attempt failed, and says so', () => {
    const { shown, failedAttempt } = crawlToShow([c('new', 'FAILED'), c('good', 'COMPLETED', 34)]);

    expect(shown?.id).toBe('good');
    expect(failedAttempt?.id).toBe('new');
  });

  it('treats a crawl that completed with no pages as a failed attempt', () => {
    expect(crawlToShow([c('empty', 'COMPLETED', 0), c('good', 'COMPLETED', 34)]).shown?.id).toBe('good');
  });

  it('still shows a crawl in progress, so screens can poll its progress', () => {
    const { shown, failedAttempt, lastUsable } = crawlToShow([c('running', 'RUNNING', 3), c('good', 'COMPLETED', 34)]);

    expect(shown?.id).toBe('running');
    expect(failedAttempt).toBeNull();
    expect(lastUsable?.id).toBe('good');
  });

  it('shows the failed crawl when nothing was ever read, so the failure is visible', () => {
    expect(crawlToShow([c('only', 'FAILED')])).toMatchObject({ shown: { id: 'only' }, failedAttempt: null, lastUsable: null });
  });

  it('shows the newest crawl when it succeeded', () => {
    expect(crawlToShow([c('new', 'COMPLETED', 40), c('old', 'COMPLETED', 34)]).shown?.id).toBe('new');
  });

  it('handles a site never crawled', () => {
    expect(crawlToShow([])).toEqual({ shown: null, failedAttempt: null, lastUsable: null });
  });
});

describe('crawl predicates', () => {
  it('agree on what failed and what is usable', () => {
    expect(crawlFailed(c('a', 'CANCELLED'))).toBe(true);
    expect(crawlFailed(c('a', 'RUNNING'))).toBe(false);
    expect(crawlUsable(c('a', 'COMPLETED', 1))).toBe(true);
    expect(crawlUsable(c('a', 'RUNNING', 10))).toBe(false);
  });

  it('require a finished crawl with pages, and a full one for comparisons', () => {
    expect(USABLE_CRAWL).toEqual({ status: 'COMPLETED', pagesCrawled: { gt: 0 } });
    // "Stopped early" is what the stall sweep writes on a crawl it closed part-way.
    expect(JSON.stringify(FULL_CRAWL)).toContain('Stopped early');
  });
});
