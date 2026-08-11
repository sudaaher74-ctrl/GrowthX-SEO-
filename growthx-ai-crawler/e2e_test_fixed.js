const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    console.log("Waiting for auto-login to complete...");
    await page.goto('https://growth-x-seo.vercel.app/dashboard', { waitUntil: 'networkidle' });
    
    // Wait for the reload to finish by checking for a known element that only appears after login
    await page.waitForSelector('h1', { state: 'visible', timeout: 30000 });
    
    console.log("Navigating to Add Client...");
    await page.goto('https://growth-x-seo.vercel.app/projects', { waitUntil: 'networkidle' });
    
    // Explicitly wait for the input to appear
    await page.waitForSelector('input[placeholder="Acme Inc."]', { state: 'visible' });
    console.log("Filling out client details...");
    await page.fill('input[placeholder="Acme Inc."]', 'Test Client 2');
    await page.fill('input[placeholder="https://example.com"]', 'test-milquu.com');
    await page.click('button[type="submit"]');
    
    console.log("Waiting for Technical SEO page...");
    await page.waitForURL(/\/technical-seo\?domain=test-milquu\.com/, { timeout: 15000 });
    
    console.log("Success! Dashboard & DB are fully linked.");
  } catch (err) {
    console.error("Test Failed:", err.message);
  } finally {
    await browser.close();
  }
})();
