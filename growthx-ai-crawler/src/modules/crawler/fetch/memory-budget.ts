import * as fs from 'fs';
import * as os from 'os';

/**
 * Whether there is room to run Chromium beside the Node process.
 *
 * Rendering is the only thing the crawler does that allocates more than the
 * container has. A warm Chromium with the crawler's own launch flags measures
 * roughly 350-600MB resident depending on the page; the smallest deployment
 * target is a 512MB instance already holding a 300MB Node heap. Those numbers
 * do not fit together, and the way they fail is the worst available: the
 * kernel kills the container mid-crawl, every in-flight page is lost, the job
 * keeps its RUNNING status with `pagesCrawled` still at zero, and five minutes
 * later the stall sweep finds it and records a bare FAILED. The operator sees
 * a crawl that ran for seven minutes, read nothing and explained nothing.
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

export interface ContainerMemory {
  /** The cgroup limit, or the host's total when no limit is imposed. */
  limitBytes?: number;
  /** Bytes charged to the cgroup, which includes this process and Chromium. */
  usedBytes?: number;
  source: 'cgroup-v2' | 'cgroup-v1' | 'os' | 'unknown';
}

/**
 * The memory ceiling this process actually lives under.
 *
 * `os.totalmem()` reports the host's memory, not the container's, so on any
 * scheduler it reads as tens of gigabytes while the cgroup kills the process
 * at 512MB. The cgroup files are the only honest answer; the host total is the
 * fallback for running outside a container at all.
 */
export function containerMemory(): ContainerMemory {
  const v2Limit = readNumber('/sys/fs/cgroup/memory.max');
  if (v2Limit !== undefined) {
    return { limitBytes: v2Limit, usedBytes: readNumber('/sys/fs/cgroup/memory.current'), source: 'cgroup-v2' };
  }

  const v1Limit = readNumber('/sys/fs/cgroup/memory/memory.limit_in_bytes');
  if (v1Limit !== undefined) {
    return {
      limitBytes: v1Limit,
      usedBytes: readNumber('/sys/fs/cgroup/memory/memory.usage_in_bytes'),
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
 * `requiredMb` is what a browser needs beside the Node process, not what it
 * peaks at on a heavy page. It is configurable because the honest figure
 * depends on the sites being crawled, and an operator who has measured their
 * own workload should be able to say so.
 */
export function renderBudget(
  memory: ContainerMemory = containerMemory(),
  requiredMb = Number(process.env.RENDER_MIN_FREE_MB || 400),
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
