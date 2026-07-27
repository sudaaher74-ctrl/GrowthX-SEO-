import { Test, TestingModule } from '@nestjs/testing';
import { HtmlExtractorService } from './html-extractor.service';

describe('HtmlExtractorService', () => {
  let service: HtmlExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HtmlExtractorService],
    }).compile();

    service = module.get<HtmlExtractorService>(HtmlExtractorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should extract title, meta description, canonical, and h1 headings', () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Test SEO Title</title>
        <meta name="description" content="This is a test meta description for GrowthX AI.">
        <link rel="canonical" href="https://growthx.ai/test">
        <meta property="og:title" content="Test OG Title">
      </head>
      <body>
        <h1>Primary Heading 1</h1>
        <h2>Secondary Heading 2</h2>
        <script type="application/ld+json">
          { "@context": "https://schema.org", "@type": "Organization", "name": "GrowthX" }
        </script>
      </body>
      </html>
    `;

    const res = service.extract(sampleHtml, 'https://growthx.ai/test');
    expect(res.title).toBe('Test SEO Title');
    expect(res.metaDescription).toBe('This is a test meta description for GrowthX AI.');
    expect(res.canonicalUrl).toBe('https://growthx.ai/test');
    expect(res.h1).toEqual(['Primary Heading 1']);
    expect(res.h2).toEqual(['Secondary Heading 2']);
    expect(res.openGraph['og:title']).toBe('Test OG Title');
    expect(res.jsonLd.length).toBe(1);
    expect(res.jsonLd[0].name).toBe('GrowthX');
    expect(res.language).toBe('en');
  });
});
