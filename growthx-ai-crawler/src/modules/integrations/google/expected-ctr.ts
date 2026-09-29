/**
 * Roughly what click-through looks like at a given rank.
 *
 * Used only to decide which pages are worth surfacing, never shown as a
 * target. Real curves vary enormously by query intent, device and how much of
 * the page Google fills before the first organic result, so treating these as
 * benchmarks would be false precision.
 */
export function expectedCtr(position: number): number {
  if (position <= 1) return 0.28;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.11;
  if (position <= 5) return 0.07;
  if (position <= 8) return 0.035;
  if (position <= 10) return 0.025;
  if (position <= 20) return 0.01;
  return 0.005;
}
