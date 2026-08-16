import { Globe, Search, Sparkles, ShieldCheck } from "lucide-react";
import { AuthIllustration } from "./auth-illustration";

/**
 * Fixed palette.
 *
 * The composition depends on one panel being light against a black one, so
 * these do not follow the dashboard's theme tokens: under `.dark` the form
 * surface and the dividing curve would both resolve to near-black and the
 * split would disappear entirely.
 */
const FORM_BG = "#ffffff";
const INK = "#0a0a0a";
const INK_SOFT = "#52525b";
const INK_MUTED = "#a1a1aa";
const BORDER = "#e4e4e7";

/**
 * The two-column frame shared by sign-in and registration.
 *
 * Left is an illustrated story panel, right is the form, and the boundary
 * between them is an organic curve rather than a straight edge — the curve is
 * an SVG filled with the form panel's background, laid over the seam, so it
 * reads as the light side cutting into the dark one.
 *
 * The two surfaces are deliberately separate: the story panel is dark and owns
 * the brand gradient, the form panel is light and owns the input contrast. An
 * earlier version put white text on a white glass card, which made the heading
 * and labels almost invisible.
 *
 * Nothing in the story is a claim we cannot back: no customer counts, no
 * percentage uplifts, no testimonials. Every line describes something the
 * product actually does.
 */

const STEPS = [
  {
    icon: Search,
    title: "Audit what search engines see",
    body: "Crawl the whole site, then surface the technical issues and broken schema holding it back.",
  },
  {
    icon: Sparkles,
    title: "Track who AI assistants cite",
    body: "See which domains ChatGPT, Claude and Gemini name for your clients' key questions.",
  },
  {
    icon: ShieldCheck,
    title: "Act on evidence, not guesses",
    body: "Every recommendation carries its source, and nothing ships without a human approving it.",
  },
];

/** The three-step story. In the side panel on desktop, below the form on mobile. */
function Steps({ className = "" }: { className?: string }) {
  return (
    <ol className={className}>
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className="auth-rise flex gap-3.5"
          // Staggered by index so they arrive in reading order.
          style={{ animationDelay: `${140 + i * 90}ms` }}
        >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.07]">
            <step.icon size={15} className="text-white/85" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">{step.title}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/50">{step.body}</p>
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
    <div className="flex min-h-screen flex-col lg:flex-row" style={{ background: FORM_BG }}>
      {/* ── Story ─────────────────────────────────────────────────────── */}
      <aside
        className="relative order-2 flex flex-col justify-center overflow-hidden px-8 pb-14 pt-24 lg:order-1 lg:pt-16 lg:w-[56%] lg:px-16 lg:py-16"
        style={{ background: "linear-gradient(155deg, #050505 0%, #171717 50%, #050505 100%)" }}
      >
        <AuthIllustration className="pointer-events-none absolute inset-y-0 right-[-10%] h-full w-[82%] opacity-90 lg:right-[-8%] lg:w-[58%]" />

        {/* Keeps the copy legible over the busiest part of the artwork. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(95deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.86) 30%, rgba(0,0,0,0.34) 62%, rgba(0,0,0,0.04) 100%)",
          }}
        />

        <div className="relative z-10 max-w-lg">
          <div className="auth-rise flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
              <Globe size={20} className="text-black" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">GrowthX AI</span>
          </div>

          <h1 className="auth-rise mt-8 text-[26px] font-semibold leading-[1.15] tracking-tight text-white lg:mt-12 lg:text-[38px]">
            Know why AI search
            <br />
            recommends your clients
            <span className="text-white/40">.</span>
          </h1>
          <p className="auth-rise mt-4 max-w-md text-[14.5px] leading-relaxed text-white/60">
            An SEO workspace for agencies running many clients at once — from the technical audit
            through to the work that closes the gap.
          </p>

          <Steps className="mt-9 space-y-5 lg:mt-11" />

          <p className="auth-rise mt-10 hidden max-w-md text-[11.5px] leading-relaxed text-white/35 lg:block">
            Figures in GrowthX come from your clients&apos; own crawls, tracked prompts and connected
            accounts. Where something has not been measured, it says so.
          </p>
        </div>

        {/* The curve. Filled with the form panel's background so the light side
            appears to cut into the dark one. Vertical on desktop, horizontal on
            mobile where the panels stack. */}
        <svg
          aria-hidden
          className="absolute right-[-1px] top-0 hidden h-full w-[110px] lg:block"
          viewBox="0 0 110 800"
          preserveAspectRatio="none"
          fill={FORM_BG}
        >
          <path d="M110 0 H62 C62 130 8 190 8 320 C8 450 90 520 90 640 C90 730 54 762 54 800 H110 Z" />
        </svg>
        <svg
          aria-hidden
          className="absolute -top-px left-0 h-[64px] w-full lg:hidden"
          viewBox="0 0 400 64"
          preserveAspectRatio="none"
          fill={FORM_BG}
        >
          <path d="M0 0 H400 V26 C320 26 270 60 190 60 C110 60 70 30 0 30 Z" />
        </svg>
      </aside>

      {/* ── Form ──────────────────────────────────────────────────────── */}
      <main className="order-1 flex flex-1 items-center justify-center px-6 py-14 lg:order-2 lg:px-14 lg:py-12">
        <div className="auth-rise w-full max-w-[360px]" style={{ animationDelay: "80ms" }}>
          <h2
            className="text-center text-[26px] font-semibold tracking-tight lg:text-left"
            style={{ color: INK }}
          >
            {title}
          </h2>
          <p
            className="mt-1.5 text-center text-[14px] lg:text-left"
            style={{ color: INK_SOFT }}
          >
            {subtitle}
          </p>

          <div className="mt-8">{children}</div>

          <div className="mt-7 text-center text-[13.5px]" style={{ color: INK_SOFT }}>
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
        <label htmlFor={id} className="text-[13px] font-medium" style={{ color: INK }}>
          {label}
        </label>
        {hint && (
          <span className="text-[12px]" style={{ color: INK_MUTED }}>
            {hint}
          </span>
        )}
      </div>
      <input
        id={id}
        {...props}
        className="w-full rounded-xl border px-3.5 py-2.5 text-[14px] outline-none transition-shadow placeholder:text-neutral-400 focus:ring-2"
        style={
          {
            background: FORM_BG,
            borderColor: BORDER,
            color: INK,
            // Focus ring colour as a variable so the class above can stay static.
            "--tw-ring-color": "rgba(0,0,0,0.28)",
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
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
      style={{ background: INK }}
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
