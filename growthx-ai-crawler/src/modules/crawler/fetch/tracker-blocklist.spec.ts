import { isThirdPartyTrackerUrl } from './tracker-blocklist';

describe('tracker-blocklist (Optimization #3)', () => {
  it.each([
    'https://www.googletagmanager.com/gtm.js?id=GTM-123',
    'https://www.google-analytics.com/g/collect',
    'https://connect.facebook.net/en_US/fbevents.js',
    'https://static.hotjar.com/c/hotjar-123.js',
    'https://www.clarity.ms/tag/abc',
    'https://widget.intercom.io/widget/xyz',
    'https://js.hs-scripts.com/12345.js',
    'https://embed.tawk.to/abc/default',
    'https://cdn.segment.com/analytics.js/v1/key/analytics.min.js',
  ])('blocks third-party tracker %s when crawling an ordinary site', (url) => {
    expect(isThirdPartyTrackerUrl(url, 'shop.example.com')).toBe(true);
  });

  it.each([
    'https://shop.example.com/assets/app.js',
    'https://cdn.example.com/bundle.js',
    'https://cdn.jsdelivr.net/npm/react@19/umd/react.production.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
    'https://unpkg.com/vue@3/dist/vue.global.js',
    'https://d12345.cloudfront.net/static/main.js',
  ])('preserves first-party and standard application CDN scripts: %s', (url) => {
    expect(isThirdPartyTrackerUrl(url, 'shop.example.com')).toBe(false);
  });

  it('never blocks first-party resources even when the crawled site itself is a listed domain', () => {
    expect(isThirdPartyTrackerUrl('https://www.hotjar.com/app.js', 'www.hotjar.com')).toBe(false);
  });
});
