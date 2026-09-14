/**
 * Why a fetch did not produce a page.
 *
 * The crawler used to have no way to say this. A DNS failure, a TLS handshake
 * rejection, our own proxy refusing the request and the origin genuinely
 * answering 403 all arrived at the page row as a bare `statusCode`, so a fault
 * on our side was written down as a fact about the customer's site — and then
 * every content rule fired against the empty body it left behind.
 *
 * `upstreamStatus` is only ever set when an origin actually answered with one.
 * `ourStatus` is the number we would have to invent to express the failure, and
 * exists so nothing downstream has to invent it silently.
 */
export type FetchErrorKind = 'dns' | 'tls' | 'timeout' | 'proxy' | 'http' | 'ssrf' | 'unknown';

export class FetchError extends Error {
  constructor(
    readonly kind: FetchErrorKind,
    message: string,
    readonly upstreamStatus?: number,
    readonly ourStatus?: number,
  ) {
    super(message);
    this.name = 'FetchError';
  }

  /** A human-readable line the UI can show without translating anything. */
  get label(): string {
    switch (this.kind) {
      case 'dns':
        return 'Hostname could not be resolved';
      case 'tls':
        return 'TLS handshake failed';
      case 'timeout':
        return 'Request timed out';
      case 'proxy':
        return 'Our network could not reach the site';
      case 'ssrf':
        return 'Refused: internal or reserved address';
      case 'http':
        return `Origin answered HTTP ${this.upstreamStatus}`;
      default:
        return this.message;
    }
  }
}

/**
 * Classifies a thrown transport error into a kind.
 *
 * Deliberately conservative: anything unrecognised is `unknown`, never `http`.
 * `http` means an origin answered, and claiming that when we do not know is the
 * whole defect this type exists to prevent.
 */
export function classifyTransportError(err: unknown): FetchError {
  const e = err as { message?: string; cause?: { code?: string; message?: string }; code?: string; name?: string };
  const code = e?.cause?.code || e?.code || '';
  const message = e?.cause?.message || e?.message || String(err);
  const haystack = `${code} ${message}`.toUpperCase();

  if (e?.name === 'AbortError' || /TIMEOUT|ETIMEDOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|UND_ERR_CONNECT_TIMEOUT/.test(haystack)) {
    return new FetchError('timeout', message, undefined, 504);
  }
  if (/ENOTFOUND|EAI_AGAIN|DNS/.test(haystack)) {
    return new FetchError('dns', message, undefined, 523);
  }
  if (/CERT|TLS|SSL|ERR_TLS|EPROTO|HANDSHAKE|SELF_SIGNED/.test(haystack)) {
    return new FetchError('tls', message, undefined, 525);
  }
  if (/PROXY|ECONNREFUSED|ECONNRESET|EPIPE|EHOSTUNREACH|ENETUNREACH|SOCKET/.test(haystack)) {
    return new FetchError('proxy', message, undefined, 502);
  }
  return new FetchError('unknown', message, undefined, 520);
}
