/**
 * Multi-label public suffixes we must not mistake for a registrable domain.
 *
 * A full Public Suffix List would be more correct, and this deliberately is not
 * one: the list is a dependency that needs updating, and the only question the
 * crawler asks is "is this sitemap URL on the same site we were asked to
 * crawl". Getting `co.uk` and `com.au` right answers that for effectively every
 * site we crawl; a miss degrades to treating a sibling as foreign, which is a
 * visible finding rather than a silent wrong answer.
 */
const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz', 'ac.nz',
  'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in', 'ac.in', 'edu.in', 'gov.in', 'res.in',
  'co.za', 'org.za', 'net.za', 'web.za', 'gov.za',
  'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br',
  'com.sg', 'net.sg', 'org.sg', 'edu.sg', 'gov.sg',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'com.mx', 'com.ar', 'com.tr', 'com.tw', 'com.hk', 'com.my', 'com.ph', 'com.pk',
  'co.id', 'co.kr', 'co.il', 'co.th', 'com.vn', 'com.sa', 'com.eg', 'com.ng',
  'co.ke', 'com.gh', 'com.bd', 'com.pe', 'com.co', 'com.ec', 'com.uy', 'com.ua',
]);

/**
 * The registrable domain of a hostname — the part a person buys.
 *
 * `www.dronaarchery.com` and `dronaarchery.com` both give `dronaarchery.com`,
 * which is what makes an apex-to-www redirect a normal hop rather than an
 * off-site one, and what makes `deonaarcheryacademy.com` in the sitemap a
 * finding rather than a sibling.
 */
export function registrableDomain(hostnameOrUrl: string): string {
  let host = (hostnameOrUrl || '').trim().toLowerCase();
  if (!host) return '';

  if (host.includes('://') || host.startsWith('//')) {
    try {
      host = new URL(host.startsWith('//') ? `https:${host}` : host).hostname.toLowerCase();
    } catch {
      return '';
    }
  }
  host = host.replace(/\.$/, '').replace(/:\d+$/, '');
  if (!host || host === 'localhost') return host;

  // An IP literal has no registrable domain; it is its own identity.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return host;

  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');

  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}

/** True when both URLs sit under the same registrable domain. */
export function sameRegistrableDomain(a: string, b: string): boolean {
  const da = registrableDomain(a);
  const db = registrableDomain(b);
  return Boolean(da) && da === db;
}
