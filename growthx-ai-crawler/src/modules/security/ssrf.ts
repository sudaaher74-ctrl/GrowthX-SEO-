import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import axios, { AxiosRequestConfig } from 'axios';

/**
 * Keeps requests to customer-supplied URLs off internal addresses.
 *
 * The crawler fetches whatever a customer (or a customer's site) points it
 * at. Checked only by the text of the first URL's hostname, three things got
 * past: a redirect (the first hop was checked, the rest were followed
 * blindly, so any site could send the crawler to http://169.254.169.254/, the
 * cloud metadata service), a public name that resolves to a private address,
 * and every fetcher other than the crawl's own, which had no check at all.
 *
 * So the check runs where the connection is made. The agents below resolve
 * the name themselves and refuse to connect when any address it resolves to
 * is internal, which also covers redirects and a name that changes answer
 * between two lookups. A URL written with a literal IP never reaches a lookup,
 * so those are checked before the request and before each redirect.
 */

export const SSRF_ERROR_CODE = 'ESSRF';

export class SsrfBlockedError extends Error {
  readonly code = SSRF_ERROR_CODE;
  constructor(target: string) {
    super(`Refusing to connect to an internal or reserved address: ${target}`);
    this.name = 'SsrfBlockedError';
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
  ['100.64.0.0', 10], // carrier-grade NAT, also used inside cloud VPCs
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, where cloud metadata services live
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
  return [...left, ...Array(fill).fill('0'), ...right].map((g) => parseInt(g || '0', 16));
}

function isPrivateV6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (g.length !== 8) return true; // unparseable: refuse rather than guess
  const embeddedV4 = () => `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPrivateV4(embeddedV4()); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateV4(embeddedV4()); // NAT64
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
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

const INTERNAL_NAMES = /^(localhost|localhost\.localdomain|ip6-localhost|ip6-loopback)$|\.(localhost|local|internal|intranet|lan|home\.arpa)$/i;

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
  if (allowedHosts().has(host)) return undefined;
  if (net.isIP(host)) return isPrivateAddress(host) ? host : undefined;
  if (INTERNAL_NAMES.test(host)) return host;
  return undefined;
}

/** Throws SsrfBlockedError for a URL whose host can be refused without a lookup. */
export function assertPublicUrl(target: string): void {
  let hostname: string;
  try {
    hostname = new URL(target).hostname;
  } catch {
    return; // Not a URL: the request itself will fail with a clearer error.
  }
  const blocked = blockedHostname(hostname);
  if (blocked) throw new SsrfBlockedError(blocked);
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/**
 * dns.lookup, refusing any name that resolves to an internal address. Every
 * address is checked, not only the first: a name answering with one public
 * and one private address could otherwise be connected to on the second.
 */
export function safeLookup(hostname: string, options: dns.LookupOptions | LookupCallback, callback?: LookupCallback): void {
  const cb = (typeof options === 'function' ? options : callback) as LookupCallback;
  const opts: dns.LookupOptions = typeof options === 'function' ? {} : options ?? {};

  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return cb(err, [] as dns.LookupAddress[]);
    const list = addresses as dns.LookupAddress[];
    if (!privateTargetsAllowed() && !allowedHosts().has(hostname.toLowerCase())) {
      const internal = list.find((a) => isPrivateAddress(a.address));
      if (internal) return cb(new SsrfBlockedError(`${hostname} (${internal.address})`), [] as dns.LookupAddress[]);
    }
    if (opts.all) return cb(null, list);
    const first = list[0];
    return first ? cb(null, first.address, first.family) : cb(Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' }), '');
  });
}

const httpAgent = new http.Agent({ lookup: safeLookup as any });
const httpsAgent = new https.Agent({ lookup: safeLookup as any });

/**
 * Axios options for any request to a URL a customer or a customer's site
 * chose. Spread into the request config: `axios.get(url, { ...publicOnly(), ... })`.
 *
 * The URL itself is not checked here (the config has no URL); call
 * assertPublicUrl first, or use publicGet.
 */
export function publicOnly(): Pick<AxiosRequestConfig, 'httpAgent' | 'httpsAgent' | 'beforeRedirect'> {
  return {
    httpAgent,
    httpsAgent,
    // Redirects followed by axios: a literal-IP target skips the lookup, so it
    // is checked here. A named target is checked by the agent as it connects.
    beforeRedirect: (options: Record<string, any>) => {
      const blocked = blockedHostname(String(options.hostname ?? options.host ?? ''));
      if (blocked) throw new SsrfBlockedError(blocked);
    },
  };
}

/**
 * For the headless browser, which does its own DNS: whether a request URL may
 * be loaded. Resolves the name, so it is async; results are cached briefly
 * because a page issues many requests to the same few hosts.
 */
const browserVerdicts = new Map<string, { allowed: boolean; at: number }>();
const BROWSER_VERDICT_TTL_MS = 60_000;

export async function browserMayLoad(target: string): Promise<boolean> {
  if (privateTargetsAllowed()) return true;
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  // data:, blob: and about: never leave the browser.
  if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'ws:' && url.protocol !== 'wss:') return true;
  if (blockedHostname(url.hostname)) return false;
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (net.isIP(host) || allowedHosts().has(host)) return true;

  const cached = browserVerdicts.get(host);
  if (cached && Date.now() - cached.at < BROWSER_VERDICT_TTL_MS) return cached.allowed;
  const allowed = await new Promise<boolean>((resolve) => {
    dns.lookup(host, { all: true }, (err, addresses) => {
      // A name that does not resolve cannot be loaded anyway; let the browser say so.
      if (err) return resolve(true);
      resolve(!(addresses as dns.LookupAddress[]).some((a) => isPrivateAddress(a.address)));
    });
  });
  browserVerdicts.set(host, { allowed, at: Date.now() });
  return allowed;
}

/** Surfaces a refusal wrapped by follow-redirects under its own code. */
function unwrapSsrf(error: any): any {
  // Walked, not read one level down: axios wraps follow-redirects' error,
  // which in turn wraps ours, when a redirect is what was refused.
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
 * with the redirect check (see publicOnly). A refusal rejects like any other
 * network error, with code ESSRF, so existing error handling applies.
 *
 * A thin wrapper over the module's own axios.get/request rather than an
 * axios.create() instance, so code and tests that mock axios keep working.
 */
export const publicAxios = {
  async get<T = any>(url: string, config: AxiosRequestConfig = {}) {
    assertPublicUrl(url);
    try {
      return await axios.get<T>(url, { ...config, ...publicOnly() });
    } catch (error) {
      throw unwrapSsrf(error);
    }
  },
  async request<T = any>(config: AxiosRequestConfig) {
    assertPublicUrl(String(config.url ?? ''));
    try {
      return await axios.request<T>({ ...config, ...publicOnly() });
    } catch (error) {
      throw unwrapSsrf(error);
    }
  },
};
