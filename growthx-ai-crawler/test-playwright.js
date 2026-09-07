const { chromium } = require('playwright');
const cheerio = require('cheerio');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://snitch.co.in/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);
  
  const html = await page.content();
  const $ = cheerio.load(html);
  const links = $('a[href]').length;
  console.log('Links extracted after 1000ms:', links);
  
  await page.waitForTimeout(2000);
  const html2 = await page.content();
  const $2 = cheerio.load(html2);
  const links2 = $2('a[href]').length;
  console.log('Links extracted after 3000ms:', links2);
  
  await browser.close();
}
test().catch(console.error);
