import Link from "next/link";
import { Compass } from "lucide-react";

/** A bad URL used to land on the stock Next.js 404, with no way back into the
 *  app and none of its chrome. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
        <Compass size={22} />
      </span>
      <h1 className="mt-4 text-[20px] font-bold tracking-[-0.02em] text-brand-950">No page here</h1>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-brand-500">
        The link may be out of date, or the page may have moved. Press ⌘K anywhere in the app to search every page.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        Back to overview
      </Link>
    </div>
  );
}
