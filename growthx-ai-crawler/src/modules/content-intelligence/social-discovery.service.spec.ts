import { SocialDiscoveryService } from './social-discovery.service';

/**
 * Adding a competitor recorded a domain and nothing else, so their social
 * accounts had to be typed in by hand before any of the intelligence pipeline
 * could run. A brand publishes its own handles in its footer, so the domain is
 * enough to find them.
 */
describe('SocialDiscoveryService — reading profiles off a competitor site', () => {
  const service = new SocialDiscoveryService({} as any);

  it('finds the profiles a site links in its footer', () => {
    const html = `
      <footer>
        <a href="https://www.instagram.com/indianfruitspulp/">Instagram</a>
        <a href="https://facebook.com/indianfruitspulp">Facebook</a>
        <a href="https://www.youtube.com/@indianfruitspulp">YouTube</a>
        <a href="https://in.linkedin.com/company/indian-fruits-pulp">LinkedIn</a>
        <a href="https://x.com/indianfruits">X</a>
      </footer>`;

    const found = service.extractAccounts(html);

    expect(found.map((a) => a.platform).sort()).toEqual([
      'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER', 'YOUTUBE',
    ]);
    expect(found.find((a) => a.platform === 'INSTAGRAM')?.handle).toBe('indianfruitspulp');
    expect(found.find((a) => a.platform === 'YOUTUBE')?.handle).toBe('@indianfruitspulp');
    expect(found.find((a) => a.platform === 'LINKEDIN')?.handle).toBe('company/indian-fruits-pulp');
  });

  it('ignores share buttons, which nearly every site has', () => {
    // Taking these as profiles would register "sharer" and "intent" as
    // competitor accounts on essentially every site on the web.
    const html = `
      <a href="https://www.facebook.com/sharer/sharer.php?u=https://example.com">Share</a>
      <a href="https://twitter.com/intent/tweet?text=hello">Tweet</a>
      <a href="https://www.linkedin.com/company/real-brand">Us</a>`;

    const found = service.extractAccounts(html);

    expect(found.map((a) => a.platform)).toEqual(['LINKEDIN']);
    expect(JSON.stringify(found)).not.toContain('sharer');
    expect(JSON.stringify(found)).not.toContain('intent');
  });

  it('keeps one entry per profile however many times it is linked', () => {
    const html = `
      <a href="https://instagram.com/brand">top</a>
      <a href="https://www.instagram.com/brand/">footer</a>
      <a href="https://instagram.com/brand">sidebar</a>`;

    expect(service.extractAccounts(html)).toHaveLength(1);
  });

  it('takes the handle only, not the post it happens to link to', () => {
    const html = '<a href="https://www.instagram.com/brandname/p/Cxyz123/">A post</a>';

    const found = service.extractAccounts(html);

    expect(found[0].handle).toBe('brandname');
  });

  it('finds nothing in a page that merely mentions the platforms', () => {
    const html = '<p>Follow us on Instagram and Facebook — search for our name!</p>';

    expect(service.extractAccounts(html)).toEqual([]);
  });

  it('does not carry regex state between pages', () => {
    // The patterns are global; reusing them without resetting lastIndex would
    // silently skip matches on the second page checked.
    const html = '<a href="https://instagram.com/brand">x</a>';

    expect(service.extractAccounts(html)).toHaveLength(1);
    expect(service.extractAccounts(html)).toHaveLength(1);
  });
  it('accepts a personal LinkedIn profile, not only a company page', () => {
    // The founder's profile is often a small firm's entire LinkedIn presence.
    const html = '<a href="https://www.linkedin.com/in/aishwarya-ingale1105/">Founder</a>';

    const found = service.extractAccounts(html);

    expect(found).toHaveLength(1);
    expect(found[0].handle).toBe('in/aishwarya-ingale1105');
  });

  it('ignores an embedded video, which is not a channel', () => {
    const html = '<iframe src="https://www.youtube.com/embed/dVVcYHIIyB8?si=abc"></iframe>';

    expect(service.extractAccounts(html)).toEqual([]);
  });

  it('ignores icon markup that links nowhere', () => {
    // Both sites this was first tried against ship social icons with href="#".
    const html = '<a href="#"><i class="ph ph-instagram-logo"></i></a>' +
      '<style>.et-social-instagram a.icon:before{content:"\\e09a"}</style>';

    expect(service.extractAccounts(html)).toEqual([]);
  });
});
