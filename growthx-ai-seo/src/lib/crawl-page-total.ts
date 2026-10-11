/** Counts for the current job only; loaded rows are a paginated sample. */
export function crawlPageTotal(jobCount: number | undefined, storedCount: number | undefined, loadedCount: number): number {
  const counts = [jobCount, storedCount].filter((value): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0,
  );
  return counts.length ? Math.max(...counts) : loadedCount;
}
