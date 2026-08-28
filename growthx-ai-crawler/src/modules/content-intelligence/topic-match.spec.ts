import {
  closestMatch,
  distinctiveTokens,
  MATCH_THRESHOLD,
  siteBoilerplate,
  topicOverlap,
  topicTokens,
} from './topic-match';

/**
 * This decides which competitor pages are shown as opportunities. Both errors
 * cost something real: a false match hides a gap so the customer never writes
 * the page, and a false gap sends them to write one they already have.
 */
describe('topicTokens', () => {
  it('reads the topic out of a URL slug', () => {
    expect([...topicTokens('https://acme.com/services/mango-pulp-export')].sort()).toEqual([
      'export',
      'mango',
      'pulp',
    ]);
  });

  it('takes the topic from the title when the URL has none', () => {
    // A CMS that serves /p/1423 is common, and the page still has a subject.
    expect(topicTokens('https://acme.com/p/1423', 'Aseptic Mango Pulp')).toContain('mango');
    expect(topicTokens('https://acme.com/p/1423', 'Aseptic Mango Pulp')).toContain('aseptic');
  });

  it('drops words that appear on every site', () => {
    // Without this, a home page titled "Best Quality Products | Acme Ltd"
    // matches every product page on the other site.
    const tokens = topicTokens('https://acme.com/', 'Best Quality Products | Acme Ltd - Official Website');
    expect([...tokens]).toEqual(['acme']);
  });

  it('ignores file extensions and numbers', () => {
    expect([...topicTokens('https://acme.com/banana-pulp.html')].sort()).toEqual(['banana', 'pulp']);
    expect(topicTokens('https://acme.com/2024')).toEqual(new Set());
  });
});

describe('topicOverlap', () => {
  it('measures how much of their topic our page covers, not how alike they are', () => {
    // Our broader page does cover their narrower one. A symmetric measure
    // would penalise us for saying more, and hide a page we actually have.
    const theirs = topicTokens('https://them.com/mango-pulp');
    const oursBroad = topicTokens('https://us.com/mango-banana-guava-pulp-export');

    expect(topicOverlap(theirs, oursBroad)).toBe(1);
    expect(topicOverlap(oursBroad, theirs)).toBeLessThan(1);
  });

  it('is zero when nothing is shared, and never divides by an empty set', () => {
    expect(topicOverlap(topicTokens('https://them.com/mango'), topicTokens('https://us.com/tractors'))).toBe(0);
    expect(topicOverlap(new Set(), topicTokens('https://us.com/mango'))).toBe(0);
  });
});

