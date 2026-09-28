import { HostPacer, MAX_GAP_MS } from './host-pacer';

function pacer() {
  let clock = 1_000_000;
  const slept: number[] = [];
  const p = new HostPacer(
    () => clock,
    async (ms) => {
      slept.push(ms);
    },
  );
  return { p, slept, advance: (ms: number) => (clock += ms) };
}

describe('HostPacer', () => {
  it('lets the first request to a site go straight away', async () => {
    const { p, slept } = pacer();
    await p.wait('example.com', 1000);
    expect(slept).toEqual([]);
  });

  it('spaces requests to one site by the gap, queueing workers that arrive together', async () => {
    const { p, slept } = pacer();
    await Promise.all([p.wait('example.com', 1000), p.wait('example.com', 1000), p.wait('example.com', 1000)]);
    expect(slept).toEqual([1000, 2000]);
  });

  it('does not make one site wait for another', async () => {
    const { p, slept } = pacer();
    await p.wait('a.com', 1000);
    await p.wait('b.com', 1000);
    expect(slept).toEqual([]);
  });

  it('does not wait once the gap has already passed', async () => {
    const { p, slept, advance } = pacer();
    await p.wait('example.com', 1000);
    advance(1500);
    await p.wait('example.com', 1000);
    expect(slept).toEqual([]);
  });

  it('waits only for what is left of the gap', async () => {
    const { p, slept, advance } = pacer();
    await p.wait('example.com', 1000);
    advance(400);
    await p.wait('example.com', 1000);
    expect(slept).toEqual([600]);
  });

  it('does nothing when no gap is asked for', async () => {
    const { p, slept } = pacer();
    await p.wait('example.com', 0);
    await p.wait('example.com', undefined);
    await p.wait('example.com', 0);
    expect(slept).toEqual([]);
  });

  it('caps an extreme crawl-delay so a worker is not held for minutes', async () => {
    const { p, slept } = pacer();
    await p.wait('example.com', 120_000);
    await p.wait('example.com', 120_000);
    expect(slept).toEqual([MAX_GAP_MS]);
  });
});
