const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const html = await axios.get('https://snitch.com').then(res => res.data);
  const $ = cheerio.load(html || '');
  
  // 1. Measure raw body text for boilerplate calculation
  const rawBodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const rawWords = rawBodyText.split(' ').filter((w) => w.length > 0);
  const rawWordCount = rawWords.length;
  
  console.log('Raw word count:', rawWordCount);
  
  // 2. Strip scripts, styles, media, and structural boilerplate
  $('script, style, noscript, svg, canvas, iframe, audio, video').remove();
  $('nav, header, .nav, .navbar, .menu, .header, [role="navigation"]').remove();
  $('footer, .footer, [role="contentinfo"]').remove();
  $('.cookie, #cookie, [class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]').remove();
  $('[hidden], [aria-hidden="true"], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]').remove();
  $('.modal, .dialog, .popup, [role="dialog"], [role="alertdialog"]').remove();

  // 3. Attempt extraction from dedicated content containers
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '#content',
    '#main-content',
    '.content',
    '.main-content',
    '.post-content',
    '.page-content',
  ];

  let cleanText = '';
  let extractionMethod = 'body_cleaned';
  let mainContentSelector = 'body';

  for (const selector of contentSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      const text = el.text().replace(/\s+/g, ' ').trim();
      const words = text.split(' ').filter((w) => w.length > 0);
      if (words.length >= 30) {
        cleanText = text;
        extractionMethod = 'semantic_region';
        mainContentSelector = selector;
        break;
      }
    }
  }

  if (!cleanText) {
    cleanText = $('body').text().replace(/\s+/g, ' ').trim();
    extractionMethod = 'body_cleaned';
    mainContentSelector = 'body';
  }

  const words = cleanText.split(' ').filter((w) => w.length > 0);
  const wordCount = words.length;

  console.log('Clean word count:', wordCount);
  console.log('Method:', extractionMethod, 'Selector:', mainContentSelector);
}

test().catch(console.error);