describe('closestMatch', () => {
  const ours = [
    { url: 'https://us.com/what-we-do/exporting-mango-pulp', title: 'Exporting Mango Pulp' },
    { url: 'https://us.com/about', title: 'About Us' },
    { url: 'https://us.com/blog/frozen-vegetable-logistics', title: 'Frozen Vegetable Logistics' },
  ];

  it('recognises the same topic worded differently', () => {
    // The whole point: their /services/mango-pulp-export and our
    // /what-we-do/exporting-mango-pulp are one topic, and listing it as a gap
    // would send someone to write a page they already have.
    const match = closestMatch({ url: 'https://them.com/services/mango-pulp-export' }, ours);

    expect(match?.page.url).toBe('https://us.com/what-we-do/exporting-mango-pulp');
    expect(match!.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it('matches across page kinds', () => {
    // They cover it with a service page, we cover it with a blog post. Still
    // covered — reporting a gap because the page kinds differ would be wrong.
    const match = closestMatch(
      { url: 'https://them.com/services/frozen-vegetable-logistics', pageType: 'SERVICE' },
      ours,
    );

    expect(match?.page.url).toBe('https://us.com/blog/frozen-vegetable-logistics');
    expect(match!.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it('finds nothing close for a topic we do not cover', () => {
    const match = closestMatch({ url: 'https://them.com/services/tractor-leasing' }, ours);

    expect(match === null || match.score < MATCH_THRESHOLD).toBe(true);
  });

  it('returns the best match, not the first one that shares a word', () => {
    const match = closestMatch({ url: 'https://them.com/mango-pulp-export' }, ours);
    expect(match?.page.url).toBe('https://us.com/what-we-do/exporting-mango-pulp');
  });

  it('returns null rather than guessing when their page has no topic words', () => {
    // A page we cannot read a topic from must not be matched against anything,
    // and must not be announced as a gap either.
    expect(closestMatch({ url: 'https://them.com/2024', title: 'Home' }, ours)).toBeNull();
  });

  it('copes with an empty site on our side', () => {
    expect(closestMatch({ url: 'https://them.com/mango-pulp' }, [])).toBeNull();
  });
});

/**
 * Almost every site appends its own name to every page title. Those words are
 * not the topic, and leaving them in breaks matching in the direction that
 * costs most: measured on the real crawl, their /products/tomato-paste and
 * ours score 0.50 purely because half of each title is a different brand, so
 * a page the customer already has is reported as a gap to go and write.
 */
describe('siteBoilerplate', () => {
  const site = (paths: string[], brand: string) =>
    paths.map((p) => ({ url: `https://x.com/${p}`, title: `${p.replace(/-/g, ' ')} | ${brand}` }));

  it('finds the words a site puts on every page', () => {
    const pages = site(['tomato-paste', 'mango-pulp', 'banana-pulp', 'about', 'contact'], 'Aiva Enterprises');
    expect([...siteBoilerplate(pages)].sort()).toEqual(['aiva', 'enterprises']);
  });

  it('leaves real topic words alone even when they repeat', () => {
    // "pulp" is on two of five pages. That is a topic, not boilerplate, and
    // dropping it would make two genuinely different pages look identical.
    const pages = site(['mango-pulp', 'banana-pulp', 'about', 'contact', 'tomato-paste'], 'Aiva Enterprises');
    expect(siteBoilerplate(pages).has('pulp')).toBe(false);
  });

  it('does nothing on a site too small to measure', () => {
    // On a four-page site a genuine topic word can appear on half the pages.
    expect(siteBoilerplate(site(['mango-pulp', 'about'], 'Aiva'))).toEqual(new Set());
  });
});

describe('closestMatch across two brands', () => {
  // Real page titles from the crawled site, with a competitor invented only
  // in the sense that the brand differs — the shape is what matters.
  const ourPages = [
    { url: 'https://aivaenterprises.com/products/tomato-paste', title: 'Tomato Paste | AIVA Enterprises' },
    { url: 'https://aivaenterprises.com/products/alphonso-mango-pulp', title: 'Alphonso Mango Pulp | AIVA Enterprises' },
    { url: 'https://aivaenterprises.com/products/banana-concentrate', title: 'Banana Concentrate | AIVA Enterprises' },
    { url: 'https://aivaenterprises.com/about', title: 'About | AIVA Enterprises' },
    { url: 'https://aivaenterprises.com/contact', title: 'Contact | AIVA Enterprises' },
  ];
  const theirPages = [
    { url: 'https://acmefoods.com/products/tomato-paste', title: 'Tomato Paste | Acme Foods' },
    { url: 'https://acmefoods.com/products/guava-pulp', title: 'Guava Pulp | Acme Foods' },
    { url: 'https://acmefoods.com/about', title: 'About | Acme Foods' },
    { url: 'https://acmefoods.com/contact', title: 'Contact | Acme Foods' },
    { url: 'https://acmefoods.com/products/tractor-leasing', title: 'Tractor Leasing | Acme Foods' },
  ];
  const boilerplate = { theirs: siteBoilerplate(theirPages), ours: siteBoilerplate(ourPages) };

  it('matches a topic both sites cover, despite different brands in the title', () => {
    const bare = closestMatch(theirPages[0], ourPages);
    const withBrandsRemoved = closestMatch(theirPages[0], ourPages, boilerplate);

    // The bug this guards: without the brand words removed the score is 0.5,
    // below threshold, and a page we have is listed as one we lack.
    expect(bare!.score).toBeLessThan(MATCH_THRESHOLD);
    expect(withBrandsRemoved!.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
    expect(withBrandsRemoved!.page.url).toContain('tomato-paste');
  });

  it('still reports a topic we genuinely do not cover', () => {
    // Removing brand words must not make everything match everything.
    const match = closestMatch(theirPages[4], ourPages, boilerplate);
    expect(match === null || match.score < MATCH_THRESHOLD).toBe(true);
  });

  it('does not match guava pulp to mango pulp on the shared word alone', () => {
    const match = closestMatch(theirPages[1], ourPages, boilerplate);
    expect(match!.score).toBeLessThan(MATCH_THRESHOLD);
  });
});

/**
 * Found by running the real competitor through the matcher: their front page
 * has no topic beyond the company name, closestMatch returned null, the
 * service read that null as "nothing of ours is close", and their home page
 * was listed as a page the customer should go and write.
 */
describe('distinctiveTokens', () => {
  const pages = [
    { url: 'https://ifp.com/', title: 'Indian Fruits Pulp' },
    { url: 'https://ifp.com/mango-pulp/', title: 'Mango Pulp | Indian Fruits Pulp' },
    { url: 'https://ifp.com/guava-pulp/', title: 'Guava Pulp | Indian Fruits Pulp' },
    { url: 'https://ifp.com/banana-pulp/', title: 'Banana Pulp | Indian Fruits Pulp' },
    { url: 'https://ifp.com/about-us/', title: 'About Us | Indian Fruits Pulp' },
    { url: 'https://ifp.com/contact-us/', title: 'Contact Us | Indian Fruits Pulp' },
  ];
  const boilerplate = siteBoilerplate(pages);

  it('is empty for a page whose only words are the company name', () => {
    // Not a degenerate case to paper over — it is the answer. This page has no
    // topic, so it is neither matchable nor missing.
    expect(distinctiveTokens(pages[0], boilerplate).size).toBe(0);
  });

  it('keeps what makes a real page distinct', () => {
    expect([...distinctiveTokens(pages[1], boilerplate)]).toContain('mango');
  });

  it('makes closestMatch return null for a page with no topic', () => {
    expect(closestMatch(pages[0], pages.slice(1), { theirs: boilerplate, ours: boilerplate })).toBeNull();
  });
});
