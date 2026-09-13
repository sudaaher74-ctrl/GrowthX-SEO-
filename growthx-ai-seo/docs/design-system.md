# Design system

How to add something to this app so it looks like it was always there.

This is a **light-only** product (`src/components/providers.tsx` — there is no
theme provider and no toggle). Anything you write is rendered on white.

---

## The one rule

> Compose a primitive from `src/components/ui/`. Do not build a new panel.

Nearly every "our change doesn't match the rest of the site" problem in this
codebase traces to the same thing: there were **773 hand-rolled**
`rounded-* border bg-*` panels and only **19** uses of the shared `.card`
class. Each one picked its own radius, padding, border tint and shadow, so no
two sections agreed. Reach for `<Card>` and the decision is already made.

---

## Vocabulary

Three colour vocabularies exist in this codebase. **Only the first is correct
for new code.**

| Use | Token | Not |
| --- | --- | --- |
| Text, primary | `text-brand-950` | `text-slate-900` (#0f172a — blue-tinted) |
| Text, secondary | `text-brand-600` / `text-brand-500` | `text-slate-600` |
| Text, muted / meta | `text-brand-400` | `text-slate-400` |
| Panel background | `bg-white` | — |
| Recessed background | `bg-brand-50` / `bg-brand-100` | `bg-slate-50` |
| Hairline border | bare `border` | `border-slate-200` |
| Informational | `accent-600` | `blue-600` |
| Good / passing | `success-600` | `emerald-600` |
| Needs attention | `warning-500` | `amber-500` |
| Broken / failing | `error-600` | `red-600` |
| Chart series | `--color-series-1` … `-8` | a typed hex |

`text-slate-900` is `#0f172a` and carries a blue cast; `text-brand-950` is
`#09090b` and is neutral. Put them in adjacent cards and the mismatch is
visible without a colour picker. That is the whole problem in one line.

**Borders never need a colour.** `globals.css` sets the default border colour
to `--color-line` in a base layer, so a bare `border` or `border-t` is already
the hairline token.

All tokens are declared in the `@theme` block of `src/app/globals.css`. That
file is the **only** source of theme truth — there is no `tailwind.config.ts`
(Tailwind v4 reads `@theme` from CSS, and the config file that used to sit here
was never loaded by the build, so edits to it did nothing).

---

## Recipes

### A screen

```tsx
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Target } from "lucide-react";

<div className="space-y-4">
  <PageHeader
    title="Content Gap Analysis"
    description="What competitors cover, what you're missing, and where to differentiate."
    icon={<Target size={17} />}
    tone="warning"
    actions={<button className="...">Re-run</button>}
  />

  <Card>
    <CardHeader actions={<button className="...">View all</button>}>
      <CardTitle>Top gaps</CardTitle>
    </CardHeader>
    <CardBody>…</CardBody>
  </Card>
</div>
```

Do not set a size on the icon's colour — the tile's `tone` supplies it.

### A panel

```tsx
<Card>…</Card>                          {/* white, border, shadow-xs, p-4 */}
<Card padding="lg">…</Card>             {/* p-5 */}
<Card variant="inset">…</Card>          {/* nested inside another Card, p-3 */}
<Card variant="flush">…</Card>          {/* no padding, clips a table to the edge */}
```

`inset` is for a panel *inside* a panel. Use it instead of a second `default`
card — stacked shadows are what make a dashboard look muddy.

### A number with a label

Do **not** write a new one. Three already exist, in order of preference:

- `TruthfulKpiCard` (`ui/truthful-state.tsx`) — when the figure has a
  provenance to state (measured / estimated / not connected). Prefer this: it
  is the one that cannot silently present an unmeasured number as a fact.
- `MetricCard` (`ui/metric-card.tsx`) — figure with a delta and a sparkline.
- `Card variant="inset"` with `text-[16px] font-bold text-brand-950` — a bare
  stat inside a larger panel.

### Loading, empty and error

Never hand-roll these; they are the states most often forgotten and most
visibly inconsistent when they are.

```tsx
import { QueryState } from "@/components/ui/query-state";

<QueryState
  isLoading={q.isLoading}
  error={q.error}
  isEmpty={!q.data?.length}
  emptyTitle="No gaps found yet"
  emptyBody="Run an analysis to populate this list."
>
  {/* the real content */}
</QueryState>
```

For "we cannot show this because something upstream is missing", use the
named states in `ui/truthful-state.tsx`: `NotConfiguredState`,
`NotConnectedState`, `NoDataState`, `PartialDataState`, `FailedState`.

### A table

Wrap in `<Card variant="flush">` and use the `.data-table` class from
`globals.css` — it already styles `th`, `td`, zebra rows and hover.

```tsx
<Card variant="flush">
  <div className="scroll-x">
    <table className="data-table">…</table>
  </div>
</Card>
```

### A status chip

`Badge` from `ui/badge.tsx` — variants `success | warning | error | info |
pending | default`. Plus `TrendBadge` for a delta and `StatusDot` for a dot.

### Type scale

`globals.css` defines `.text-display`, `.text-h1`, `.text-h2`, `.text-h3`,
`.text-body`, `.text-small`. Inside the dashboard, section titles are
`text-sm font-bold text-brand-950` (what `CardTitle` renders) and page titles
are `text-[15px] font-semibold text-brand-950` (what `PageHeader` renders).

---

## Known debt

Worth knowing so you don't copy it:

- **`ui/button.tsx` is off-palette.** It uses `gray-*`, a hardcoded box-shadow
  and `rounded-[10px]`. Most screens bypass it and hand-roll a button as
  `rounded-lg border px-3 py-1.5 text-[12px] font-medium text-brand-600
  hover:bg-brand-100`. Follow the hand-rolled form for now; the component needs
  a pass of its own.
- **Dead `dark:` variants.** 37 files carry `dark:` classes and `globals.css`
  has a full `.dark` block, but nothing ever adds the `.dark` class. Don't add
  more. Removing them, or restoring a real toggle, is an open decision.
- **~7,000 stock-palette classes** remain in existing files. They are
  baselined, not blessed — see below.

---

## The guard

`npm run check:design` (wired into `lint` and `build`) fails the build when a
file gains stock-palette classes or typed hexes.

It is a **ratchet**, not a ban. `scripts/design-token-baseline.json` records
what each file had when the guard landed; the build fails only when a count
goes **up**, or a **new** file arrives with any. Existing code is left alone —
rewriting 188 files in one pass would break more than it fixes.

When you clean a file up, lock the gain in:

```bash
node scripts/check-design-tokens.mjs --update
```

If a raise is genuinely correct — a chart that needs a literal colour, say —
run the same command and say why in the commit message. The baseline shrinking
over time is the point; when it hits zero, delete the guard.
