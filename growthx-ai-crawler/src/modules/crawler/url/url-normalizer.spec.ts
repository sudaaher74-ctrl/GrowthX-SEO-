import { inferTrailingSlashPolicy, normalizeUrl } from './url-normalizer';
import { registrableDomain, sameRegistrableDomain } from './registrable-domain';

describe('normalizeUrl', () => {
  it('lowercases the host but leaves the path alone', () => {
    // Plenty of servers serve /About and /about as different resources.
    expect(normalizeUrl('https://WWW.Example.COM/About')).toBe('https://www.example.com/About');
  });

  it('strips the fragment, default port, and credentials', () => {
    expect(normalizeUrl('https://user:pw@example.com:443/a#section')).toBe('https://example.com/a');
    expect(normalizeUrl('http://example.com:80/a')).toBe('http://example.com/a');
  });

  it('drops tracking parameters and keeps content-bearing ones', () => {
    expect(normalizeUrl('https://example.com/p?utm_source=nl&gclid=x&fbclid=y&id=42')).toBe('https://example.com/p?id=42');
  });

  it('sorts remaining parameters so argument order is not a second page', () => {
    expect(normalizeUrl('https://example.com/p?b=2&a=1')).toBe(normalizeUrl('https://example.com/p?a=1&b=2'));
  });

  it('resolves relative and dot segments against a base', () => {
    expect(normalizeUrl('../contact', { base: 'https://example.com/a/b/c' })).toBe('https://example.com/a/contact');
    expect(normalizeUrl('//cdn.example.com/x')).toBe('https://cdn.example.com/x');
  });

  it('returns nothing for a scheme that is not a page', () => {
    expect(normalizeUrl('mailto:hi@example.com')).toBe('');
    expect(normalizeUrl('tel:+919699414848')).toBe('');
    expect(normalizeUrl('javascript:void(0)')).toBe('');
    expect(normalizeUrl('#')).toBe('');
  });

  it('applies the trailing-slash policy it was given', () => {
    expect(normalizeUrl('https://example.com/about/', { trailingSlash: 'strip' })).toBe('https://example.com/about');
    expect(normalizeUrl('https://example.com/about', { trailingSlash: 'add' })).toBe('https://example.com/about/');
    expect(normalizeUrl('https://example.com/about/', { trailingSlash: 'preserve' })).toBe('https://example.com/about/');
    // A path that looks like a file never gains a slash.
    expect(normalizeUrl('https://example.com/feed.xml', { trailingSlash: 'add' })).toBe('https://example.com/feed.xml');
  });

  it('leaves the root path as a single slash under every policy', () => {
    expect(normalizeUrl('https://example.com/', { trailingSlash: 'strip' })).toBe('https://example.com/');
  });
});

describe('inferTrailingSlashPolicy', () => {
  it('learns the policy from a redirect that only changes the slash', () => {
    expect(
      inferTrailingSlashPolicy([{ url: 'https://example.com/about/', status: 301, location: '/about' }]),
    ).toBe('strip');
    expect(
      inferTrailingSlashPolicy([{ url: 'https://example.com/about', status: 301, location: '/about/' }]),
    ).toBe('add');
  });

  it('ignores a redirect that also changes host or query, which teaches nothing about slashes', () => {
    expect(
      inferTrailingSlashPolicy([{ url: 'https://example.com/about/', status: 301, location: 'https://www.example.com/about' }]),
    ).toBeUndefined();
  });
});

describe('registrableDomain', () => {
  it('folds a www host onto its apex', () => {
    expect(registrableDomain('https://www.dronaarchery.com/')).toBe('dronaarchery.com');
    expect(sameRegistrableDomain('https://dronaarchery.com/', 'https://www.dronaarchery.com/x')).toBe(true);
  });

  it('separates a genuinely different domain', () => {
    // The dronaarchery.com sitemap points at this one, which does not resolve.
    expect(sameRegistrableDomain('https://www.dronaarchery.com/', 'https://deonaarcheryacademy.com/')).toBe(false);
  });

  it('handles multi-label public suffixes', () => {
    expect(registrableDomain('shop.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('www.example.com.au')).toBe('example.com.au');
    expect(registrableDomain('a.b.example.co.in')).toBe('example.co.in');
  });

  it('treats an IP literal as its own identity', () => {
    expect(registrableDomain('http://127.0.0.1:8080/')).toBe('127.0.0.1');
  });
});
