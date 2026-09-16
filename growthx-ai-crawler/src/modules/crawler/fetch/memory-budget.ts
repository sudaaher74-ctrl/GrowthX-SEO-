import * as fs from 'fs';
import * as os from 'os';

/**
 * Whether there is room to run Chromium beside the Node process.
 *
 * Rendering is the only thing the crawler does that can exceed what the
 * container has, and the way it fails is the worst available: the kernel kills
 * the container mid-crawl, every in-flight page is lost, the job keeps its
 * RUNNING status with `pagesCrawled` still at zero, and the stall sweep closes
 * it out minutes later. The operator sees a crawl that ran for seven minutes,
 * read nothing and explained nothing.
 *
 * Checking first turns that into a decision. A site whose pages cannot be
 * rendered is still worth crawling — its URLs, status codes, titles and
 * sitemap are all readable statically — and `RENDER_UNAVAILABLE` already
 * exists to say on the report that the content behind JavaScript was not
 * assessed. A degraded crawl that says so beats a dead container every time.
 *
 * The check is deliberately one-directional: when the limit cannot be read,
 * rendering is allowed. Guessing "no" on a host that reports nothing would
 * silently disable rendering on deployments where it works today.
 *
 * ── On the numbers ────────────────────────────────────────────────────────
 * Chromium's cost has to be measured as PSS, not RSS. A headless browser is
 * nine or ten processes sharing most of their pages, so summing their RSS
 * counts the same memory repeatedly: measured together, a browser rendering a
 * 20,000-link page reported 704MB of summed RSS and 329MB of PSS. Only the
 * second figure is what the cgroup actually charges.
 *
 * Measured with the launch flags this crawler uses: ~190MB PSS idle, ~330MB
 * PSS on a deliberately extreme DOM. An ordinary content page sits nearer
 * 220MB, which is where the default below comes from.
 */

/** cgroup v1 writes this sentinel, or one close to it, to mean "no limit". */
const UNLIMITED_THRESHOLD = 2 ** 53;

function readNumber(path: string): number | undefined {
  try {
    const raw = fs.readFileSync(path, 'utf8').trim();
    if (raw === 'max') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 && value < UNLIMITED_THRESHOLD ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reclaimable page cache charged to the cgroup.
 *
 * `memory.current` counts the page cache, and the kernel evicts that under
 * pressure rather than killing anything. Left in, a container that has simply
 * been up for a while reads as full — this host reports 640MB of cache — and
 * rendering would be refused permanently on a box with ample free memory.
 * Inactive file pages are the portion certain to be reclaimable, so they are
 * the honest thing to discount.
 */
function reclaimableBytes(statPath: string, field: string): number {
  try {
    const stat = fs.readFileSync(statPath, 'utf8');
    const match = new RegExp(`^${field}\\s+(\\d+)`, 'm').exec(stat);
    return Number(match?.[1] || 0);
  } catch {
    return 0;
  }
}

export interface ContainerMemory {
  /** The cgroup limit, or the host's total when no limit is imposed. */
  limitBytes?: number;
  /** Bytes charged to the cgroup, with reclaimable page cache discounted. */
  usedBytes?: number;
  source: 'cgroup-v2' | 'cgroup-v1' | 'os' | 'unknown';
}

/**
 * The memory ceiling this process actually lives under.
 *
 * `os.totalmem()` reports the host's memory, not the container's, so under any
 * scheduler it reads as tens of gigabytes while the cgroup kills the process at
 * 512MB. The cgroup files are the only honest answer; the host total is the
 * fallback for running outside a container at all.
 */
export function containerMemory(): ContainerMemory {
  const v2Limit = readNumber('/sys/fs/cgroup/memory.max');
  if (v2Limit !== undefined) {
    const current = readNumber('/sys/fs/cgroup/memory.current');
    const cache = reclaimableBytes('/sys/fs/cgroup/memory.stat', 'inactive_file');
    return {
      limitBytes: v2Limit,
      usedBytes: current === undefined ? undefined : Math.max(0, current - cache),
      source: 'cgroup-v2',
    };
  }

  const v1Limit = readNumber('/sys/fs/cgroup/memory/memory.limit_in_bytes');
  if (v1Limit !== undefined) {
    const current = readNumber('/sys/fs/cgroup/memory/memory.usage_in_bytes');
    const cache = reclaimableBytes('/sys/fs/cgroup/memory/memory.stat', 'total_inactive_file');
    return {
      limitBytes: v1Limit,
      usedBytes: current === undefined ? undefined : Math.max(0, current - cache),
      source: 'cgroup-v1',
    };
  }

  const total = os.totalmem();
  if (Number.isFinite(total) && total > 0) {
    return { limitBytes: total, usedBytes: total - os.freemem(), source: 'os' };
  }

  return { source: 'unknown' };
}

export interface RenderBudgetVerdict {
  allowed: boolean;
  /** Why not, phrased for an operator reading a log or a crawl report. */
  reason?: string;
  headroomMb?: number;
  requiredMb: number;
}

/**
 * Decides whether launching Chromium now is survivable.
 *
 * `requiredMb` is what a browser needs beside the Node process for an ordinary
 * page, not what it peaks at on a pathological one. It is configurable because
 * the honest figure depends on the sites being crawled, and an operator who has
 * measured their own workload should be able to say so.
 */
export function renderBudget(
  memory: ContainerMemory = containerMemory(),
  // 220MB: Chromium's measured PSS on an ordinary page, against ~190MB idle.
  // The default has to be a number that works unconfigured, because the
  // deployment this protects does not sync its Blueprint and so never sets the
  // variable. A 512MB instance with this app's ~273MB baseline has ~239MB
  // free, and a default above that would decline every render on the one
  // deployment it exists for.
  requiredMb = Number(process.env.RENDER_MIN_FREE_MB || 220),
): RenderBudgetVerdict {
  if (memory.limitBytes === undefined || memory.usedBytes === undefined) {
    return { allowed: true, requiredMb };
  }

  const headroomMb = Math.round((memory.limitBytes - memory.usedBytes) / 1024 / 1024);
  if (headroomMb >= requiredMb) return { allowed: true, headroomMb, requiredMb };

  const limitMb = Math.round(memory.limitBytes / 1024 / 1024);
  return {
    allowed: false,
    headroomMb,
    requiredMb,
    reason:
      `This instance has ${headroomMb}MB free of ${limitMb}MB, and rendering a page needs about ${requiredMb}MB. ` +
      `Pages were read without running their JavaScript. A site that builds its content in the browser will look ` +
      `empty in this report until the instance has more memory.`,
  };
}
