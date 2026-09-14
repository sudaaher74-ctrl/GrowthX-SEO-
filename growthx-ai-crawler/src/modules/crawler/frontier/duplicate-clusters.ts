import * as crypto from 'crypto';

export interface DuplicateCluster {
  contentHash: string;
  urls: string[];
}

/**
 * A content fingerprint that ignores the things that differ between two copies
 * of the same page: whitespace, case, and the URL it was served at.
 */
export function contentFingerprint(text: string): string {
  const normalized = (text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('sha1').update(normalized).digest('hex');
}

/**
 * Groups URLs that served identical content.
 *
 * Kept separate from the per-page thin-content rule on purpose. Two URLs with
 * the same 150 words are one duplicate-content problem, and reporting them as
 * two independent thin-content pages both overstates the issue count and
 * describes the wrong defect: the fix is a canonical, not more copy.
 */
export function findDuplicateClusters(pages: Array<{ url: string; contentHash?: string | null }>): DuplicateCluster[] {
  const byHash = new Map<string, string[]>();
  for (const page of pages) {
    if (!page.contentHash) continue;
    const urls = byHash.get(page.contentHash) || [];
    urls.push(page.url);
    byHash.set(page.contentHash, urls);
  }
  return [...byHash.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([contentHash, urls]) => ({ contentHash, urls: [...urls].sort() }));
}

/** URLs that belong to a cluster of more than one, for issue suppression. */
export function urlsInDuplicateClusters(clusters: DuplicateCluster[]): Set<string> {
  const urls = new Set<string>();
  for (const cluster of clusters) for (const url of cluster.urls) urls.add(url);
  return urls;
}
