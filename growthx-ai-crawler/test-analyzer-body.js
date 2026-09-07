const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const html = await axios.get('https://snitch.com').then(res => res.data);
  const $ = cheerio.load(html || '');
  
  $('script, style, noscript, svg, canvas, iframe, audio, video').remove();
  $('nav, header, .nav, .navbar, .menu, .header, [role="navigation"]').remove();
  $('footer, .footer, [role="contentinfo"]').remove();
  $('.cookie, #cookie, [class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]').remove();
  $('[hidden], [aria-hidden="true"], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]').remove();
  $('.modal, .dialog, .popup, [role="dialog"], [role="alertdialog"]').remove();

  console.log('Body HTML after cleaning:', $('body').html());
}

test().catch(console.error);
