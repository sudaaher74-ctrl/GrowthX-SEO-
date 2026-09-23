import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface HoldConfig {
  holdRate: number; // share held back, 0-1. Start at 0.10
  neverHold: string[]; // issue types never held back
  minGroupSize: number; // minimum group size before any member is held
  enabled?: boolean; // per-project toggle, default true
}

export const DEFAULT_NEVER_HOLD: readonly string[] = Object.freeze([
  'SERVER_ERROR_5XX',
  'REDIRECT_LOOP',
  'HTTPS_ISSUE',
  'MIXED_CONTENT',
  'BROKEN_IMAGE',
  'BROKEN_LINK_4XX',
  'NOINDEX_DETECTED',
]);

export const DEFAULT_HOLD_CONFIG: HoldConfig = Object.freeze({
  holdRate: 0.1,
  neverHold: [...DEFAULT_NEVER_HOLD],
  minGroupSize: 8,
  enabled: true,
});

export interface FindingCandidate {
  id: string;
  issueType?: string;
  fixClass?: 'AUTO' | 'APPROVAL' | 'MANUAL';
  groupSize?: number;
  groupKey?: string;
}

@Injectable()
export class ArmAssignmentService {
  /**
   * Assigns an arm (TREAT or HOLD) deterministically.
   *
   * Rules:
   * 1. If project holdback is disabled, always TREAT.
   * 2. If issueType is in neverHold, always TREAT.
   * 3. Only hold AUTO and APPROVAL classes; MANUAL is always TREAT.
   * 4. Only hold within groups of at least minGroupSize (default 8).
   * 5. Hash finding.id into [0, 1); HOLD when < holdRate.
   */
  assign(finding: FindingCandidate, config: Partial<HoldConfig> = {}): 'TREAT' | 'HOLD' {
    const enabled = config.enabled ?? DEFAULT_HOLD_CONFIG.enabled;
    if (!enabled) return 'TREAT';

    const neverHold = config.neverHold ?? DEFAULT_HOLD_CONFIG.neverHold;
    const issueType = finding.issueType?.toUpperCase();
    if (issueType && neverHold.some((nh) => nh.toUpperCase() === issueType)) {
      return 'TREAT';
    }

    // Only hold AUTO and APPROVAL classes
    const fixClass = finding.fixClass?.toUpperCase();
    if (fixClass === 'MANUAL') {
      return 'TREAT';
    }

    // Only hold within groups of at least minGroupSize
    const minGroupSize = config.minGroupSize ?? DEFAULT_HOLD_CONFIG.minGroupSize;
    const groupSize = finding.groupSize ?? 1;
    if (groupSize < minGroupSize) {
      return 'TREAT';
    }

    const holdRate = config.holdRate ?? DEFAULT_HOLD_CONFIG.holdRate;
    if (holdRate <= 0) return 'TREAT';

    const hashValue = this.hashToUnitInterval(finding.id);
    return hashValue < holdRate ? 'HOLD' : 'TREAT';
  }

  /**
   * Deterministically maps a string ID to a float in [0, 1).
   */
  private hashToUnitInterval(id: string): number {
    const hash = crypto.createHash('sha256').update(id).digest('hex');
    const integer = parseInt(hash.slice(0, 8), 16);
    return integer / 0x100000000;
  }
}
