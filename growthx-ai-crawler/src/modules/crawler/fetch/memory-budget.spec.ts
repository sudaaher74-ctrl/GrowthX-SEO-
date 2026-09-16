import { renderBudget, ContainerMemory } from './memory-budget';

const MB = 1024 * 1024;

describe('renderBudget', () => {
  /**
   * The case this exists for: Render's free instance, with the Node heap the
   * Dockerfile asks for already resident. Chromium measured 350-600MB beside
   * it, so there is no arrangement of these numbers that fits.
   */
  it('refuses a 512MB instance already holding a 300MB heap', () => {
    const memory: ContainerMemory = { limitBytes: 512 * MB, usedBytes: 300 * MB, source: 'cgroup-v2' };

    const verdict = renderBudget(memory, 400);

    expect(verdict.allowed).toBe(false);
    expect(verdict.headroomMb).toBe(212);
  });

  it('explains the refusal in terms an operator can act on', () => {
    const memory: ContainerMemory = { limitBytes: 512 * MB, usedBytes: 300 * MB, source: 'cgroup-v2' };

    const verdict = renderBudget(memory, 400);

    // The figures have to be in the sentence: "rendering is unavailable" with
    // no numbers is what sends someone to the container log.
    expect(verdict.reason).toContain('212MB');
    expect(verdict.reason).toContain('512MB');
    expect(verdict.reason).toContain('400MB');
  });

  it('allows a paid instance with room to spare', () => {
    const memory: ContainerMemory = { limitBytes: 2048 * MB, usedBytes: 400 * MB, source: 'cgroup-v2' };

    expect(renderBudget(memory, 400).allowed).toBe(true);
  });

  it('allows exactly the required headroom', () => {
    const memory: ContainerMemory = { limitBytes: 1000 * MB, usedBytes: 600 * MB, source: 'cgroup-v2' };

    expect(renderBudget(memory, 400).allowed).toBe(true);
  });

  /**
   * One-directional on purpose. A host that reports no limit must not have
   * rendering silently disabled — that would regress every deployment where it
   * works today in order to protect the one where it does not.
   */
  it('allows rendering when the limit cannot be read', () => {
    expect(renderBudget({ source: 'unknown' }, 400).allowed).toBe(true);
  });

  it('allows rendering when usage is unreadable even though the limit is known', () => {
    expect(renderBudget({ limitBytes: 512 * MB, source: 'cgroup-v2' }, 400).allowed).toBe(true);
  });

  it('carries no reason when it allows', () => {
    expect(renderBudget({ limitBytes: 2048 * MB, usedBytes: 100 * MB, source: 'os' }, 400).reason).toBeUndefined();
  });
});
