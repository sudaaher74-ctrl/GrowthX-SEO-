"use client";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The way into Design Studio from the screens that find problems.
 *
 * Each caller names the action in its own terms — an audit offers to preview a
 * fix, the Fix Engine offers to review the design of one — but they all land on
 * the same place, so the label is a prop rather than five near-identical
 * buttons scattered across the app.
 */
export function DesignStudioLink({
  label = "Open in Design Studio",
  /** Focuses Design Studio on one page of the site when known. */
  pageUrl,
  className,
}: {
  label?: string;
  pageUrl?: string;
  className?: string;
}) {
  const href = pageUrl
    ? `/design-studio?page=${encodeURIComponent(pageUrl)}`
    : "/design-studio";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-xs hover:bg-brand-50 hover:text-brand-950 active:scale-95 transition-all dark:bg-brand-900 dark:text-brand-200 dark:hover:bg-brand-800",
        className,
      )}
    >
      <Wand2 size={13} className="text-brand-500" />
      <span>{label}</span>
    </Link>
  );
}
