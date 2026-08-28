/**
 * Whether a URL is worth fetching as a page.
 *
 * The crawler followed every internal link, including links to files. On the
 * first competitor crawled that meant 74 images and 2 PDFs downloaded out of
 * 92 fetches — 82% of the crawl spent pulling media off a third party's server
 * that nothing in the product can read.
 *
 * That was three faults at once. It is rude: a page ceiling bounds how many
 * requests are made but says nothing about their weight, and images are far
 * heavier than the HTML they were meant to protect. It is wrong: every count
 * became six times too large, so "92 pages" described a 16-page site. And it
 * quietly broke topic matching, which is how it was noticed — the site's own
 * name appeared in only 16 of 92 stored "pages", fell under the threshold that
 * marks a word as site boilerplate, was therefore never stripped, and a page
 * the customer genuinely had scored 0.50 against its counterpart instead of
 * 1.00 and was reported as a gap. The visible symptom was a recommendation to
 * write a page about "mangopulp", which is a JPEG filename.
 *
 * Extensions are checked before fetching rather than content types after,
 * because the entire point is not to make the request. Content type is checked
 * too, in the crawler, for the extensionless cases this cannot see.
 */

/**
 * Extensions that are never an HTML page.
 *
 * Deliberately a list of things to exclude rather than a list of allowed page
 * extensions: most real pages have no extension at all, and an allowlist would
 * drop them.
 */
const NON_PAGE_EXTENSIONS = new Set([
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'tiff',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'rtf',
  // Archives and binaries
  'zip', 'rar', 'gz', 'tar', '7z', 'dmg', 'exe', 'apk', 'pkg',
  // Media
  'mp3', 'mp4', 'avi', 'mov', 'wmv', 'webm', 'ogg', 'wav', 'flv', 'm4a',
  // Assets — a crawler following these learns nothing about the site's content
  'css', 'js', 'mjs', 'map', 'woff', 'woff2', 'ttf', 'eot', 'otf',
  // Feeds and data
  'xml', 'rss', 'atom', 'json', 'csv', 'txt',
]);

export function isCrawlablePage(rawUrl: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    pathname = rawUrl.split('?')[0].split('#')[0];
  }

  const lastSegment = pathname.split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  if (dot === -1) return true; // No extension — almost always a page.

  const extension = lastSegment.slice(dot + 1).toLowerCase();
  return !NON_PAGE_EXTENSIONS.has(extension);
}

/**
 * Whether what came back is HTML.
 *
 * The backstop for URLs with no extension to judge by — a CMS serving a PDF
 * from /downloads/latest, for instance. Checked after the response arrives, so
 * it does not save the request, only the storage and the miscounting.
 *
 * A missing content type is treated as HTML: some servers omit it, and
 * discarding a real page because a header was absent is the worse error.
 */
export function isHtmlResponse(contentType: string | null | undefined): boolean {
  if (!contentType) return true;
  const type = contentType.split(';')[0].trim().toLowerCase();
  return type === 'text/html' || type === 'application/xhtml+xml' || type === '';
}
