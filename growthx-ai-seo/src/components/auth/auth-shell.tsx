import { Globe, Search, Sparkles, ShieldCheck } from "lucide-react";

/**
 * The two-column frame shared by sign-in and registration.
 *
 * Left tells the customer what the product does; right is the form. They are
 * separate surfaces on purpose — the story panel is dark and owns the brand
 * gradient, the form panel is light and owns the input contrast. The previous
 * single-card version put white text on a white glass card, which rendered the
 * heading and labels almost invisible.
 *
 * Nothing in the story is a claim we cannot back: no customer counts, no
 * percentage uplifts, no testimonials. Every line describes something the
 * product actually does.
 */

const STEPS = [
  {
    icon: Search,
    title: "Audit what search engines see",
    body: "Crawl the whole site, then surface the technical issues, thin pages and broken schema holding it back.",
  },
  {
    icon: Sparkles,
    title: "Track who AI assistants cite",
    body: "Watch which domains ChatGPT, Claude and Gemini name for your clients' key questions — and where competitors win instead.",
  },
  {
    icon: ShieldCheck,
    title: "Act on evidence, not guesses",
    body: "Every recommendation carries the source it came from, and nothing reaches a client's site without a human approving it.",
  },
];

/** The three-step story. Rendered in the side panel on desktop, below the form on mobile. */
function Steps({ className = "" }: { className?: string }) {
  return (
    <ol className={className}>
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className="auth-rise flex gap-4"
          // Staggered by index so they arrive in reading order.
          style={{ animationDelay: `${120 + i * 90}ms` }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.07]">
            <step.icon size={16} className="text-white/85" />
          </div>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-white">
              <span className="mr-2 text-white/35 tabular-nums">0{i + 1}</span>
              {step.title}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/55">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ── Story ─────────────────────────────────────────────────────── */}
      <aside
        className="relative order-2 flex flex-col justify-between overflow-hidden px-8 py-10 lg:order-1 lg:w-[52%] lg:px-14 lg:py-14"
        style={{ background: "linear-gradient(150deg, #1b1035 0%, #2d1b4e 45%, #14281f 100%)" }}
      >
        {/* Depth, kept subtle so it never competes with the text. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.45) 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[380px] w-[380px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.28) 0%, transparent 70%)" }}
        />

        <div className="auth-rise relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)" }}
            >
              <Globe size={20} className="text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">GrowthX AI</span>
          </div>

          <h1 className="mt-8 max-w-lg text-[26px] font-semibold leading-[1.15] tracking-tight text-white lg:mt-14 lg:text-[40px]">
            Know why AI search
            <br />
            recommends your clients
            <span style={{ color: "#c084fc" }}>.</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/65">
            An SEO workspace for agencies running many clients at once — from the technical audit through
            to the work that closes the gap.
          </p>
        </div>

        {/* `justify-between` alone lets these collide with the intro on short
            viewports, so keep a floor on the gap at every size. */}
        <Steps className="relative z-10 mt-10 hidden space-y-6 lg:mt-14 lg:block" />

        <Steps className="relative z-10 mt-8 space-y-6 lg:hidden" />

        <p className="relative z-10 mt-10 hidden text-[12px] leading-relaxed text-white/40 lg:block">
          Figures shown in GrowthX come from your clients&apos; own crawls, tracked prompts and
          connected accounts. Where something has not been measured, it says so.
        </p>
      </aside>

      {/* ── Form ──────────────────────────────────────────────────────── */}
      <main
        className="order-1 flex flex-1 items-center justify-center px-6 py-14 lg:order-2 lg:px-12 lg:py-12"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="auth-rise w-full max-w-[380px]" style={{ animationDelay: "80ms" }}>
          <h2 className="text-[26px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <p className="mt-1.5 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            {subtitle}
          </p>

          <div className="mt-8">{children}</div>

          <div className="mt-7 text-center text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            {footer}
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * A labelled input.
 *
 * The label is a real element rather than a placeholder: a placeholder-only
 * field loses its name the moment someone types, and is not announced properly
 * by a screen reader.
 */
export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
        </label>
        {hint && (
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            {hint}
          </span>
        )}
      </div>
      <input
        id={id}
        {...props}
        className="w-full rounded-xl border px-3.5 py-2.5 text-[14px] outline-none transition-shadow placeholder:text-[var(--text-muted)] focus:ring-2"
        style={
          {
            background: "var(--surface-1)",
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
            // Focus ring colour as a variable so the class above can stay static.
            "--tw-ring-color": "rgba(124,58,237,0.35)",
          } as React.CSSProperties
        }
      />
    </div>
  );
}

/** Primary submit button, with the brand gradient and a busy state. */
export function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
      style={{ background: "linear-gradient(135deg, #7c3aed 0%, #9333ea 60%, #c026d3 100%)" }}
    >
      {busy && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {children}
    </button>
  );
}
