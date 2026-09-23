import { ArmAssignmentService, DEFAULT_NEVER_HOLD } from './arm-assignment.service';

describe('ArmAssignmentService', () => {
  let service: ArmAssignmentService;

  beforeEach(() => {
    service = new ArmAssignmentService();
  });

  it('is completely deterministic across repeated calls for the same finding', () => {
    const candidate = {
      id: 'finding-12345-abcde',
      issueType: 'MISSING_TITLE',
      fixClass: 'AUTO' as const,
      groupSize: 10,
    };

    const first = service.assign(candidate);
    for (let i = 0; i < 50; i++) {
      expect(service.assign(candidate)).toBe(first);
    }
  });

  it('respects neverHold list even at holdRate = 1.0 (safety test)', () => {
    for (const neverHoldType of DEFAULT_NEVER_HOLD) {
      const candidate = {
        id: `unsafe-finding-${neverHoldType}`,
        issueType: neverHoldType,
        fixClass: 'APPROVAL' as const,
        groupSize: 100,
      };

      const arm = service.assign(candidate, { holdRate: 1.0 });
      expect(arm).toBe('TREAT');
    }
  });

  it('respects minGroupSize boundary at n - 1, n, and n + 1', () => {
    // Find an id that naturally hashes to < 0.5
    // Let's create an id that definitely hashes to < 0.5
    const id = 'id-below-threshold';
    const minGroupSize = 8;
    const config = { minGroupSize, holdRate: 0.99 };

    // Below threshold (7 < 8) -> Must be TREAT
    expect(
      service.assign(
        { id, issueType: 'MISSING_TITLE', fixClass: 'AUTO', groupSize: 7 },
        config,
      ),
    ).toBe('TREAT');

    // At threshold (8 === 8) -> Eligible for HOLD
    expect(
      service.assign(
        { id, issueType: 'MISSING_TITLE', fixClass: 'AUTO', groupSize: 8 },
        config,
      ),
    ).toBe('HOLD');

    // Above threshold (9 > 8) -> Eligible for HOLD
    expect(
      service.assign(
        { id, issueType: 'MISSING_TITLE', fixClass: 'AUTO', groupSize: 9 },
        config,
      ),
    ).toBe('HOLD');
  });

  it('never holds MANUAL fixClass findings', () => {
    const candidate = {
      id: 'manual-id-1',
      issueType: 'THIN_CONTENT',
      fixClass: 'MANUAL' as const,
      groupSize: 20,
    };
    expect(service.assign(candidate, { holdRate: 1.0 })).toBe('TREAT');
  });

  it('returns TREAT when client holdback setting is turned off', () => {
    const candidate = {
      id: 'opted-out-id',
      issueType: 'MISSING_TITLE',
      fixClass: 'AUTO' as const,
      groupSize: 20,
    };
    expect(service.assign(candidate, { holdRate: 1.0, enabled: false })).toBe('TREAT');
  });

  it('distributes within tolerance of holdRate (0.10) over 10,000 synthetic ids', () => {
    const targetRate = 0.1;
    let holdCount = 0;
    const total = 10000;

    for (let i = 0; i < total; i++) {
      const arm = service.assign(
        {
          id: `synthetic-finding-${i}-${(i * 7919) % 104729}`,
          issueType: 'MISSING_TITLE',
          fixClass: 'AUTO',
          groupSize: 10,
        },
        { holdRate: targetRate, minGroupSize: 8 },
      );
      if (arm === 'HOLD') holdCount++;
    }

    const actualRate = holdCount / total;
    // Expected around 10%, tolerance ± 1.5%
    expect(actualRate).toBeGreaterThan(0.085);
    expect(actualRate).toBeLessThan(0.115);
  });
});
