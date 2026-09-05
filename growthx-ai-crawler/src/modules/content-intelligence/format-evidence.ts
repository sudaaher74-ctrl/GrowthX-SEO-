/**
 * What each content format is actually doing in this market.
 *
 * A per-format plan — reels, feed posts, long video, shorts, articles — is
 * only worth writing if it is built on which formats these particular
 * competitors get results from, not on what performs well in general. This
 * folds the collected posts into that answer, and it is deliberately pure so
 * the arithmetic can be checked without a database or a model.
 *
 * The medians matter more than they look. Social performance is long-tailed:
 * one post that went unusually far pulls a mean far above anything the account
 * typically achieves, and a plan built on that mean tells a customer to expect
 * a result almost none of their posts will get.
 */

/** A post as this module reads it, from either side of the comparison. */
export interface FormatPost {
  /** INSTAGRAM | YOUTUBE | … */
  platform: string;
  /** REEL | IMAGE | CAROUSEL | VIDEO | SHORT */
  contentType: string;
  /** Null where the platform reported none. Never treated as zero. */
  views: number | null;
  likes: number | null;
  comments: number | null;
  publishedAt: Date | null;
  /** A line of the caption or title, for naming an example. */
  headline: string | null;
}

export interface FormatStats {
  /** e.g. `INSTAGRAM_REEL`. Platform and format together, since neither alone decides anything. */
  format: string;
  posts: number;
  /** Median views, or null when the platform reported none for this format. */
  medianViews: number | null;
  medianLikes: number | null;
  /** How many posts of this format per week, across the window they cover. */
  postsPerWeek: number | null;
  /** The best-performing headline seen, so the plan can point at something real. */
  topExample: string | null;
}

export interface FormatEvidence {
  competitors: FormatStats[];
  own: FormatStats[];
  /** Formats rivals use that the customer does not publish at all. */
  formatsTheyUseYouDoNot: string[];
  /** Said plainly when there is not enough to draw a conclusion from. */
  notes: string[];
}

/** Below this, a "median" is one or two posts wearing a statistic's clothes. */
const MIN_POSTS_FOR_MEDIAN = 3;

export function buildFormatEvidence(competitorPosts: FormatPost[], ownPosts: FormatPost[]): FormatEvidence {
  const competitors = statsByFormat(competitorPosts);
  const own = statsByFormat(ownPosts);

  const ownFormats = new Set(own.map((entry) => entry.format));
  const formatsTheyUseYouDoNot = competitors
    .filter((entry) => !ownFormats.has(entry.format))
    .map((entry) => entry.format);

  const notes: string[] = [];
  if (competitorPosts.length === 0) {
    notes.push('No competitor posts have been collected, so no format is backed by evidence from this market.');
  }
  if (ownPosts.length === 0) {
    notes.push(
      "None of your own posts have been collected, so the plan cannot say which formats you already use " +
        'or how they perform against your competitors\'.',
    );
  }

  return { competitors, own, formatsTheyUseYouDoNot, notes };
}

function statsByFormat(posts: FormatPost[]): FormatStats[] {
  const groups = new Map<string, FormatPost[]>();
  for (const post of posts) {
    const format = `${post.platform}_${post.contentType}`.toUpperCase();
    const group = groups.get(format);
    if (group) group.push(post);
    else groups.set(format, [post]);
  }

  return [...groups.entries()]
    .map(([format, group]) => ({
      format,
      posts: group.length,
      medianViews: median(group.map((p) => p.views), group.length),
      medianLikes: median(group.map((p) => p.likes), group.length),
      postsPerWeek: cadence(group),
      topExample: topExample(group),
    }))
    .sort((a, b) => b.posts - a.posts);
}

/**
 * The middle value of what was actually reported.
 *
 * Nulls are dropped rather than counted as zero — a platform that reports no
 * views has not reported zero views — and a group too small to have a middle
 * returns null rather than dressing one post up as a typical one.
 */
function median(values: Array<number | null>, groupSize: number): number | null {
  const known = values.filter((value): value is number => value != null).sort((a, b) => a - b);
  if (known.length === 0 || groupSize < MIN_POSTS_FOR_MEDIAN) return null;

  const middle = Math.floor(known.length / 2);
  return known.length % 2 === 0 ? Math.round((known[middle - 1] + known[middle]) / 2) : known[middle];
}

/**
 * Posts per week across the span the posts themselves cover.
 *
 * Measured from first to last published date rather than against a fixed
 * window: a channel whose last upload was eight months ago posts at whatever
 * rate it posted then, and dividing by "the last 30 days" would report it as
 * silent when the real finding is that it stopped.
 */
function cadence(posts: FormatPost[]): number | null {
  const dates = posts
    .map((post) => post.publishedAt)
    .filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length < 2) return null;

  const weeks = (dates[dates.length - 1].getTime() - dates[0].getTime()) / (7 * 24 * 60 * 60 * 1000);
  if (weeks < 1) return null;

  return Math.round((dates.length / weeks) * 10) / 10;
}

/** The headline of the best-performing post, by whatever the platform reported. */
function topExample(posts: FormatPost[]): string | null {
  const ranked = [...posts]
    .filter((post) => post.headline?.trim())
    .sort((a, b) => (b.views ?? b.likes ?? 0) - (a.views ?? a.likes ?? 0));
  return ranked[0]?.headline?.trim().slice(0, 140) ?? null;
}

/** The evidence as prompt lines, or an honest sentence when there is none. */
export function describeFormats(stats: FormatStats[]): string[] {
  return stats.map((entry) => {
    const parts = [
      `${entry.posts} post${entry.posts === 1 ? '' : 's'}`,
      entry.postsPerWeek != null ? `${entry.postsPerWeek}/week` : null,
      entry.medianViews != null ? `median ${entry.medianViews} views` : null,
      entry.medianLikes != null ? `median ${entry.medianLikes} likes` : null,
    ].filter(Boolean);

    const example = entry.topExample ? ` | best: "${entry.topExample}"` : '';
    return `- ${entry.format}: ${parts.join(', ')}${example}`;
  });
}
