import { FindingLifecycle } from '@prisma/client';
import { BUCKET_OF, getBucketForLifecycle } from './bucket.util';

describe('bucket.util', () => {
  it('maps every FindingLifecycle enum value to a bucket or explicit null', () => {
    const allLifecycles = Object.values(FindingLifecycle);
    expect(allLifecycles.length).toBeGreaterThan(0);

    for (const state of allLifecycles) {
      expect(state in BUCKET_OF).toBe(true);
      const bucket = BUCKET_OF[state];
      expect(bucket === null || ['NEEDS_YOU', 'IN_PROGRESS', 'DONE'].includes(bucket)).toBe(true);
    }
  });

  it('correctly maps specific lifecycle states to buckets', () => {
    // Hidden / pending
    expect(getBucketForLifecycle(FindingLifecycle.DETECTED)).toBeNull();
    expect(getBucketForLifecycle(FindingLifecycle.SNOOZED)).toBeNull();

    // NEEDS_YOU (requires customer intervention)
    expect(getBucketForLifecycle(FindingLifecycle.QUEUED)).toBe('NEEDS_YOU');
    expect(getBucketForLifecycle(FindingLifecycle.FAILED)).toBe('NEEDS_YOU');

    // IN_PROGRESS (automated execution in flight, no red badge)
    expect(getBucketForLifecycle(FindingLifecycle.APPROVED)).toBe('IN_PROGRESS');
    expect(getBucketForLifecycle(FindingLifecycle.APPLYING)).toBe('IN_PROGRESS');
    expect(getBucketForLifecycle(FindingLifecycle.VERIFYING)).toBe('IN_PROGRESS');

    // DONE (terminal or resolved)
    expect(getBucketForLifecycle(FindingLifecycle.VERIFIED)).toBe('DONE');
    expect(getBucketForLifecycle(FindingLifecycle.MEASURED)).toBe('DONE');
    expect(getBucketForLifecycle(FindingLifecycle.RESOLVED)).toBe('DONE');
    expect(getBucketForLifecycle(FindingLifecycle.DISMISSED)).toBe('DONE');
  });
});
