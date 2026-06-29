# Project conventions

Notes for anyone (humans or Claude Code) working in this repo. Add to it
whenever a convention emerges that isn't enforced by tooling.

## Color conventions

Greens and reds are **load-bearing semantic signals** in this product. Reserve
them strictly:

| Use                                   | Color                                     |
| ------------------------------------- | ----------------------------------------- |
| Price up (day, period, intraday)      | **Green** (`emerald-500` / `emerald-600`) |
| Price down                            | **Red** (`red-500` / `red-600`)           |
| Sentiment — positive                  | **Green**                                 |
| Sentiment — negative                  | **Red**                                   |
| Sentiment — neutral                   | **Amber** (`amber-500`/`amber-600`) — never gray |
| Source / platform (YouTube, Reddit, …)| Anything **except** green and red         |

Why: a user scanning a chart should be able to map color to meaning without
thinking. If YouTube bars are red, they read "negative". If a Reddit pill is
green, it reads "bullish". Source identity must be visually orthogonal to
price/sentiment direction.

YouTube's brand red is intentionally replaced with **slate** in this app
(`SOURCE_HEX.youtube`). Reddit gets **violet**. Add new platforms to
`resources/js/lib/colors.ts` and pick a non-stoplight color.

### Where to import from

All domain colors live in [`resources/js/lib/colors.ts`](resources/js/lib/colors.ts):

- `PRICE_HEX.up` / `PRICE_HEX.down` — for SVG fills, strokes, inline styles
- `PRICE_TEXT_CLASS.up` / `PRICE_TEXT_CLASS.down` — for Tailwind text colors
- `SENTIMENT_HEX[sentiment]` — SVG/inline
- `SENTIMENT_TEXT_CLASS[sentiment]` — Tailwind
- `SOURCE_HEX.youtube` / `SOURCE_HEX.reddit` — SVG/inline

Don't hardcode `#10b981`, `#ef4444`, `text-emerald-600`, etc. in components.
Import from `lib/colors.ts` so a palette tweak touches one file.

### Out of scope for this rule

These aren't "domain visualization" so the rule doesn't apply:

- Form-field error text / borders (`input-error.tsx`) — keep standard red.
- Destructive button affordances (`delete-user.tsx`) — keep red.
- Success messages in auth flows ("check your email") — keep green.

If you're unsure whether a use is "domain" or "UI affordance": if the color
carries information about a stock/sentiment/source, it's domain — follow the
rule.

## Stack quick-reference

- Laravel + Inertia + React 19 + TypeScript
- Tailwind v4 (CSS-variable theme tokens in `resources/css/app.css`)
- Radix UI primitives + shadcn (`new-york` style, `neutral` base)
- Recharts for non-trivial charts; hand-rolled SVG for tiny sparklines
- EODHD price data flows through `/api/price/...` and `lib/eodhd.ts`

## Per-brand theming

The app is multi-brand: `<html data-brand="stocks">` or `data-brand="startups"`
switches the palette via CSS variables. Components should style with semantic
tokens (`bg-primary`, `text-muted-foreground`, `var(--border)`) rather than
hardcoded Tailwind palette colors — that's what makes brand + dark-mode
composition free.

The exception is the color rule above: price/sentiment/source colors are
**deliberately brand-independent** so the meaning stays stable across brands.
