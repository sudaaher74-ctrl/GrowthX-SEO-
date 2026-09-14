/** One user-agent group from robots.txt, with its rules in file order. */
export interface RobotsGroup {
  agents: string[];
  rules: Array<{ type: 'allow' | 'disallow'; path: string }>;
  crawlDelayMs?: number;
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
  raw: string;
}

export interface RobotsDecision {
  allowed: boolean;
  /** The literal rule line that decided it, or why no rule applied. */
  evidence: string;
}

/**
 * Parses robots.txt into user-agent groups.
 *
 * Grouping is the part the previous parser got wrong. It flattened every
 * directive into two global lists and decided group membership with
 * `targetUserAgent.includes(agent)` — so a `User-agent: *` line matched any
 * token containing "*"… and, worse, a token like `Bot` matched `GrowthXBot`,
 * silently applying another crawler's rules to us. Consecutive `User-agent`
 * lines share one group, per the specification, and a blank line or a rule
 * closes the header.
 */
export function parseRobotsTxt(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];

  let current: RobotsGroup | undefined;
  let collectingAgents = false;

  for (const rawLine of (text || '').split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) {
      collectingAgents = false;
      continue;
    }

    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (directive === 'sitemap') {
      // Sitemap is a top-level directive and belongs to no group.
      if (value && !sitemaps.includes(value)) sitemaps.push(value);
      continue;
    }

    if (directive === 'user-agent') {
      if (!collectingAgents || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
        collectingAgents = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    collectingAgents = false;
    if (!current) {
      // Rules before any User-agent line are malformed; treat them as global
      // rather than discarding a site's evident intent.
      current = { agents: ['*'], rules: [] };
      groups.push(current);
    }

    if (directive === 'disallow') {
      current.rules.push({ type: 'disallow', path: value });
    } else if (directive === 'allow') {
      if (value) current.rules.push({ type: 'allow', path: value });
    } else if (directive === 'crawl-delay') {
      const seconds = parseFloat(value);
      if (!Number.isNaN(seconds) && seconds > 0) current.crawlDelayMs = Math.round(seconds * 1000);
    }
  }

  return { groups, sitemaps, raw: text || '' };
}

/**
 * The group that applies to a token.
 *
 * An exact token match wins over `*`, and only an exact match counts — the
 * specification says the most specific matching group applies and nothing else
 * in the file does. A site that disallows everything for `*` and allows our
 * token must be read that way round, and the reverse too.
 */
export function selectGroup(parsed: ParsedRobots, token: string): RobotsGroup | undefined {
  const wanted = token.toLowerCase();
  const exact = parsed.groups.find((g) => g.agents.includes(wanted));
  if (exact) return exact;
  return parsed.groups.find((g) => g.agents.includes('*'));
}

/** Compiles a robots path pattern, honouring `*` and a terminating `$`. */
function ruleMatches(path: string, pattern: string): boolean {
  if (pattern === '') return false;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = `^${body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}${anchored ? '$' : ''}`;
  try {
    return new RegExp(source).test(path);
  } catch {
    return path.startsWith(body);
  }
}

/**
 * Whether robots.txt permits a URL for a token.
 *
 * Longest match wins, and `Allow` wins a tie — Google's documented precedence.
 * The previous implementation compared rule *string lengths* only when a
 * disallow had already matched, and returned on the first disallow it found
 * regardless of whether a longer one existed, so precedence depended on the
 * order rules happened to appear in the file.
 *
 * A bare `Disallow:` with no value is an explicit allow-all and is skipped.
 */
export function isAllowedByRobots(parsed: ParsedRobots, token: string, targetUrl: string): RobotsDecision {
  let path: string;
  try {
    const url = new URL(targetUrl);
    path = `${url.pathname}${url.search}`;
  } catch {
    return { allowed: true, evidence: 'URL could not be parsed; robots.txt rules were not applied.' };
  }

  const group = selectGroup(parsed, token);
  if (!group) {
    return { allowed: true, evidence: 'robots.txt contains no group matching our token or *.' };
  }

  let best: { type: 'allow' | 'disallow'; path: string } | undefined;
  for (const rule of group.rules) {
    if (!rule.path) continue;
    if (!ruleMatches(path, rule.path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.type === 'allow')) {
      best = rule;
    }
  }

  const agentLabel = group.agents.join(', ');
  if (!best) {
    return { allowed: true, evidence: `No rule under "User-agent: ${agentLabel}" matches ${path}.` };
  }
  return {
    allowed: best.type === 'allow',
    evidence: `${best.type === 'allow' ? 'Allow' : 'Disallow'}: ${best.path} under "User-agent: ${agentLabel}"`,
  };
}
