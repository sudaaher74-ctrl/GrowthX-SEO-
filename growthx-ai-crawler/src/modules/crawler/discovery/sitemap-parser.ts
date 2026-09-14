import { XMLParser } from 'fast-xml-parser';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  /** Alternates declared via <xhtml:link rel="alternate" hreflang="...">. */
  alternates?: Array<{ hreflang: string; href: string }>;
}

export type ParsedSitemap =
  | { kind: 'index'; children: string[] }
  | { kind: 'urlset'; entries: SitemapEntry[] }
  | { kind: 'unknown' };

/**
 * `removeNSPrefix` is deliberately NOT used.
 *
 * It would turn `<xhtml:link>` into `<link>` and `<image:loc>` into `<loc>`,
 * which is exactly how an hreflang alternate becomes indistinguishable from the
 * page's own location. Prefixes are stripped per-field instead, where we know
 * what we are looking at.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['sitemap', 'url', 'link', 'image', 'video'].includes(name.replace(/^.*:/, '')),
});

/** Reads a field regardless of the namespace prefix the document happens to use. */
function field(node: Record<string, unknown>, name: string): unknown {
  if (node[name] !== undefined) return node[name];
  const key = Object.keys(node).find((k) => k.replace(/^.*:/, '') === name);
  return key ? node[key] : undefined;
}

function text(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object') {
    const inner = (value as Record<string, unknown>)['#text'];
    return inner === undefined ? undefined : String(inner).trim();
  }
  const s = String(value).trim();
  return s || undefined;
}

/**
 * Parses one sitemap document into either an index or a urlset.
 *
 * Returns `unknown` rather than throwing for anything that is not a sitemap —
 * an HTML error page served with a 200, most often — because a host that
 * answers every path with its homepage is common, and treating that homepage
 * as an empty sitemap would silently report "no URLs found" instead of "this
 * is not a sitemap".
 */
export function parseSitemapXml(xml: string): ParsedSitemap {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return { kind: 'unknown' };
  }
  if (!doc || typeof doc !== 'object') return { kind: 'unknown' };

  const indexNode = field(doc, 'sitemapindex') as Record<string, unknown> | undefined;
  if (indexNode) {
    const children = ((field(indexNode, 'sitemap') as Array<Record<string, unknown>>) || [])
      .map((child) => text(field(child, 'loc')))
      .filter((loc): loc is string => Boolean(loc));
    return { kind: 'index', children };
  }

  const urlsetNode = field(doc, 'urlset') as Record<string, unknown> | undefined;
  if (urlsetNode) {
    const entries: SitemapEntry[] = [];
    for (const node of (field(urlsetNode, 'url') as Array<Record<string, unknown>>) || []) {
      const loc = text(field(node, 'loc'));
      if (!loc) continue;

      const alternates: Array<{ hreflang: string; href: string }> = [];
      for (const link of (field(node, 'link') as Array<Record<string, unknown>>) || []) {
        const rel = String(link['@_rel'] ?? '');
        const hreflang = link['@_hreflang'];
        const href = link['@_href'];
        if (rel === 'alternate' && hreflang && href) {
          alternates.push({ hreflang: String(hreflang), href: String(href) });
        }
      }

      const priorityText = text(field(node, 'priority'));
      entries.push({
        loc,
        lastmod: text(field(node, 'lastmod')),
        changefreq: text(field(node, 'changefreq')),
        priority: priorityText ? Number(priorityText) : undefined,
        alternates: alternates.length ? alternates : undefined,
      });
    }
    return { kind: 'urlset', entries };
  }

  return { kind: 'unknown' };
}
