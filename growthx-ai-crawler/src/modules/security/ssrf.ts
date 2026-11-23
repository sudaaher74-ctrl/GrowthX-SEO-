import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import axios, { AxiosRequestConfig } from 'axios';

/**
 * Keeps requests to customer-supplied URLs off internal addresses.
 *
 * All outbound HTTP(S) requests to customer-controlled URLs must enforce public
 * IP restrictions at connection time via `safeLookup` (never trusting a prior
 * DNS check followed by a separate uncontrolled connect), fail closed on DNS
 * resolution errors, reject redirects to internal/reserved hosts, and cap
 * response sizes and timeouts.
 */

export const SSRF_ERROR_CODE = 'ESSRF';

export class SsrfBlockedError extends Error {
  readonly code = SSRF_ERROR_CODE;
  constructor(target: string) {
    super(`Refusing to connect to an internal or reserved address: ${target}`);
    this.name = 'SsrfBlockedError';
  }
}

export class ResponseTooLargeError extends Error {
  readonly code = 'ERESPONSE_TOO_LARGE';
  constructor(maxBytes: number) {
    super(`Remote response exceeded maximum allowed size of ${maxBytes} bytes.`);
    this.name = 'ResponseTooLargeError';
  }
}

export class CrossOriginRedirectBlockedError extends Error {
  readonly code = 'ECROSS_ORIGIN_REDIRECT';
  constructor(fromOrigin: string, toOrigin: string) {
    super(`Refusing cross-origin redirect from ${fromOrigin} to ${toOrigin} on a credentialed or write request.`);
    this.name = 'CrossOriginRedirectBlockedError';
  }
}

export class HttpsDowngradeBlockedError extends Error {
  readonly code = 'EHTTPS_DOWNGRADE';
  constructor(message = 'Refusing HTTPS-to-HTTP downgrade on a credentialed request.') {
    super(message);
    this.name = 'HttpsDowngradeBlockedError';
  }
}

/** Tests and local fixtures crawl a loopback origin on purpose. */
export function privateTargetsAllowed(): boolean {
  return process.env.ALLOW_PRIVATE_CRAWL_TARGETS === 'true';
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT, also used inside cloud VPCs / Alibaba metadata
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, where cloud metadata services live (AWS/GCP/Azure)
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and 255.255.255.255
];

function isPrivateV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return PRIVATE_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

