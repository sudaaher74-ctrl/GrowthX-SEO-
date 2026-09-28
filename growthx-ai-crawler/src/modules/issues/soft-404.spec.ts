import { detectSoft404, Soft404Input } from './soft-404';

function page(over: Partial<Soft404Input>): Soft404Input {
  return { statusCode: 200, title: 'Fresh cow milk delivered daily | Milquu', h1: ['Fresh cow milk'], wordCount: 640, bodyText: '', ...over };
}

describe('detectSoft404', () => {
  it('flags a 200 page whose title is a not-found message, whatever brand follows it', () => {
    for (const title of ['Page not found | Milquu', '404 - Page Not Found', 'Oops! Page not found – Milquu', 'Not Found', 'Error 404']) {
      expect(detectSoft404(page({ title }))).not.toBeNull();
    }
  });

  it('flags a 200 page whose main heading says the page does not exist', () => {
    const result = detectSoft404(page({ title: 'Milquu', h1: ["Sorry, the page you're looking for doesn't exist."] }));
    expect(result?.signals).toEqual([`Main heading reads "Sorry, the page you're looking for doesn't exist."`]);
  });

  it('flags a near-empty page whose text says it could not be found', () => {
    const result = detectSoft404(
      page({ title: 'Milquu', h1: [], wordCount: 22, bodyText: '  Home  Shop \n We could not find that page. Go back home. ' }),
    );
    expect(result?.signals[0]).toMatch(/^Only 22 words of content, including "we could not find that page"/);
  });

  it('quotes every signal that matched, so the finding can be checked', () => {
    const result = detectSoft404(page({ title: '404 | Milquu', h1: ['Page not found'], wordCount: 12, bodyText: 'Page not found' }));
    expect(result?.signals).toHaveLength(3);
  });

  it('leaves an article about 404 errors alone', () => {
    expect(
      detectSoft404(
        page({
          title: 'How to fix a 404 page not found error on WordPress',
          h1: ['How to fix a 404 page not found error'],
          wordCount: 1800,
          bodyText: 'A page not found error happens when...',
        }),
      ),
    ).toBeNull();
  });

  it('does not read a long page that mentions a missing page as a soft 404', () => {
    expect(detectSoft404(page({ wordCount: 900, bodyText: 'If the page you are looking for does not exist, call us.' }))).toBeNull();
  });

  it('only ever fires on a 200, since a real 404 is already reported as a broken page', () => {
    expect(detectSoft404(page({ statusCode: 404, title: 'Page not found' }))).toBeNull();
    expect(detectSoft404(page({ statusCode: 301, title: 'Page not found' }))).toBeNull();
  });

  it('recognises common non-English not-found templates', () => {
    expect(detectSoft404(page({ title: 'Página no encontrada' }))).not.toBeNull();
    expect(detectSoft404(page({ title: 'पृष्ठ नहीं मिला' }))).not.toBeNull();
  });

  it('copes with a page that has no title, heading or text at all', () => {
    expect(detectSoft404({ statusCode: 200, title: null, h1: null, wordCount: 0, bodyText: null })).toBeNull();
  });
});
