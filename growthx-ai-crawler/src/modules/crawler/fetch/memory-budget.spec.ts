import { renderBudget, containerMemory, ContainerMemory } from './memory-budget';
import * as fs from 'fs';

const MB = 1024 * 1024;

describe('renderBudget', () => {
  /**
   * The free instance as it was configured: a 300MB Node heap leaves ~210MB,
   * and Chromium needs more than that. This is the crawl that died.
   */
  it('refuses a 512MB instance still holding the old 300MB heap', () => {
    const memory: ContainerMemory = { limitBytes: 512 * MB, usedBytes: 300 * MB, source: 'cgroup-v2' };

    expect(renderBudget(memory, 250).allowed).toBe(false);
  });

  /**
   * The same instance after cutting the heap to 160MB. Chromium measures
   * ~190MB PSS idle and ~220MB on an ordinary page, so this one fits — which
   * is what makes rendering possible on the free plan without paying.
   */
  it('allows a 512MB instance once the heap is cut to 160MB', () => {
    const memory: ContainerMemory = { limitBytes: 512 * MB, usedBytes: 180 * MB, source: 'cgroup-v2' };

    const verdict = renderBudget(memory, 250);

    expect(verdict.allowed).toBe(true);
    expect(verdict.headroomMb).toBe(332);
  });

  it('explains the refusal in terms an operator can act on', () => {
    const memory: ContainerMemory = { limitBytes: 512 * MB, usedBytes: 300 * MB, source: 'cgroup-v2' };

    const verdict = renderBudget(memory, 250);

    // The figures have to be in the sentence: "rendering is unavailable" with
    // no numbers is what sends someone to the container log.
    expect(verdict.reason).toContain('212MB');
    expect(verdict.reason).toContain('512MB');
    expect(verdict.reason).toContain('250MB');
  });

  it('allows a larger instance with room to spare', () => {
    const memory: ContainerMemory = { limitBytes: 2048 * MB, usedBytes: 400 * MB, source: 'cgroup-v2' };

    expect(renderBudget(memory, 250).allowed).toBe(true);
  });

  it('allows exactly the required headroom', () => {
    const memory: ContainerMemory = { limitBytes: 1000 * MB, usedBytes: 750 * MB, source: 'cgroup-v2' };

    expect(renderBudget(memory, 250).allowed).toBe(true);
  });

  /**
   * One-directional on purpose. A host that reports no limit must not have
   * rendering silently disabled — that would regress every deployment where it
   * works today in order to protect the one where it does not.
   */
  it('allows rendering when the limit cannot be read', () => {
    expect(renderBudget({ source: 'unknown' }, 250).allowed).toBe(true);
  });

  it('allows rendering when usage is unreadable even though the limit is known', () => {
    expect(renderBudget({ limitBytes: 512 * MB, source: 'cgroup-v2' }, 250).allowed).toBe(true);
  });

  it('carries no reason when it allows', () => {
    expect(renderBudget({ limitBytes: 2048 * MB, usedBytes: 100 * MB, source: 'os' }, 250).reason).toBeUndefined();
  });

  /**
   * A workstation has no cgroup limit, so it pages rather than being killed --
   * the failure this guard exists for cannot happen there. It matters because
   * that machine is precisely where the crawler is moved when a 512MB
   * instance cannot cope: os.freemem() on macOS counts only strictly unused
   * pages and excludes the file cache, so a 16GB laptop in normal use reports
   * a few hundred megabytes and would have every render refused.
   */
  it('allows rendering on a host with no container limit', () => {
    const laptop: ContainerMemory = { limitBytes: 16 * 1024 * MB, source: 'os' };

    expect(renderBudget(laptop, 250).allowed).toBe(true);
  });
});

describe('containerMemory', () => {
  afterEach(() => jest.restoreAllMocks());

  /**
   * The page cache is charged to the cgroup and is reclaimed under pressure
   * rather than causing a kill. Counted as used, a container that has merely
   * been up for a while reads as full — a real host here reported 640MB of
   * cache against a 512MB working set — and rendering would be refused
   * forever on a box with ample free memory.
   */
  it('discounts reclaimable page cache from cgroup v2 usage', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(((path: any) => {
      if (String(path) === '/sys/fs/cgroup/memory.max') return String(512 * MB);
      if (String(path) === '/sys/fs/cgroup/memory.current') return String(400 * MB);
      if (String(path) === '/sys/fs/cgroup/memory.stat') return `anon 100\ninactive_file ${250 * MB}\n`;
      throw new Error('ENOENT');
    }) as any);

    const memory = containerMemory();

    expect(memory.source).toBe('cgroup-v2');
    // 400MB charged, 250MB of it reclaimable cache.
    expect(Math.round(memory.usedBytes! / MB)).toBe(150);
    expect(renderBudget(memory, 250).allowed).toBe(true);
  });

  it('reads the cgroup limit rather than the host total', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(((path: any) => {
      if (String(path) === '/sys/fs/cgroup/memory.max') return String(512 * MB);
      if (String(path) === '/sys/fs/cgroup/memory.current') return String(200 * MB);
      if (String(path) === '/sys/fs/cgroup/memory.stat') return 'inactive_file 0\n';
      throw new Error('ENOENT');
    }) as any);

    expect(Math.round(containerMemory().limitBytes! / MB)).toBe(512);
  });

  /** cgroup v1 writes a huge sentinel for "no limit"; it must not be believed. */
  it('treats the cgroup v1 unlimited sentinel as no limit', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(((path: any) => {
      if (String(path) === '/sys/fs/cgroup/memory/memory.limit_in_bytes') return '9223372036854771712';
      throw new Error('ENOENT');
    }) as any);

    expect(containerMemory().source).toBe('os');
  });
});

describe('the unconfigured default', () => {
  const MB2 = 1024 * 1024;
  const OLD = process.env.RENDER_MIN_FREE_MB;
  beforeEach(() => delete process.env.RENDER_MIN_FREE_MB);
  afterEach(() => { if (OLD === undefined) delete process.env.RENDER_MIN_FREE_MB; else process.env.RENDER_MIN_FREE_MB = OLD; });

  /**
   * Production does not sync its Blueprint, so RENDER_MIN_FREE_MB is never
   * set there and the default is the only value that runs. A default above
   * the headroom a 512MB instance actually has would decline every render on
   * the one deployment this guard exists for.
   */
  it('permits a render on a 512MB instance at this app measured baseline', () => {
    const baselineRss = 273 * MB2;

    const verdict = renderBudget({ limitBytes: 512 * MB2, usedBytes: baselineRss, source: 'cgroup-v2' });

    expect(verdict.requiredMb).toBe(220);
    expect(verdict.allowed).toBe(true);
  });

  it('still declines once the app is working and the headroom is gone', () => {
    const verdict = renderBudget({ limitBytes: 512 * MB2, usedBytes: 350 * MB2, source: 'cgroup-v2' });

    expect(verdict.allowed).toBe(false);
  });
});
