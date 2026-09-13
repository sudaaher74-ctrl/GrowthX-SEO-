<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Before you add anything to the UI

Read `docs/design-system.md` first. It is short, and it is the difference
between a change that looks like the rest of the product and one that visibly
does not.

The two things it will tell you, so you at least know they exist:

1. **Compose a primitive from `src/components/ui/console.tsx`** — `Panel`,
   `PageHeader`, `Tabs`, `Table`, `Kpi`, `Pill`, `ActionButton`. 38 files
   already do. Do not hand-roll a `rounded-xl border bg-white` panel; 773 of
   those already exist and no two of them agree. (`ui/card.tsx` and
   `ui/page-header.tsx` duplicate two of these — see the correction in
   `docs/design-system.md` — so prefer `console.tsx`.)
2. **Use the token scale, not Tailwind's stock palette.** `text-brand-950`,
   not `text-slate-900`. A bare `border` is already the hairline token. Tokens
   live in the `@theme` block of `src/app/globals.css`, which is the only
   source of theme truth — there is no `tailwind.config.ts`, and adding one
   back will not do what you expect under Tailwind v4.

`npm run check:design` enforces the second rule on new code and runs as part of
`lint` and `build`.
