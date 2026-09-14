/**
 * The client-side script that turns the empty shell into the real page.
 *
 * A faithful stand-in for dronaarchery.com's Vite bundle: it injects the title,
 * meta description, JSON-LD, headings, body copy and navigation that exist only
 * after JavaScript runs, and produces the same measurements the live site does
 * (427 words, 2 h1, 7 h2, 6 images, 5 internal routes). Hand-written rather
 * than a copy of the 551 KB production bundle so the fixture stays readable and
 * the numbers it asserts are visible in the test rather than buried in minified
 * output.
 */
export const SPA_CLIENT_BUNDLE = `
(function () {
  // Route-aware, as the real single-page app is: each path renders its own
  // copy so the fixture does not present five identical pages.
  var route = window.location.pathname;
  var routeName = route === '/' ? '' : route.replace(/[^a-z]/gi, ' ').trim();

  document.title = route === '/'
    ? 'Best Archery Academy New Panvel | Archery Coaching Navi Mumbai | Drona Archery Academy'
    : 'Best Archery Academy New Panvel | ' + routeName + ' | Drona Archery Academy';

  var desc = document.createElement('meta');
  desc.setAttribute('name', 'description');
  desc.setAttribute('content', 'Deona Archery Academy in New Panvel, Navi Mumbai offers professional archery coaching, kids archery classes, beginner training, and Olympic recurve training.');
  document.head.appendChild(desc);

  var ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Drona Archery Academy', address: { '@type': 'PostalAddress', addressLocality: 'New Panvel', addressRegion: 'Maharashtra', addressCountry: 'IN' }, telephone: '+919699414848' },
    { '@context': 'https://schema.org', '@type': 'SportsActivityLocation', name: 'Drona Archery Academy' },
    { '@context': 'https://schema.org', '@type': 'SportsOrganization', name: 'Drona Archery Academy' }
  ]);
  document.head.appendChild(ld);

  var sentence = 'Drona Archery Academy ' + (routeName || 'home') + ' trains beginners and competitive archers across New Panvel and Navi Mumbai with Olympic recurve coaching, certified instructors, and structured progression from first arrow to tournament podium. ';
  var body = '';
  for (var i = 0; i < 22; i++) { body += sentence; }

  var nav = ['/', '/about', '/archery-programs', '/gallery', '/contact']
    .map(function (href) { return '<a href="' + href + '">' + href + '</a>'; })
    .join(' ');

  var images = '';
  for (var j = 0; j < 6; j++) {
    images += '<img src="/img/range-' + j + '.jpg" alt="Archery range photograph ' + j + '" width="800" height="600" loading="lazy">';
  }

  document.getElementById('root').innerHTML =
    '<header><nav>' + nav + '</nav></header>' +
    '<main>' +
      '<h1>Best Archery Academy in New Panvel' + (routeName ? ': ' + routeName : '') + '</h1>' +
      '<h1>Olympic Recurve Coaching in Navi Mumbai</h1>' +
      '<h2>Beginner Programs</h2><h2>Kids Archery</h2><h2>Olympic Recurve</h2>' +
      '<h2>Coaching Team</h2><h2>Facilities</h2><h2>Tournaments</h2><h2>Contact Us</h2>' +
      '<p>' + body + '</p>' +
      images +
    '</main>' +
    '<footer>' +
      '<a href="https://wa.me/919699414848">WhatsApp</a>' +
      '<a href="mailto:dronaarchery@gmail.com">Email</a>' +
      '<a href="tel:+919699414848">Call</a>' +
      '<a href="https://instagram.com/dronaarchery">Instagram</a>' +
      '<a href="https://facebook.com/dronaarchery">Facebook</a>' +
    '</footer>';
})();
`;

/** An ordinary server-rendered page, for the cases that must NOT escalate. */
export function staticPage(opts: {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  h1?: string;
  body?: string;
  links?: string[];
} = {}): string {
  const links = (opts.links || ['/a', '/b']).map((h) => `<a href="${h}">link</a>`).join('');
  const body = opts.body || 'This page is served complete by the origin and needs no JavaScript to be read. '.repeat(12);
  return `<!doctype html><html lang="en"><head>
<title>${opts.title ?? 'A server-rendered page'}</title>
${opts.description ? `<meta name="description" content="${opts.description}">` : ''}
${opts.canonical ? `<link rel="canonical" href="${opts.canonical}">` : ''}
${opts.robots ? `<meta name="robots" content="${opts.robots}">` : ''}
</head><body><main><h1>${opts.h1 ?? 'Heading'}</h1><p>${body}</p>${links}</main></body></html>`;
}
