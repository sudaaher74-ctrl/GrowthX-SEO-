import { sameRegistrableDomain } from '../url/registrable-domain';

/**
 * Third-party analytics, ad-tech, session-replay, and live-chat widget hosts
 * that never produce indexable SEO content. Aborting them inside Playwright
 * cuts Chromium CPU/JS-heap usage and eliminates slow networkidle stalls.
 *
 * First-party hosts (same registrable domain as the crawled site) and standard
 * application JS CDNs (jsdelivr, unpkg, cloudflare, cloudfront, etc.) are
 * NEVER blocked here.
 */
const TRACKER_HOST_SUFFIXES: readonly string[] = [
  // Analytics & Tag Managers
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'stats.g.doubleclick.net',
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'clarity.ms',
  'hotjar.com',
  'hotjar.io',
  'fullstory.com',
  'mouseflow.com',
  'crazyegg.com',
  'logrocket.io',
  'lr-ingest.io',
  'segment.com',
  'segment.io',
  'mixpanel.com',
  'mxpnl.com',
  'amplitude.com',
  'heapanalytics.com',
  'newrelic.com',
  'nr-data.net',
  'browser-intake-datadoghq.com',
  'sentry.io',
  // Social & Ad Pixels
  'connect.facebook.net',
  'analytics.tiktok.com',
  'snap.licdn.com',
  'px.ads.linkedin.com',
  'static.ads-twitter.com',
  'analytics.twitter.com',
  'ct.pinterest.com',
  'sc-static.net',
  'bat.bing.com',
  'adsrvr.org',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  // Live Chat & Marketing Popups
  'widget.intercom.io',
  'js.intercomcdn.com',
  'api-iam.intercom.io',
  'js.hs-scripts.com',
  'js.hs-analytics.net',
  'js.hs-banner.com',
  'js.hscollectedforms.net',
  'embed.tawk.to',
  'va.tawk.to',
  'client.crisp.chat',
  'static.zdassets.com',
  'ekr.zdassets.com',
  'wchat.freshchat.com',
  'js.driftt.com',
  'static.klaviyo.com',
  'a.klaviyo.com',
  'a.omappapi.com',
];

function hostMatchesSuffix(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/**
 * Returns true if `rawUrl` points to a known third-party tracker/chat/ad host
 * that is NOT on the crawled site's own registrable domain.
 */
export function isThirdPartyTrackerUrl(rawUrl: string, targetHost?: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) return false;

  // Never block first-party assets even if the user is auditing a tracker site itself.
  if (targetHost) {
    const cleanTarget = targetHost.replace(/:\d+$/, '').toLowerCase();
    if (host === cleanTarget || sameRegistrableDomain(`https://${host}`, `https://${cleanTarget}`)) {
      return false;
    }
  }

  return TRACKER_HOST_SUFFIXES.some((suffix) => hostMatchesSuffix(host, suffix));
}
