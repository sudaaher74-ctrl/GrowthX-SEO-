import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BrowserPoolService, DEFAULT_CHROME_UA } from './browser-pool.service';
import { FetchError, classifyTransportError } from './fetch-error';
import { EscalationReason, shouldEscalateToRender, spaFingerprints } from './render-escalation';
import { registrableDomain, sameRegistrableDomain } from '../url/registrable-domain';
import { deadlineSignal } from './http-deadline';

/** One hop of a redirect chain, recorded rather than collapsed. */
export interface RedirectHop {
  url: string;
  status: number;
  location?: string;
}

export interface FetchOptions {
  userAgent?: string;
  timeoutMs?: number;
  /** Render even when the static body looks complete. */
  forceRender?: boolean;
  /** False when the crawl's render budget is spent. */
  renderAllowed?: boolean;
  maxRedirects?: number;
}

export interface FetchOutcome {
  url: string;
  finalUrl: string;
  /** The status the ORIGIN answered with. Never a number we invented. */
  statusCode?: number;
  statusChain: RedirectHop[];
  headers: Record<string, string>;
  contentType?: string;
  contentLength?: number;
  rawHtml: string;
  renderedHtml?: string;
  /** The HTML the SEO signals must be read from: rendered when we have it. */
  html: string;
  jsRequired: boolean;
  escalationReasons: EscalationReason[];
  /** Raw-versus-rendered measurements, kept as JS_RENDER_REQUIRED's evidence. */
  renderDiff?: {
    rawWordCount: number;
    renderedWordCount: number;
    rawLinkCount: number;
    renderedLinkCount: number;
    rawTitle?: string;
    renderedTitle?: string;
    fingerprints: string[];
  };
  blockedSuspected: boolean;
  blockedEvidence?: string;
  ttfbMs?: number;
  totalMs: number;
  /** Set only when no origin response was obtained at all. */
  error?: FetchError;
  tier: 'static' | 'rendered' | 'failed';
  /** True when the render tier was wanted but the browser was unavailable. */
  renderUnavailable?: boolean;
}

/** Statuses a WAF hands a non-browser client that a browser would not see. */
const CHALLENGE_STATUSES = new Set([401, 403, 405, 406, 409, 418, 429, 503]);

/**
 * Header set a real Chrome sends. Many WAFs key on the absence of these rather
 * than on the User-Agent string alone, which is why sending only a UA is not
 * enough to stop being 403'd.
 *
 * Sent through axios rather than the runtime's `fetch` because undici treats
 * `Sec-Fetch-Mode` as a forbidden header and rewrites it to `cors` whatever the
 * caller asked for. A document request announcing `cors` is exactly the
 * mismatch a strict WAF looks for, so the one header we cannot set is the one
 * most worth setting.
 */
function browserHeaders(userAgent: string): Record<string, string> {
  return {
    'User-Agent': userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };
}