/** Expands an IPv6 address to its eight 16-bit groups. */
function ipv6Groups(ip: string): number[] {
  let address = ip.toLowerCase().split('%')[0];
  // An embedded dotted IPv4 tail (::ffff:10.0.0.1) becomes two groups.
  const v4Tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (v4Tail) {
    const n = ipv4ToInt(v4Tail[1]);
    address = address.slice(0, -v4Tail[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const fill = address.includes('::') ? 8 - left.length - right.length : 0;
  return [...left, ...Array(Math.max(0, fill)).fill('0'), ...right].map((g) => parseInt(g || '0', 16));
}

function isPrivateV6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (g.length !== 8) return true; // unparseable: refuse rather than guess
  const embeddedV4 = () => `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPrivateV4(embeddedV4()); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateV4(embeddedV4()); // NAT64
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true; // 100::/64 discard-only
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local (includes fd00:ec2::254)
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  return false;
}

/** Whether an IP address (v4 or v6) is internal, reserved or otherwise not the public internet. */
export function isPrivateAddress(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '');
  const family = net.isIP(bare);
  if (family === 4) return isPrivateV4(bare);
  if (family === 6) return isPrivateV6(bare);
  return false;
}

const INTERNAL_NAMES =
  /^(localhost|localhost\.localdomain|ip6-localhost|ip6-loopback|metadata\.google\.internal|metadata\.goog|metadata\.azure\.internal|instance-data)$|\.(localhost|local|internal|intranet|lan|home\.arpa)$/i;

/** Hosts an operator has explicitly allowed (an egress proxy, say). */
function allowedHosts(): Set<string> {
  const hosts = new Set(
    (process.env.SSRF_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const proxy of [process.env.HTTPS_PROXY, process.env.HTTP_PROXY, process.env.https_proxy, process.env.http_proxy]) {
    if (!proxy) continue;
    try {
      hosts.add(new URL(proxy).hostname.toLowerCase());
    } catch {
      /* not a URL; nothing to allow */
    }
  }
  return hosts;
}

/**
 * The check a hostname can be given without a lookup: a literal internal
 * address, or a name that only ever means this machine or its network.
 * Returns a reason when refused.
 */
export function blockedHostname(hostname: string): string | undefined {
  if (privateTargetsAllowed()) return undefined;
  const host = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host) return 'empty';
  if (allowedHosts().has(host)) return undefined;
  if (net.isIP(host)) return isPrivateAddress(host) ? host : undefined;
  if (INTERNAL_NAMES.test(host)) return host;
  return undefined;
}

/** Throws SsrfBlockedError for a URL whose host can be refused without a lookup. */
export function assertPublicUrl(target: string): void {
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return; // Not a URL: the request itself will fail with a clearer error.
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(parsed.protocol);
  }
  const blocked = blockedHostname(parsed.hostname);
  if (blocked) throw new SsrfBlockedError(blocked);
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/**
 * dns.lookup, refusing any name that resolves to an internal address or fails
 * to resolve. Every returned address is checked at connection time so DNS
 * rebinding cannot bypass a prior validation step.
 */
export function safeLookup(hostname: string, options: dns.LookupOptions | LookupCallback, callback?: LookupCallback): void {
  const cb = (typeof options === 'function' ? options : callback) as LookupCallback;
  const opts: dns.LookupOptions = typeof options === 'function' ? {} : options ?? {};

  const bareHost = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  const staticBlock = blockedHostname(bareHost);
  if (staticBlock) {
    return cb(new SsrfBlockedError(staticBlock) as any, [] as dns.LookupAddress[]);
  }

  dns.lookup(bareHost, { ...opts, all: true }, (err, addresses) => {
    if (err) return cb(err, [] as dns.LookupAddress[]);
    const list = (addresses as dns.LookupAddress[]) || [];
    if (list.length === 0) {
      return cb(Object.assign(new Error(`ENOTFOUND ${bareHost}`), { code: 'ENOTFOUND' }), [] as dns.LookupAddress[]);
    }
    if (!privateTargetsAllowed() && !allowedHosts().has(bareHost)) {
      const internal = list.find((a) => isPrivateAddress(a.address));
      if (internal) return cb(new SsrfBlockedError(`${bareHost} (${internal.address})`) as any, [] as dns.LookupAddress[]);
    }
    if (opts.all) return cb(null, list);
    const first = list[0];
    return cb(null, first.address, first.family);
  });
}

// KeepAlive disabled on SSRF-checked agents so a re-bound hostname never reuses a stale socket.
const httpAgent = new http.Agent({ lookup: safeLookup as any, keepAlive: false });
const httpsAgent = new https.Agent({ lookup: safeLookup as any, keepAlive: false, rejectUnauthorized: true });

/**
 * Axios options for any request to a URL a customer or a customer's site
 * chose. Spread into the request config: `axios.get(url, { ...publicOnly(), ... })`.
 */
export function publicOnly(): Pick<AxiosRequestConfig, 'httpAgent' | 'httpsAgent' | 'beforeRedirect'> {
  return {
    httpAgent,
    httpsAgent,
    beforeRedirect: (options: Record<string, any>) => {
      const blocked = blockedHostname(String(options.hostname ?? options.host ?? ''));
      if (blocked) throw new SsrfBlockedError(blocked);
    },
  };
}

export interface SafePublicFetchOptions {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | Buffer;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  requireHttps?: boolean;
  rejectCrossOriginRedirects?: boolean;
  allowedOrigin?: string;
}

export interface SafePublicResponse {
  ok: boolean;
  status: number;
  url: string;
  headers: Headers;
  bodyBuffer: Buffer;
  text(): Promise<string>;
  json<T = any>(): Promise<T>;
}

const SENSITIVE_REDIRECT_HEADERS = [
  'authorization',
  'x-shopify-access-token',
  'cookie',
  'proxy-authorization',
  'x-api-key',
];

function toHeaderRecord(input?: Record<string, string> | Headers): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  if (input instanceof Headers) {
    input.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

/**
 * Executes a single HTTP(S) hop with connection-time public IP enforcement via
 * `safeLookup`, TLS certificate verification (`rejectUnauthorized: true`),
 * hard timeout enforcement, and a hard streaming response-size cap.
 */
async function executePublicHttpHop(
  targetUrl: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string | Buffer;
    timeoutMs: number;
    maxBytes: number;
  },
): Promise<{ status: number; headers: Headers; bodyBuffer: Buffer }> {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(parsed.protocol);
  }
  if (parsed.username || parsed.password) {
    throw new SsrfBlockedError('embedded-credentials');
  }
  const blocked = blockedHostname(parsed.hostname);
  if (blocked) throw new SsrfBlockedError(blocked);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      parsed,
      {
        method: options.method,
        headers: options.headers,
        agent: parsed.protocol === 'https:' ? httpsAgent : httpAgent,
        lookup: safeLookup as any,
        ...(parsed.protocol === 'https:' ? { rejectUnauthorized: true } : {}),
      } as any,
      (res) => {
        const resHeaders = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (v === undefined) continue;
          if (Array.isArray(v)) {
            for (const item of v) resHeaders.append(k, item);
          } else {
            resHeaders.set(k, String(v));
          }
        }

        const declaredLength = Number(res.headers['content-length'] ?? 0);
        if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
          res.destroy();
          req.destroy();
          finish(() => reject(new ResponseTooLargeError(options.maxBytes)));
          return;
        }

        const chunks: Buffer[] = [];
        let received = 0;

        res.on('data', (chunk: Buffer | string) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          received += buf.length;
          if (received > options.maxBytes) {
            res.destroy();
            req.destroy();
            finish(() => reject(new ResponseTooLargeError(options.maxBytes)));
            return;
          }
          chunks.push(buf);
        });

        res.on('end', () => {
          const bodyBuffer = Buffer.concat(chunks);
          finish(() =>
            resolve({
              status: res.statusCode ?? 0,
              headers: resHeaders,
              bodyBuffer,
            }),
          );
        });

        res.on('error', (err) => {
          finish(() => reject(err));
        });
      },
    );

    const timer = setTimeout(() => {
      req.destroy(Object.assign(new Error(`Request timed out after ${options.timeoutMs}ms`), { code: 'ETIMEDOUT' }));
    }, options.timeoutMs);

    req.on('error', (err) => {
      finish(() => reject(err));
    });

    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

/** Exported transport seam for unit tests; production always executes real connection-time hops. */
export const ssrfTransport = {
  executeHop: executePublicHttpHop,
};

/**
 * Connection-time SSRF-hardened HTTP(S) client.
 * - Enforces public-only IP resolution at socket connect time on EVERY hop.
 * - Fails closed on DNS resolution errors.
 * - Rejects HTTPS->HTTP downgrades and cross-origin redirects on credentialed or write calls.
 * - Caps redirects, timeouts, and response body bytes.
 */
export async function safePublicFetch(
  targetUrl: string,
  options: SafePublicFetchOptions = {},
): Promise<SafePublicResponse> {
  const method = (options.method || 'GET').toUpperCase();
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxRedirects = options.maxRedirects ?? 3;
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;

  const baseHeaders = new Headers(toHeaderRecord(options.headers));
  const hasCredentials = SENSITIVE_REDIRECT_HEADERS.some((h) => baseHeaders.has(h));
  const requireHttps = options.requireHttps ?? hasCredentials;
  const rejectCrossOrigin =
    options.rejectCrossOriginRedirects ?? (hasCredentials || !['GET', 'HEAD'].includes(method));

  const validateUrl = (raw: string, allowedOrigin?: string): URL => {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new SsrfBlockedError('invalid-url');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new SsrfBlockedError(parsed.protocol);
    }
    if (requireHttps && parsed.protocol !== 'https:') {
      throw new HttpsDowngradeBlockedError('HTTPS is required for credentialed requests.');
    }
    if (parsed.username || parsed.password) {
      throw new SsrfBlockedError('embedded-credentials');
    }
    if (allowedOrigin && parsed.origin !== allowedOrigin) {
      throw new CrossOriginRedirectBlockedError(allowedOrigin, parsed.origin);
    }
    const blocked = blockedHostname(parsed.hostname);
    if (blocked) throw new SsrfBlockedError(blocked);
    return parsed;
  };

  let currentUrl = targetUrl;
  let currentMethod = method;
  let currentBody = options.body;
  const initialParsed = validateUrl(currentUrl, options.allowedOrigin);
  const initialOrigin = initialParsed.origin;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const currentParsed = hop === 0 ? initialParsed : validateUrl(currentUrl, options.allowedOrigin);
    const hopHeaders = new Headers(baseHeaders);
    if (currentParsed.origin !== initialOrigin) {
      if (rejectCrossOrigin) {
        throw new CrossOriginRedirectBlockedError(initialOrigin, currentParsed.origin);
      }
      for (const sensitive of SENSITIVE_REDIRECT_HEADERS) {
        hopHeaders.delete(sensitive);
      }
    }

    const res = await ssrfTransport.executeHop(currentUrl, {
      method: currentMethod,
      headers: toHeaderRecord(hopHeaders),
      body: currentBody,
      timeoutMs,
      maxBytes,
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        return {
          ok: res.status >= 200 && res.status < 300,
          status: res.status,
          url: currentUrl,
          headers: res.headers,
          bodyBuffer: res.bodyBuffer,
          text: async () => res.bodyBuffer.toString('utf8'),
          json: async <T = any>() => JSON.parse(res.bodyBuffer.toString('utf8')) as T,
        };
      }
      if (hop === maxRedirects) {
        throw new Error(`Too many redirects (max ${maxRedirects}) from target site.`);
      }
      const nextParsed = new URL(location, currentUrl);
      if (requireHttps && nextParsed.protocol !== 'https:') {
        throw new HttpsDowngradeBlockedError();
      }
      if (rejectCrossOrigin && nextParsed.origin !== initialOrigin) {
        throw new CrossOriginRedirectBlockedError(initialOrigin, nextParsed.origin);
      }
      validateUrl(nextParsed.toString(), options.allowedOrigin);
      if (res.status === 301 || res.status === 302 || res.status === 303) {
        currentMethod = 'GET';
        currentBody = undefined;
      }
      currentUrl = nextParsed.toString();
      continue;
    }

    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      url: currentUrl,
      headers: res.headers,
      bodyBuffer: res.bodyBuffer,
      text: async () => res.bodyBuffer.toString('utf8'),
      json: async <T = any>() => JSON.parse(res.bodyBuffer.toString('utf8')) as T,
    };
  }

  throw new Error(`Too many redirects (max ${maxRedirects}) from target site.`);
}

/**
 * Checks whether a browser request URL resolves strictly to public internet
 * addresses. Fails closed on DNS resolution errors and does not cache stale
 * DNS verdicts across requests.
 */
export async function browserMayLoad(target: string): Promise<boolean> {
  if (privateTargetsAllowed()) return true;
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  // Inline data:, blob:, and about: never leave the browser.
  if (url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'about:') return true;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (blockedHostname(url.hostname)) return false;
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (net.isIP(host) || allowedHosts().has(host)) return true;

  return new Promise<boolean>((resolve) => {
    dns.lookup(host, { all: true }, (err, addresses) => {
      // Fail closed on DNS resolution errors or empty answers.
      if (err || !addresses || addresses.length === 0) return resolve(false);
      resolve(!(addresses as dns.LookupAddress[]).some((a) => isPrivateAddress(a.address)));
    });
  });
}

/**
 * Playwright route handler that closes the DNS-to-connection gap for Chromium
 * rendering: intercepts all http(s) navigations, redirects, scripts, XHRs, and
 * stylesheets and fulfills them strictly via connection-time `safePublicFetch`,
 * preventing Chromium from performing unvalidated DNS lookups or connecting to
 * private/metadata addresses directly.
 */
export async function handleBrowserPublicRoute(
  route: {
    request(): {
      url(): string;
      method(): string;
      headers(): Record<string, string>;
      postDataBuffer?(): Buffer | null;
      resourceType(): string;
    };
    abort(errorCode?: string): Promise<void>;
    continue(): Promise<void>;
    fulfill(response: {
      status?: number;
      headers?: Record<string, string>;
      body?: Buffer | string;
    }): Promise<void>;
  },
  options: {
    targetHost?: string;
    blockMedia?: boolean;
    blockThirdPartyStylesheets?: boolean;
    timeoutMs?: number;
    maxBytes?: number;
  } = {},
): Promise<void> {
  const request = route.request();
  const reqUrl = request.url();
  const type = request.resourceType();

  if (options.blockMedia && (type === 'font' || type === 'image' || type === 'media')) {
    return route.abort();
  }

  let parsed: URL;
  try {
    parsed = new URL(reqUrl);
  } catch {
    return route.abort('blockedbyclient');
  }

  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:' || parsed.protocol === 'about:') {
    return route.continue();
  }

  // Block ws:, wss:, file:, ftp:, chrome:, etc.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return route.abort('blockedbyclient');
  }

  if (options.blockThirdPartyStylesheets && type === 'stylesheet' && options.targetHost) {
    if (parsed.host !== options.targetHost) {
      return route.abort();
    }
  }

  if (blockedHostname(parsed.hostname)) {
    return route.abort('blockedbyclient');
  }

  const forwardedHeaders: Record<string, string> = {};
  const rawHeaders = request.headers();
  for (const [k, v] of Object.entries(rawHeaders)) {
    const lower = k.toLowerCase();
    if (lower === 'host' || lower === 'connection' || lower === 'content-length' || lower === 'accept-encoding') {
      continue;
    }
    forwardedHeaders[k] = v;
  }
  forwardedHeaders['accept-encoding'] = 'identity';

  try {
    const res = await safePublicFetch(reqUrl, {
      method: request.method(),
      headers: forwardedHeaders,
      body: request.postDataBuffer?.() ?? undefined,
      timeoutMs: options.timeoutMs ?? 15_000,
      maxRedirects: 5,
      maxBytes: options.maxBytes ?? 5 * 1024 * 1024,
      requireHttps: false,
      rejectCrossOriginRedirects: false,
    });

    const fulfillHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'transfer-encoding' || lower === 'content-encoding' || lower === 'content-length' || lower === 'connection') {
        return;
      }
      fulfillHeaders[key] = value;
    });

    return route.fulfill({
      status: res.status,
      headers: fulfillHeaders,
      body: res.bodyBuffer,
    });
  } catch {
    return route.abort('blockedbyclient');
  }
}

/** Surfaces a refusal wrapped by follow-redirects under its own code. */
function unwrapSsrf(error: any): any {
  for (let cause = error?.cause, depth = 0; cause && depth < 5; cause = cause.cause, depth++) {
    if (cause instanceof SsrfBlockedError || cause.code === SSRF_ERROR_CODE) {
      error.code = SSRF_ERROR_CODE;
      error.message = cause.message;
      break;
    }
  }
  return error;
}

/**
 * axios for URLs a customer or a customer's site chose: the URL is checked
 * before anything is sent, then the request goes out on the checking agents
 * with the redirect check (see publicOnly).
 */
export const publicAxios = {
  async get<T = any>(url: string, config: AxiosRequestConfig = {}) {
    assertPublicUrl(url);
    try {
      return await axios.get<T>(url, {
        maxContentLength: 5 * 1024 * 1024,
        maxBodyLength: 5 * 1024 * 1024,
        ...config,
        ...publicOnly(),
      });
    } catch (error) {
      throw unwrapSsrf(error);
    }
  },
  async request<T = any>(config: AxiosRequestConfig) {
    assertPublicUrl(String(config.url ?? ''));
    try {
      return await axios.request<T>({
        maxContentLength: 5 * 1024 * 1024,
        maxBodyLength: 5 * 1024 * 1024,
        ...config,
        ...publicOnly(),
      });
    } catch (error) {
      throw unwrapSsrf(error);
    }
  },
};
