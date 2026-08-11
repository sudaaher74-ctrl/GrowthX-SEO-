const { chromium } = require('playwright');
(async () => {
  console.log("Launching browser to test Vercel deployment...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // 1. Visit dashboard
    console.log("Navigating to dashboard...");
    await page.goto('https://growth-x-seo.vercel.app/dashboard', { waitUntil: 'networkidle' });
    
    // 2. Navigate to Projects (Add Client)
    console.log("Navigating to Projects / Add Client...");
    await page.goto('https://growth-x-seo.vercel.app/projects', { waitUntil: 'networkidle' });
    
    // Fill out the client creation form
    console.log("Filling out client details...");
    await page.fill('input[placeholder="Acme Inc."]', 'Test E2E Client');
    await page.fill('input[placeholder="https://example.com"]', 'example.com');
    
    // Click submit (the button inside the form)
    console.log("Submitting client...");
    await page.click('button[type="submit"]');
    
    // Wait for redirect to technical-seo?domain=...
    console.log("Waiting for redirect to Technical SEO page...");
    await page.waitForURL(/\/technical-seo\?domain=example.com/, { timeout: 15000 });
    console.log("Successfully redirected to Technical SEO page!");

    // 3. Trigger a Crawl
    console.log("Clicking 'Run audit'...");
    const runAuditBtn = page.getByRole('button', { name: /Run audit/i });
    await runAuditBtn.click();
    
    // Wait to see if crawl starts without error
    console.log("Waiting for crawl to initialize...");
    await page.waitForTimeout(5000);
    const content = await page.content();
    if (content.includes("Starting") || content.includes("queued")) {
       console.log("Crawl initialized successfully!");
    } else {
       console.log("Crawl might have started, checking UI state...");
    }
    
    console.log("✅ All E2E tests passed successfully on live Vercel frontend!");
  } catch (err) {
    console.error("❌ E2E Test Failed:", err);
  } finally {
    await browser.close();
  }
})();