function countWords(text: string): number {
  return (text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
}

/**
 * Fetches a URL through two tiers, cheapest first.
 *
 * The contract that matters: `statusCode` is only ever a number an origin
 * actually sent. Anything that goes wrong on our side — DNS, TLS, a timeout,
 * our own proxy — arrives as a typed `FetchError` with a `kind`, and
 * `statusCode` stays undefined. The previous fetcher wrote 403 for a
 * malformed-URL exception and 500 for a transport failure, which is how a site
 * that answers 200 to every user agent came to be recorded as refusing us, and
 * how four content issues came to be raised against a body we never received.
 */
@Injectable()
export class FetchService {
  private readonly logger = new Logger(FetchService.name);

  /** Canonical host per registrable domain, learned from the first good fetch. */
  private readonly canonicalHosts = new Map<string, string>();

  constructor(private readonly browserPool: BrowserPoolService) {}

  get defaultUserAgent(): string {
    return process.env.CRAWLER_USER_AGENT || DEFAULT_CHROME_UA;
  }

  /** The host spelling this site actually serves, once we have seen one work. */
  canonicalHostFor(url: string): string | undefined {
    return this.canonicalHosts.get(registrableDomain(url));
  }

  async fetch(targetUrl: string, options: FetchOptions = {}): Promise<FetchOutcome> {
    const startedAt = Date.now();
    const userAgent = options.userAgent || this.defaultUserAgent;
    const timeoutMs = options.timeoutMs ?? Number(process.env.FETCH_TIMEOUT_MS || 20000);

    const guard = this.ssrfGuard(targetUrl);
    if (guard) {
      return this.failed(targetUrl, guard, startedAt);
    }

    // Tier 1 — static.
    let statik: StaticResponse;
    try {
      statik = await this.fetchStatic(targetUrl, browserHeaders(userAgent), timeoutMs, options.maxRedirects ?? 10);
    } catch (err) {
      return this.failed(targetUrl, err instanceof FetchError ? err : classifyTransportError(err), startedAt);
    }

    let blockedSuspected = false;
    let blockedEvidence: string | undefined;

    // A challenge status gets one retry with the full browser header set before
    // we believe it. Recorded as a suspicion with its evidence either way —
    // asserting a hard 403 is what produced a phantom one.
    if (CHALLENGE_STATUSES.has(statik.status)) {
      blockedSuspected = true;
      blockedEvidence =
        `HTTP ${statik.status} from ${statik.finalUrl} with a Chrome User-Agent and full browser headers. ` +
        `server=${statik.headers['server'] || 'unknown'}` +
        (statik.headers['cf-mitigated'] ? `, cf-mitigated=${statik.headers['cf-mitigated']}` : '') +
        (statik.headers['retry-after'] ? `, retry-after=${statik.headers['retry-after']}` : '');
      this.logger.warn(`[${targetUrl}] ${blockedEvidence}`);
    }

    if (this.canonicalHosts.get(registrableDomain(targetUrl)) === undefined && statik.status >= 200 && statik.status < 400) {
      try {
        this.canonicalHosts.set(registrableDomain(targetUrl), new URL(statik.finalUrl).host);
      } catch {
        /* a final URL we cannot parse teaches us nothing about the host */
      }
    }

    const verdict = shouldEscalateToRender(statik.body, { force: options.forceRender });
    const renderAllowed = options.renderAllowed !== false;

    const base: FetchOutcome = {
      url: targetUrl,
      finalUrl: statik.finalUrl,
      statusCode: statik.status,
      statusChain: statik.hops,
      headers: statik.headers,
      contentType: statik.headers['content-type'],
      contentLength: statik.body.length,
      rawHtml: statik.body,
      html: statik.body,
      jsRequired: false,
      escalationReasons: verdict.reasons,
      blockedSuspected,
      blockedEvidence,
      ttfbMs: statik.ttfbMs,
      totalMs: Date.now() - startedAt,
      tier: 'static',
    };

    // A page the origin refused has no content worth rendering, so the render
    // budget is not spent on it. The one exception is a challenge status: that
    // is exactly the case where a browser may be served what a plain client
    // was not.
    const worthRendering = (statik.status >= 200 && statik.status < 300) || blockedSuspected;
    const wantsRender = worthRendering && (verdict.escalate || blockedSuspected);
    if (!wantsRender || !renderAllowed) {
      if (wantsRender && !renderAllowed) {
        this.logger.debug(`[${targetUrl}] needs rendering but the crawl's render budget is spent.`);
        return { ...base, renderUnavailable: true };
      }
      return base;
    }

    // Tier 2 — rendered.
    const rendered = await this.fetchRendered(targetUrl, userAgent, timeoutMs);
    if (!rendered) {
      return {
        ...base,
        renderUnavailable: true,
        totalMs: Date.now() - startedAt,
      };
    }

    const rawWordCount = countWords(stripTags(statik.body));
    const renderedWordCount = countWords(rendered.text);
    const rawLinkCount = verdict.rawAnchorCount;

    // A render that reached an origin status supersedes the static one: this is
    // the header-escalation path, where a WAF answers a plain client and serves
    // a browser.
    const originStatus = rendered.status ?? statik.status;
    const stillBlocked = CHALLENGE_STATUSES.has(originStatus);

    return {
      ...base,
      finalUrl: rendered.finalUrl || statik.finalUrl,
      statusCode: originStatus,
      renderedHtml: rendered.html,
      html: rendered.html,
      contentLength: rendered.html.length,
      // Rendering is what the page needed; whether it *changed* anything is the
      // question the diff answers, and only a real gain counts as jsRequired.
      jsRequired: renderedWordCount > rawWordCount || rendered.linkCount > rawLinkCount || (rendered.title || '') !== (verdict.rawTitle || ''),
      blockedSuspected: blockedSuspected && stillBlocked,
      blockedEvidence: blockedSuspected && stillBlocked ? blockedEvidence : undefined,
      renderDiff: {
        rawWordCount,
        renderedWordCount,
        rawLinkCount,
        renderedLinkCount: rendered.linkCount,
        rawTitle: verdict.rawTitle,
        renderedTitle: rendered.title,
        fingerprints: spaFingerprints(statik.body),
      },
      totalMs: Date.now() - startedAt,
      tier: 'rendered',
    };
  }


  /**
   * Recognises a gateway error our own network produced, so it is never written
   * down as the site's status.
   *
   * 407 is unambiguous — only a proxy sends it. The 502/504 arm is a heuristic
   * and is deliberately narrow: it fires only when a proxy is configured for
   * this process AND the response carries none of the headers an origin
   * gateway would attach. An nginx or Cloudflare 502 identifies itself in
   * `server`; a proxy failing to reach a host that does not resolve typically
   * does not. A miss here costs us a page recorded as `proxy` rather than
   * `http`, which is the safer direction: the previous fetcher had no way to
   * express the distinction at all and recorded every one of these against the
   * customer's site.
   */
  private proxyInjectedError(status: number, headers: Record<string, string>): FetchError | undefined {
    if (status === 407) {
      return new FetchError('proxy', 'Our forward proxy refused the request (HTTP 407).', undefined, 502);
    }
    const proxyConfigured = Boolean(process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy);
    if (!proxyConfigured) return undefined;
    if (status !== 502 && status !== 504) return undefined;
    if (headers['server'] || headers['x-served-by'] || headers['cf-ray'] || headers['x-amz-cf-id'] || headers['via']) return undefined;
    return new FetchError(
      'proxy',
      `HTTP ${status} with no origin gateway headers while a forward proxy is configured; treating it as our network, not the site's.`,
      undefined,
      status,
    );
  }

  /** Refuses internal and reserved addresses. Its own outcome, not a 403. */
  private ssrfGuard(targetUrl: string): FetchError | undefined {
    let host: string;
    try {
      host = new URL(targetUrl).hostname.toLowerCase();
    } catch {
      // Deliberately NOT an http kind: a URL we cannot parse is our problem,
      // and calling it a 403 is precisely the bug this rebuild removes.
      return new FetchError('unknown', `Malformed URL: ${targetUrl}`);
    }
    const isPrivate =
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === '::1';
    // Tests and local fixtures need a loopback origin to crawl at all.
    if (isPrivate && process.env.ALLOW_PRIVATE_CRAWL_TARGETS !== 'true') {
      return new FetchError('ssrf', `Refusing to crawl internal or reserved address: ${host}`);
    }
    return undefined;
  }

  private async fetchStatic(
    targetUrl: string,
    headers: Record<string, string>,
    timeoutMs: number,
    maxRedirects: number,
  ): Promise<StaticResponse> {
    const hops: RedirectHop[] = [];
    const seen = new Set<string>();
    let current = targetUrl;
    let ttfbMs: number | undefined;

    for (let i = 0; i <= maxRedirects; i++) {
      if (seen.has(current)) {
        throw new FetchError('http', `Redirect loop at ${current}`, 508);
      }
      seen.add(current);

      const hopStart = Date.now();
      let response: { status: number; headers: Record<string, unknown>; data: unknown };
      try {
        response = await axios.get(current, {
          headers,
          timeout: timeoutMs,
          // A hard cap as well as axios's idle timeout: see deadlineSignal.
          signal: deadlineSignal(timeoutMs),
          // Every hop is walked by hand. The chain itself is a finding: an
          // apex-to-www-to-https chain is three hops of normal housekeeping and
          // a loop is a defect, and a client that collapses both to a final URL
          // cannot tell them apart.
          maxRedirects: 0,
          validateStatus: () => true,
          responseType: 'text',
          transitional: { silentJSONParsing: false, forcedJSONParsing: false, clarifyTimeoutError: true },
          maxContentLength: Number(process.env.MAX_PAGE_BYTES || 10 * 1024 * 1024),
        });
      } catch (err) {
        throw classifyTransportError(err);
      }
      if (ttfbMs === undefined) ttfbMs = Date.now() - hopStart;

      const responseHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers || {})) {
        responseHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
      }

      const proxyFault = this.proxyInjectedError(response.status, responseHeaders);
      if (proxyFault) throw proxyFault;

      const location = responseHeaders['location'];
      hops.push({ url: current, status: response.status, location });

      if (response.status >= 300 && response.status < 400 && location) {
        let next: string;
        try {
          next = new URL(location, current).toString();
        } catch {
          throw new FetchError('http', `Unparseable Location header "${location}" at ${current}`, response.status);
        }
        // Off-site redirects are followed too; where they land is the finding,
        // and refusing to look would hide it.
        if (!sameRegistrableDomain(next, current)) {
          this.logger.debug(`[${targetUrl}] redirects off ${registrableDomain(current)} to ${registrableDomain(next)}`);
        }
        current = next;
        continue;
      }

      return {
        status: response.status,
        finalUrl: current,
        headers: responseHeaders,
        body: typeof response.data === 'string' ? response.data : '',
        hops,
        ttfbMs,
      };
    }

    throw new FetchError('http', `More than ${maxRedirects} redirects starting at ${targetUrl}`, 310);
  }

  private async fetchRendered(targetUrl: string, userAgent: string, timeoutMs: number): Promise<RenderedResponse | undefined> {
    const settleMs = Number(process.env.RENDER_SETTLE_MS || 3000);

    return this.browserPool.withPage(userAgent, async (page) => {
      // Subresources that cannot change a single SEO signal are not fetched.
      // Fonts, images and media are read from the DOM, never from their bytes,
      // and a third-party stylesheet changes nothing we extract. Blocking them
      // is ordinary crawler practice - it is faster and it spends nobody
      // else's bandwidth - and it also removes a real failure mode: a webfont
      // host that hangs is render-blocking, so the page never reaches
      // domcontentloaded, the navigation times out, and we capture the empty
      // shell and report it as a page with no title and no words.
      //
      // Scripts and same-origin stylesheets are always allowed: a site whose
      // application bundle is served from a CDN must still be able to render.
      await page.route('**/*', (route) => {
        const request = route.request();
        const type = request.resourceType();
        if (type === 'font' || type === 'image' || type === 'media') return route.abort();
        if (type === 'stylesheet') {
          try {
            if (new URL(request.url()).host !== new URL(targetUrl).host) return route.abort();
          } catch {
            return route.abort();
          }
        }
        return route.continue();
      }).catch(() => {});

      let documentStatus: number | undefined;

      // Only the main frame's own document response tells us the page's status.
      // Matching on "any response whose URL equals page.url()" is what let an
      // asset's status overwrite the document's on a client-routed SPA.
      page.on('response', (res) => {
        if (res.request().resourceType() === 'document' && res.request().isNavigationRequest() && res.frame() === page.mainFrame()) {
          documentStatus = res.status();
        }
      });

      let navigationStatus: number | undefined;
      try {
        // domcontentloaded first, then network idle as a separate wait.
        // Handing the whole budget to a single `waitUntil: 'networkidle'` means
        // one slow third-party asset - a font, an analytics beacon - consumes
        // the time the page needed to hydrate, and we then read a DOM that is
        // still the empty shell. Splitting them bounds each phase on its own.
        const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        navigationStatus = response?.status();
      } catch (err) {
        this.logger.debug(`[${targetUrl}] render navigation did not settle cleanly: ${(err as Error).message}`);
      }

      await page.waitForLoadState('networkidle', { timeout: settleMs * 2 }).catch(() => {});

      // Then the explicit settle: the first anchor, or the framework's mount
      // node acquiring children, whichever lands first. `networkidle` is not a
      // settle on its own - a framework can be idle on the wire and still be a
      // tick away from mounting.
      await Promise.race([
        page.waitForSelector('a[href]', { timeout: settleMs, state: 'attached' }).catch(() => undefined),
        page
          .waitForFunction(
            () => {
              const mount = document.querySelector('#root, #app, #__next, [data-reactroot]');
              return !mount || mount.children.length > 0;
            },
            undefined,
            { timeout: settleMs, polling: 100 },
          )
          .catch(() => undefined),
      ]);

      // One retry when the DOM is still the shell we started with. A framework
      // that has not mounted within the settle is usually contending for CPU -
      // several renders in flight, a large bundle - rather than genuinely
      // inert, and reading the shell here is exactly the wrong answer: it is
      // recorded as a page with no title and no words, which is then reported
      // as four separate content defects.
      const stillAShell = await page
        .evaluate(() => {
          const mount = document.querySelector('#root, #app, #__next, [data-reactroot]');
          return document.querySelectorAll('a[href]').length === 0 && Boolean(mount) && mount!.children.length === 0;
        })
        .catch(() => false);

      if (stillAShell) {
        this.logger.debug(`[${targetUrl}] still an empty shell after the first settle; waiting once more.`);
        await page
          .waitForFunction(
            () => {
              const mount = document.querySelector('#root, #app, #__next, [data-reactroot]');
              return document.querySelectorAll('a[href]').length > 0 || (mount ? mount.children.length > 0 : true);
            },
            undefined,
            { timeout: settleMs * 2, polling: 100 },
          )
          .catch(() => undefined);
      }

      // The settles above fire on the *first* sign of life — one anchor, or the
      // mount node gaining any child — and a framework reaches that state while
      // still building. Usually that is fine: measured against a live SPA,
      // three of four pages read identically either way. The exception is the
      // one that matters, because a page caught mid-build is recorded with
      // fewer words than it has, and an undercount is what turns a real page
      // into a THIN_CONTENT finding.
      //
      // So wait for the rendered text to stop changing: it grows as components
      // mount and data resolves, then goes flat. Two identical samples end it.
      //
      // Empty never counts as settled, which is the part that took a
      // measurement to learn. A page whose text is briefly empty — a route
      // transition, a loading state swapped for content — is "unchanged at
      // zero" for as long as it takes, and accepting that reads a blank page
      // as a finished one. Waiting through it turned a homepage that captured
      // 112 words into one that captured none. The cap bounds a page that
      // never settles at all.
      await page
        .waitForFunction(
          (quietPolls: number) => {
            const w = window as any;
            const length = (document.body?.innerText || '').length;
            if (length === 0) {
              w.__gxStable = 0;
              w.__gxLast = -1;
              return false;
            }
            if (w.__gxLast === length) w.__gxStable = (w.__gxStable || 0) + 1;
            else {
              w.__gxLast = length;
              w.__gxStable = 0;
            }
            return w.__gxStable >= quietPolls;
          },
          2,
          // A ceiling, not a wait. The check returns as soon as the text has
          // held steady for two polls, so a page that renders quickly costs
          // ~300ms of this budget and a slow one is allowed to finish rather
          // than being read half-built. Tying it to `settleMs` capped heavy
          // pages at six seconds, which is under what a large SPA on a slow
          // connection needs, and the cost of expiring early is a page
          // recorded with a fraction of its words.
          { timeout: Number(process.env.RENDER_STABLE_TIMEOUT_MS || 12_000), polling: 150 },
        )
        .catch(() => undefined);

      const html = await page.content().catch(() => '');
      const measured = await page
        .evaluate(() => ({
          text: document.body ? document.body.innerText : '',
          linkCount: document.querySelectorAll('a[href]').length,
          title: document.title,
        }))
        .catch(() => ({ text: '', linkCount: 0, title: '' }));

      return {
        html,
        finalUrl: page.url(),
        status: documentStatus ?? navigationStatus,
        text: measured.text,
        linkCount: measured.linkCount,
        title: measured.title,
      };
    });
  }

  private failed(targetUrl: string, error: FetchError, startedAt: number): FetchOutcome {
    return {
      url: targetUrl,
      finalUrl: targetUrl,
      statusCode: undefined,
      statusChain: [],
      headers: {},
      rawHtml: '',
      html: '',
      jsRequired: false,
      escalationReasons: [],
      blockedSuspected: false,
      totalMs: Date.now() - startedAt,
      error,
      tier: 'failed',
    };
  }
}

interface StaticResponse {
  status: number;
  finalUrl: string;
  headers: Record<string, string>;
  body: string;
  hops: RedirectHop[];
  ttfbMs?: number;
}

interface RenderedResponse {
  html: string;
  finalUrl: string;
  status?: number;
  text: string;
  linkCount: number;
  title: string;
}

function stripTags(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}
