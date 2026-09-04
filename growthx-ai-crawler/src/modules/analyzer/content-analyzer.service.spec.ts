import { ContentAnalyzerService } from './content-analyzer.service';

describe('ContentAnalyzerService', () => {
  let service: ContentAnalyzerService;

  beforeEach(() => {
    service = new ContentAnalyzerService();
  });

  it('strips nav, footer, and cookie banner from word count', () => {
    const html = `
      <html>
        <header>
          <nav>Home About Services Products Contact Careers Pricing Documentation</nav>
        </header>
        <div class="cookie-banner">
          We use cookies to improve your experience. Accept All or Reject All.
        </div>
        <main>
          <h1>Enterprise Industrial Automation Solutions</h1>
          <p>We provide high-precision robotics, conveyor systems, and programmable logic controller integrations for modern manufacturing facilities worldwide. Our engineering team designs custom automation cells that increase throughput and reduce operational downtime.</p>
        </main>
        <footer>
          <p>Copyright 2026 Aiva Enterprises Inc. All rights reserved. Privacy Policy Terms of Service.</p>
        </footer>
      </html>
    `;

    const metrics = service.analyzeContent(html, ['Enterprise Industrial Automation Solutions'], [], [], 0, 0, 0);

    expect(metrics.mainContentSelector).toBe('main');
    expect(metrics.extractionMethod).toBe('semantic_region');
    // Navigation words ('Home About Services Products...') should not be counted
    expect(metrics.wordCount).toBeGreaterThan(20);
    expect(metrics.wordCount).toBeLessThan(45);
    expect(metrics.boilerplatePercentage).toBeGreaterThan(30);
  });

  it('ignores hidden elements when calculating content words', () => {
    const html = `
      <body>
        <main>
          <h1>Real Title</h1>
          <p>This is real visible content that visitors read.</p>
          <div style="display:none">Hidden keyword stuffing spam words that search engines should ignore</div>
          <div hidden>Another hidden text block</div>
        </main>
      </body>
    `;

    const metrics = service.analyzeContent(html, ['Real Title'], [], [], 0, 0, 0);
    expect(metrics.wordCount).toBe(10); // 'Real Title This is real visible content that visitors read.'
  });
});
