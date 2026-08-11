const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  console.log("Navigating to Vercel...");
  await page.goto('https://growth-x-seo.vercel.app/dashboard', { waitUntil: 'networkidle' });
  const content = await page.content();
  if (content.includes('Dashboard') || content.includes('GrowthX')) {
    console.log("Vercel app is live and loaded correctly!");
  } else {
    console.log("Something might be wrong. Page didn't contain expected text.");
  }
  await browser.close();
})();
