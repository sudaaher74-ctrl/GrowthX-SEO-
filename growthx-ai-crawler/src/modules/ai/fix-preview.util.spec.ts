import { candidatePaths } from './fix-preview.util';

describe('candidatePaths', () => {
  it('offers the App Router path for a nested route, most specific first', () => {
    const paths = candidatePaths('https://aiva.example/products/tomato');

    // The monorepo-aware root comes first: a client's site is often one
    // workspace, and `src/app/...` being checked after `app/...` was how the
    // old resolver missed the file and fell back to a guess.
    expect(paths[0]).toBe('src/app/products/tomato/page.tsx');
    expect(paths).toContain('app/products/tomato/page.tsx');
  });

  it('covers the Pages Router and its index form', () => {
    const paths = candidatePaths('https://aiva.example/products/tomato');

    expect(paths).toContain('src/pages/products/tomato.tsx');
    expect(paths).toContain('pages/products/tomato/index.tsx');
  });

  it('covers plain static sites', () => {
    const paths = candidatePaths('https://aiva.example/products/tomato');

    expect(paths).toContain('products/tomato.html');
    expect(paths).toContain('products/tomato/index.html');
  });

  it('uses the root forms for the home page rather than an empty route', () => {
    const paths = candidatePaths('https://aiva.example/');

    expect(paths).toContain('src/app/page.tsx');
    expect(paths).toContain('pages/index.tsx');
    expect(paths).toContain('index.html');
    // An empty route segment would produce "app//page.tsx", which matches
    // nothing and reads as a bug to whoever sees it.
    expect(paths.some((p) => p.includes('//'))).toBe(false);
  });

  it('returns nothing for a URL it cannot parse rather than throwing', () => {
    // The caller renders this list; an exception here would take down the
    // whole modal over a malformed stored URL.
    expect(candidatePaths('not a url')).toEqual([]);
  });

  it('never returns a duplicate path', () => {
    const paths = candidatePaths('https://aiva.example/products/tomato');

    expect(new Set(paths).size).toBe(paths.length);
  });
});
