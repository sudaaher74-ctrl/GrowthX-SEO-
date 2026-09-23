import { FindingLifecycle } from '@prisma/client';

export type Bucket = 'NEEDS_YOU' | 'IN_PROGRESS' | 'DONE';

export const BUCKET_OF: Record<FindingLifecycle, Bucket | null> = {
  DETECTED: null,
  QUEUED: 'NEEDS_YOU',
  FAILED: 'NEEDS_YOU',
  SNOOZED: null,
  APPROVED: 'IN_PROGRESS',
  APPLYING: 'IN_PROGRESS',
  VERIFYING: 'IN_PROGRESS',
  VERIFIED: 'DONE',
  MEASURED: 'DONE',
  RESOLVED: 'DONE',
  DISMISSED: 'DONE',
};

/**
 * Returns the customer-facing bucket for a finding lifecycle state,
 * or null if the finding is not yet visible or currently snoozed.
 */
export function getBucketForLifecycle(lifecycle: FindingLifecycle): Bucket | null {
  return BUCKET_OF[lifecycle] ?? null;
}
