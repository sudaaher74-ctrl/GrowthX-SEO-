import { cn } from "@/lib/utils";

/**
 * The panel every screen is built out of.
 *
 * Before this existed there were 773 hand-rolled `rounded-* border bg-*`
 * panels against 19 uses of the `.card` class, so each new section picked its
 * own radius, padding, border tint and shadow. The values below are not new
 * taste — they are the plurality of what the app already renders (`rounded-xl`
 * 711, `bg-white` 868, `shadow-xs` 286, `p-4` 284), so switching a panel to
 * this component is a no-op visually and a fix structurally.
 *
 * Borders are declared as a bare `border`. `globals.css` sets the default
 * border colour to `--color-line` in a base layer, so the hairline token is
 * what you get without naming a grey — naming one is how `border-slate-200`
 * (#e2e8f0, cool) and `border-brand-200` (#e4e4e7, neutral) ended up side by
 * side on the same screen.
 *
 * Not a client component on purpose: it renders no state and binds no
 * handlers, so it costs nothing in a server component and still composes
 * inside client ones.
 */

type CardVariant = "default" | "inset" | "flush";
type CardPadding = "none" | "sm" | "md" | "lg";

const variantStyles: Record<CardVariant, string> = {
  /** The standard raised panel. */
  default: "rounded-xl border bg-white shadow-xs",
  /** A panel nested inside another panel — recedes instead of stacking shadows. */
  inset: "rounded-xl border bg-brand-50/60",
  /** Same frame, no shadow: for panels that wrap a table to its own edges. */
  flush: "rounded-xl border bg-white overflow-hidden",
};

const paddingStyles: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Defaults to `sm` for `inset`, `md` otherwise, and `none` for `flush`. */
  padding?: CardPadding;
}

export function Card({
  variant = "default",
  padding,
  className,
  children,
  ...props
}: CardProps) {
  const resolvedPadding =
    padding ?? (variant === "flush" ? "none" : variant === "inset" ? "sm" : "md");

  return (
    <div
      className={cn(variantStyles[variant], paddingStyles[resolvedPadding], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rendered hard right — a filter, a "View all" link, an overflow menu. */
  actions?: React.ReactNode;
}

/**
 * Title row. Keep it on one line with its actions; a header that wraps its
 * button under the title is the most common way these panels lose their
 * alignment with each other.
 */
export function CardHeader({
  actions,
  className,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn("flex items-start justify-between gap-3", className)}
      {...props}
    >
      <div className="min-w-0">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

/**
 * `text-sm font-bold text-brand-950` is the app's most-used section title
 * (28 occurrences) — this is that, named.
 */
export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-bold text-brand-950 truncate", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

/** One line of context under a `CardTitle`. Muted on purpose — never for data. */
export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-0.5 text-[11.5px] text-brand-400", className)} {...props}>
      {children}
    </p>
  );
}

/** The body of a card that has a `CardHeader`, spaced off it consistently. */
export function CardBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-3", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Footer rule + row. The rule uses `border-t` so it picks up the same hairline
 * token as the card's own frame.
 */
export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-3 flex items-center justify-between gap-2 border-t pt-2.5 text-[11px] text-brand-400",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
