# Design system

How to add something to this app so it looks like it was always there.

This is a **light-only** product (`src/components/providers.tsx` — there is no
theme provider and no toggle). Anything you write is rendered on white.

---

## The one rule

> Compose a primitive from `src/components/ui/console.tsx`. Do not build a new panel.

`console.tsx` is the console design system and the first place to look. It is
already token-based, and **38 files** build on it:

| Need | Primitive |
| --- | --- |
| Page title + actions | `PageHeader` |
| A panel | `Panel` (`padded`, optional `title` / `subtitle` / `actions`) |
| Page-level tabs | `Tabs` |
| A stat tile | `Kpi` |
| A table | `Table` + `Th` / `Tr` / `Td` |
| A status pill | `Pill`, `StatusNote` |
| A button in a header | `ActionButton` |
| "We can't show this" | `NotConnected` |

Nearly every "our change doesn't match the rest of the site" problem traces to
the same thing: there are **773 hand-rolled** `rounded-* border bg-*` panels
against 38 files that use `Panel`. Each hand-rolled one picked its own radius,
padding, border tint and shadow, so no two sections agreed.

### A correction, and the duplication it left

An earlier pass of this document claimed no `Card`, `PageHeader` or table
primitive existed. That was wrong — `console.tsx` had all three. Acting on it
added `ui/card.tsx` and `ui/page-header.tsx`, which **duplicate** `Panel` and
`PageHeader`.

So there are currently two of each. Until that is consolidated:

- **Prefer `console.tsx`.** It is what the other 38 files use.
- `ui/card.tsx` is only worth reaching for when you need its `inset` or `flush`
  variant, which `Panel` has no equivalent of.
- `ui/page-header.tsx` has one caller and should be folded into
  `console.tsx`'s `PageHeader`. Do not add new callers.

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
import { ActionButton, Kpi, PageHeader, Panel, Tabs } from "@/components/ui/console";

<div className="space-y-4">
  <PageHeader
    title="Content Gap Analysis"
    subtitle="What competitors cover, what you're missing, and where to differentiate."
    actions={<ActionButton variant="secondary">Re-run</ActionButton>}
  />

  <Panel title="Top gaps" actions={<ActionButton>View all</ActionButton>} padded>
    …
  </Panel>
</div>
```

### A panel

```tsx
<Panel padded>…</Panel>                       {/* white, border, rounded-xl, p-4 */}
<Panel title="Top gaps" padded>…</Panel>      {/* with a header row */}
<Panel>…</Panel>                              {/* no padding — for a table */}
```

`ui/card.tsx` adds two variants `Panel` has no equivalent of: `inset` for a
panel nested inside another (use it rather than a second raised panel — stacked
shadows are what make a dashboard look muddy), and `flush` for one that clips
its contents to the edge. Reach for those only when you need them.

### A number with a label

Do **not** write a new one. Three already exist, in order of preference:

- `TruthfulKpiCard` (`ui/truthful-state.tsx`) — when the figure has a
  provenance to state (measured / estimated / not connected). Prefer this: it
  is the one that cannot silently present an unmeasured number as a fact.
- `MetricCard` (`ui/metric-card.tsx`) — figure with a delta and a sparkline.
- `Kpi` (`ui/console.tsx`) — the shared stat tile, with optional delta, meter
  and sparkline. This is the default for a figure in a row of figures.
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

`Table` + `Th` / `Tr` / `Td` from `console.tsx`, inside a `Panel`. `Table`
handles the horizontal overflow, and `Tr` handles the row rule and hover.

```tsx
<Panel>
  <Table minWidth={980}>
    <thead>
      <tr><Th>Page</Th><Th align="right">Actions</Th></tr>
    </thead>
    <tbody>
      <Tr><Td>…</Td><Td align="right">…</Td></Tr>
    </tbody>
  </Table>
</Panel>
```

(The `.data-table` class in `globals.css` predates these and styles a raw
`<table>`. Both exist; prefer the components.)

### A status chip

`Badge` from `ui/badge.tsx` — variants `success | warning | error | info |
pending | default`. Plus `TrendBadge` for a delta and `StatusDot` for a dot.

### Type scale

`globals.css` defines `.text-display`, `.text-h1`, `.text-h2`, `.text-h3`,
`.text-body`, `.text-small`. Inside the dashboard, section titles are
`text-[13px] font-semibold text-brand-950` (what `Panel`'s title renders) and
page titles are `text-[26px] font-bold text-brand-950` (what `console.tsx`'s
`PageHeader` renders).

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
- **Two `PageHeader`s and two panel components.** See the correction above.
  `console.tsx` is the one to use; the pair in `ui/` needs consolidating.

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
