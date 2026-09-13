"use client";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/console";

/**
 * `Panel`, made to fill a fixed-height column and scroll its own body.
 *
 * Design Studio's three columns are given an explicit height by the page, and
 * each needs its body — not the page — to scroll, so that the suggestion list
 * and the inspector stay side by side with the preview instead of running past
 * it.
 *
 * `Panel` wraps its children in a plain div, so a child cannot stretch to fill
 * it. The child selector below makes that wrapper the flex child. It lives here
 * rather than in `console.tsx` because 38 files depend on Panel's current box
 * and none of them want this behaviour; changing it there to suit one screen is
 * how a shared primitive starts drifting.
 */
export function ScrollPanel({
  title,
  actions,
  className,
  children,
}: {
  title?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel
      title={title}
      actions={actions}
      className={cn(
        "flex h-full min-h-0 flex-col",
        "[&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col",
        className,
      )}
    >
      {children}
    </Panel>
  );
}
