import { cn } from "@/lib/utils";

/**
 * The title block at the top of a screen.
 *
 * There were twelve different `<h1>` treatments across `src/app` — from
 * `text-[15px] font-semibold` to `text-4xl font-black` — so two dashboard
 * pages opened next to each other did not look like the same product. The
 * default here is the plurality of the dashboard (`text-[15px] font-semibold
 * text-brand-950`, 8 pages), including the 9x9 tinted icon tile those pages
 * already pair with it.
 *
 * `size="page"` is the larger standalone scale, backed by the `.text-h1` class
 * in `globals.css`, for marketing and full-page screens that are not inside
 * the dashboard chrome.
 */

type HeaderTone = "accent" | "success" | "warning" | "error" | "neutral";

/**
 * Tints for the icon tile. They are token-derived opacities rather than typed
 * hexes — a page that wanted the amber tile had been reaching for
 * `bg-[#f59e0b18]`, which no longer tracks the token if the token moves.
 */
const toneStyles: Record<HeaderTone, string> = {
  accent: "bg-accent-600/10 text-accent-600",
  success: "bg-success-600/10 text-success-600",
  warning: "bg-warning-500/10 text-warning-500",
  error: "bg-error-600/10 text-error-600",
  neutral: "bg-brand-100 text-brand-600",
};

export interface PageHeaderProps {
  title: string;
  /** One line. What this screen is for, not what it contains. */
  description?: string;
  /**
   * A lucide icon element, e.g. `<Target size={17} />`. Rendered inside the
   * tinted tile, which supplies its colour — do not set one on the icon.
   */
  icon?: React.ReactNode;
  tone?: HeaderTone;
  /** Buttons, filters, a date range. Right-aligned, wraps below on narrow screens. */
  actions?: React.ReactNode;
  /** `app` sits inside the dashboard chrome; `page` is the standalone scale. */
  size?: "app" | "page";
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  tone = "accent",
  actions,
  size = "app",
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              toneStyles[tone],
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1
            className={
              size === "page"
                ? "text-h1 text-brand-950"
                : "text-[15px] font-semibold text-brand-950"
            }
          >
            {title}
          </h1>
          {description && (
            <p
              className={cn(
                "text-brand-500",
                size === "page" ? "mt-1.5 text-[13px]" : "text-[12px]",
              )}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
