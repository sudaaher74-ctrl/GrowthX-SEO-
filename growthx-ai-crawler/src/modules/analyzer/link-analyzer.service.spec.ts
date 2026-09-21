import { Test, TestingModule } from '@nestjs/testing';
import { LinkAnalyzerService } from './link-analyzer.service';
import * as cheerio from 'cheerio';
import { LinkType, Page, Link } from '@prisma/client';

describe('LinkAnalyzerService', () => {
  let service: LinkAnalyzerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LinkAnalyzerService],
    }).compile();

    service = module.get<LinkAnalyzerService>(LinkAnalyzerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should classify internal and external links based on origin', () => {
    const html = `
      <a href="/about">About Us</a>
      <a href="https://example.com/pricing">Pricing</a>
      <a href="https://external-service.com/docs">External Docs</a>
      <a href="http://otherdomain.org/help">Help Center</a>
    `;
    const $ = cheerio.load(html);
    const result = service.analyzeLinks($, 'https://example.com/home');

    expect(result.internalCount).toBe(2);
    expect(result.externalCount).toBe(2);
    expect(result.totalCount).toBe(4);

    expect(result.internalLinks.map((l) => l.targetUrl)).toEqual([
      'https://example.com/about',
      'https://example.com/pricing',
    ]);
    expect(result.externalLinks.map((l) => l.targetUrl)).toEqual([
      'https://external-service.com/docs',
      'http://otherdomain.org/help',
    ]);
  });

  it('should detect nofollow, sponsored, and ugc rel attributes', () => {
    const html = `
      <a href="https://partner1.com" rel="nofollow">Partner 1</a>
      <a href="https://partner2.com" rel="ugc">Forum Contributor</a>
      <a href="https://sponsor.com" rel="sponsored">Sponsor Link</a>
      <a href="https://mixed.com" rel="noopener noreferrer nofollow">Mixed Rel</a>
      <a href="https://trusted.com" rel="noopener noreferrer">Trusted External</a>
      <a href="/internal-nofollow" rel="nofollow">Internal Nofollow</a>
    `;
    const $ = cheerio.load(html);
    const result = service.analyzeLinks($, 'https://example.com');

    expect(result.nofollowLinks).toHaveLength(5);
    const nofollowHrefs = result.nofollowLinks.map((l) => l.rawHref);
    expect(nofollowHrefs).toContain('https://partner1.com');
    expect(nofollowHrefs).toContain('https://partner2.com');
    expect(nofollowHrefs).toContain('https://sponsor.com');
    expect(nofollowHrefs).toContain('https://mixed.com');
    expect(nofollowHrefs).toContain('/internal-nofollow');

    const trustedLink = result.externalLinks.find((l) => l.rawHref === 'https://trusted.com');
    expect(trustedLink?.isNofollow).toBe(false);
  });

  it('should detect broken same-page anchor links when target ID or name is missing', () => {
    const html = `
      <div id="features">Features Content</div>
      <a name="contact-anchor"></a>
      <a href="#features">Jump to Features</a>
      <a href="#contact-anchor">Jump to Contact</a>
      <a href="#missing-section">Jump to Missing</a>
      <a href="#">Top of page</a>
    `;
    const $ = cheerio.load(html);
    const result = service.analyzeLinks($, 'https://example.com/product');

    expect(result.brokenAnchors).toHaveLength(1);
    expect(result.brokenAnchors[0].rawHref).toBe('#missing-section');
    expect(result.brokenAnchors[0].isBrokenAnchor).toBe(true);
    expect(result.brokenAnchors[0].targetUrl).toBe('https://example.com/product#missing-section');
  });

  it('should detect broken anchor hash on internal URLs matching current pathname and strip hash from targetUrl', () => {
    const html = `
      <h2 id="section-1">Section 1</h2>
      <a href="https://example.com/docs/api#section-1">Valid Anchor Full URL</a>
      <a href="https://example.com/docs/api#section-missing">Broken Anchor Full URL</a>
    `;
    const $ = cheerio.load(html);
    const result = service.analyzeLinks($, 'https://example.com/docs/api');

    expect(result.internalLinks).toHaveLength(2);
    // targetUrl should have hash stripped for graph tracking
    expect(result.internalLinks[0].targetUrl).toBe('https://example.com/docs/api');
    expect(result.internalLinks[0].isBrokenAnchor).toBe(false);

    expect(result.internalLinks[1].targetUrl).toBe('https://example.com/docs/api');
    expect(result.internalLinks[1].isBrokenAnchor).toBe(true);

    expect(result.brokenAnchors).toHaveLength(1);
    expect(result.brokenAnchors[0].rawHref).toBe('https://example.com/docs/api#section-missing');
  });

  it('should ignore non-navigational protocols (javascript:, mailto:, tel:) and empty hrefs', () => {
    const html = `
      <a href="javascript:void(0)">Click Here</a>
      <a href="mailto:support@example.com">Email Us</a>
      <a href="tel:+18005550199">Call Us</a>
      <a href="">Empty Link</a>
      <a href="   ">Whitespace Link</a>
      <a>Anchor without href</a>
      <a href="/valid-page">Valid Page</a>
    `;
    const $ = cheerio.load(html);
    const result = service.analyzeLinks($, 'https://example.com');

    expect(result.totalCount).toBe(1);
    expect(result.internalLinks[0].targetUrl).toBe('https://example.com/valid-page');
    expect(result.brokenAnchors).toHaveLength(0);
  });

  it('should normalize anchor text by trimming and collapsing multiple whitespaces', () => {
    const html = `
      <a href="/page1">
        Custom
        Multi-line
        Anchor Text
      </a>
      <a href="/page2"></a>
      <a href="/page3">   </a>
    `;
    const $ = cheerio.load(html);
    const result = service.analyzeLinks($, 'https://example.com');

    expect(result.internalLinks[0].anchorText).toBe('Custom Multi-line Anchor Text');
    expect(result.internalLinks[1].anchorText).toBeUndefined();
    expect(result.internalLinks[2].anchorText).toBeUndefined();
  });

  it('should resolve relative URLs properly against base pageUrl', () => {
    const html = `
      <a href="subpage">Subpage</a>
      <a href="../parent-page">Parent Page</a>
      <a href="/root-page">Root Page</a>
    `;
    const $ = cheerio.load(html);
    const result = service.analyzeLinks($, 'https://example.com/section/category/');

    expect(result.internalLinks.map((l) => l.targetUrl)).toEqual([
      'https://example.com/section/category/subpage',
      'https://example.com/section/parent-page',
      'https://example.com/root-page',
    ]);
  });

  it('should safely handle malformed URIs without throwing', () => {
    const html = `
      <a href="http://[:::1]">Malformed IPv6</a>
      <a href="/valid">Valid</a>
    `;
    const $ = cheerio.load(html);
    expect(() => service.analyzeLinks($, 'https://example.com')).not.toThrow();
  });

  it('should invoke and integrate with underlying Page and Link Prisma models', () => {
    // Model invocation: Page and Link entity structure validation
    const mockPage: Partial<Page> = {
      id: 'page_audit_link_1',
      crawlJobId: 'job_audit_1',
      url: 'https://example.com/features',
      finalUrl: 'https://example.com/features',
      statusCode: 200,
      responseTimeMs: 120,
    };

    const html = `
      <div id="cta">Call to Action</div>
      <a href="/pricing">View Pricing</a>
      <a href="https://external-partner.org" rel="nofollow">Partner Site</a>
      <a href="#broken-cta">Missing CTA</a>
    `;
    const $ = cheerio.load(html);
    const result = service.analyzeLinks($, mockPage.url!);

    // Map extracted links into Prisma Link model instances
    const createdLinks: Partial<Link>[] = [];

    for (const extracted of [...result.internalLinks, ...result.externalLinks]) {
      const linkModel: Partial<Link> = {
        id: `link_${createdLinks.length + 1}`,
        sourcePageId: mockPage.id!,
        targetUrl: extracted.targetUrl,
        linkType: extracted.linkType === 'INTERNAL' ? LinkType.INTERNAL : LinkType.EXTERNAL,
        isBroken: extracted.isBrokenAnchor,
        isRedirect: false,
        isNofollow: extracted.isNofollow,
        anchorText: extracted.anchorText || null,
      };
      createdLinks.push(linkModel);
    }

    expect(createdLinks).toHaveLength(2);
    expect(createdLinks[0].sourcePageId).toBe(mockPage.id);
    expect(createdLinks[0].linkType).toBe(LinkType.INTERNAL);
    expect(createdLinks[0].targetUrl).toBe('https://example.com/pricing');
    expect(createdLinks[0].anchorText).toBe('View Pricing');

    expect(createdLinks[1].sourcePageId).toBe(mockPage.id);
    expect(createdLinks[1].linkType).toBe(LinkType.EXTERNAL);
    expect(createdLinks[1].targetUrl).toBe('https://external-partner.org/');
    expect(createdLinks[1].isNofollow).toBe(true);

    expect(result.brokenAnchors).toHaveLength(1);
    expect(result.brokenAnchors[0].isBrokenAnchor).toBe(true);
  });
});
