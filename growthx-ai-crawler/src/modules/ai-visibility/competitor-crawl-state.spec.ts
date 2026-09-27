import { CrawlSummary, competitorCrawlState, RETRY_AFTER_MS } from './competitor-crawl-state';

const NOW = new Date('2026-09-27T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

function crawl(over: Partial<CrawlSummary> & { status: string }, endedMinutesAgo = 60): CrawlSummary {
  const at = minutesAgo(endedMinutesAgo);
  return {
    id: over.id ?? `c-${Math.random()}`,
    pagesCrawled: 0,
    healthScore: null,
    errorMessage: null,
    createdAt: at,
    finishedAt: over.status === 'PENDING' || over.status === 'RUNNING' ? null : at,
    updatedAt: at,
    ...over,
  };
}

/**
 * A competitor whose only crawl failed showed "Still reading their website"
 * with no figures for ever: a new crawl was started only for a competitor
 * never crawled at all.
 */
describe('competitorCrawlState', () => {
  it('crawls a competitor that has never been crawled', () => {
    expect(competitorCrawlState([], NOW)).toMatchObject({ good: null, latest: null, retry: true });
  });

  it('retries a competitor whose last attempt failed, once the cooldown has passed', () => {
    const state = competitorCrawlState([crawl({ status: 'FAILED', errorMessage: 'Worker restarted.' }, 45)], NOW);

    expect(state.retry).toBe(true);
    expect(state.failureReason).toBe('Worker restarted.');
  });

  it('waits out the cooldown rather than retrying on every poll', () => {
    const justFailed = crawl({ status: 'FAILED' }, RETRY_AFTER_MS / 60000 - 1);

    expect(competitorCrawlState([justFailed], NOW).retry).toBe(false);
  });

  it('stops retrying after three failures in a day, leaving it to the nightly sweep', () => {
    const failures = [crawl({ status: 'FAILED' }, 40), crawl({ status: 'FAILED' }, 200), crawl({ status: 'CANCELLED' }, 600)];

    expect(competitorCrawlState(failures, NOW).retry).toBe(false);
  });

  it('counts a crawl that completed without reading a page as a failure', () => {
    const state = competitorCrawlState([crawl({ status: 'COMPLETED', pagesCrawled: 0 }, 45)], NOW);

    expect(state).toMatchObject({ good: null, retry: true });
    expect(state.failureReason).toMatch(/without being able to read any page/);
  });

  it('never retries while a crawl is pending or running', () => {
    expect(competitorCrawlState([crawl({ status: 'RUNNING' }, 120)], NOW).retry).toBe(false);
    expect(competitorCrawlState([crawl({ status: 'PENDING' }, 120)], NOW).retry).toBe(false);
  });

  it('keeps the figures of the last good crawl when a recrawl fails', () => {
    const good = crawl({ id: 'good', status: 'COMPLETED', pagesCrawled: 42, healthScore: 71 }, 24 * 60);
    const state = competitorCrawlState([crawl({ id: 'bad', status: 'FAILED' }, 45), good], NOW);

    expect(state.good?.id).toBe('good');
    expect(state.latest?.id).toBe('bad');
    // Already read once: the nightly sweep re-reads it, not the list poll.
    expect(state.retry).toBe(false);
  });

  it('reports no failure while a crawl is going', () => {
    const good = crawl({ status: 'COMPLETED', pagesCrawled: 42 }, 24 * 60);
    const state = competitorCrawlState([crawl({ status: 'RUNNING' }, 5), good], NOW);

    expect(state.failureReason).toBeNull();
    expect(state.good).toBe(good);
  });
});
