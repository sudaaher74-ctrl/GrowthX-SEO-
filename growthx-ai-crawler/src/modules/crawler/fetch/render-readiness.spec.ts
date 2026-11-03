import { renderedContentReady } from './render-readiness';

describe('render readiness', () => {
  afterEach(() => { delete (globalThis as any).document; });
  it.each(['', 'Loading...', 'Please wait…', 'Loading products', 'Loading your fresh experience...'])('rejects a stable shell: %s', text => {
    (globalThis as any).document = { querySelector: () => ({ textContent: text, getAttribute: () => null, querySelector: () => null }) };
    expect(renderedContentReady()).toBe(false);
  });
  it('accepts a short account form without a word-count minimum', () => {
    (globalThis as any).document = { querySelector: () => ({ textContent: 'Sign in Email Password', getAttribute: () => null, querySelector: () => null }) };
    expect(renderedContentReady()).toBe(true);
  });
  it('waits for an explicitly busy main region', () => {
    (globalThis as any).document = { querySelector: () => ({ textContent: 'Your products', getAttribute: () => 'true' }) };
    expect(renderedContentReady()).toBe(false);
  });
});
