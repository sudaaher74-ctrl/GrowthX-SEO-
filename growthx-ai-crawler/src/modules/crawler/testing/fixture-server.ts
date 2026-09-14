import * as http from 'http';
import { AddressInfo } from 'net';
import * as zlib from 'zlib';

export interface FixtureRoute {
  status?: number;
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** Full control, for a route that must inspect the request. */
  handler?: (req: http.IncomingMessage, res: http.ServerResponse) => void;
}

export interface FixtureServer {
  origin: string;
  url: (path: string) => string;
  /** Every path requested, in order, for asserting on what was crawled. */
  requests: Array<{ path: string; userAgent?: string; headers: http.IncomingHttpHeaders }>;
  close: () => Promise<void>;
}

/**
 * A real HTTP origin for the crawler to crawl.
 *
 * Fixtures are served over a socket rather than stubbed at the client, because
 * the defects this suite exists to catch live in the transport: redirect chains
 * walked hop by hop, a WAF that answers on headers, gzipped sitemaps, an
 * X-Robots-Tag that never appears in the HTML. None of that is exercised by
 * mocking `fetch`.
 */
export async function startFixtureServer(routes: Record<string, FixtureRoute>): Promise<FixtureServer> {
  const requests: FixtureServer['requests'] = [];

  const server = http.createServer((req, res) => {
    const path = (req.url || '/').split('#')[0];
    requests.push({ path, userAgent: req.headers['user-agent'], headers: req.headers });

    const route = routes[path] ?? routes[path.split('?')[0]] ?? routes['*'];
    if (!route) {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<!doctype html><html><body>Not found</body></html>');
      return;
    }
    if (route.handler) {
      route.handler(req, res);
      return;
    }
    const body = route.body ?? '';
    res.writeHead(route.status ?? 200, { 'content-type': 'text/html; charset=utf-8', ...(route.headers || {}) });
    res.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;

  return {
    origin,
    url: (path: string) => `${origin}${path.startsWith('/') ? path : `/${path}`}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

export function gzip(text: string): Buffer {
  return zlib.gzipSync(Buffer.from(text, 'utf8'));
}

/** The dronaarchery.com shell, byte-for-byte as Vercel serves it (803 bytes). */
export const SPA_SHELL_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AURA | Premium Archery Academy</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet">
    <script type="module" crossorigin src="/assets/index-DrDh8OKf.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-CUehCp4Q.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;
