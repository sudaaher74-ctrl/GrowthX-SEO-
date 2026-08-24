/**
 * Shown while a dashboard route streams in.
 *
 * Deliberately the shape of a console page — header, KPI row, panel — rather
 * than a spinner: every route in this group opens with that layout, so the
 * skeleton lands in roughly the right places and the page does not jump when
 * the real content arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <div className="shimmer h-7 w-56 rounded-lg" />
        <div className="shimmer h-4 w-80 rounded" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-4">
            <div className="shimmer h-2.5 w-20 rounded" />
            <div className="shimmer mt-3 h-6 w-24 rounded" />
            <div className="shimmer mt-3 h-1 w-full rounded-full" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="shimmer h-4 w-40 rounded" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
