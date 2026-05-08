# Dash Delivery Lab

Research platform for the **Charming Ride / Spanilá jízda** actuarial education project. A delivery-driving minigame plus a testing harness that registers volunteers, runs the game in an iframe under configurable difficulty regimes, and records per-round outcomes for later analysis.

The minigame itself is self-contained and embeddable — see `docs/EMBEDDING.md` for the `postMessage` protocol. Anything outside the iframe (registration, regime selection, result collection, admin) is the harness.

## Stack

- Vite + React 18 + TypeScript + SWC
- Tailwind CSS + shadcn/ui (Radix primitives)
- React Router 6, React Query, react-hook-form + zod
- Supabase (auth + Postgres + RLS)
- Vitest + Playwright (test scaffolding present, suites largely empty)

## Local development

```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # production bundle in dist/
npm run lint
npm test
```

You'll need a `.env` file (gitignored). Copy `.env.example` and fill in your Supabase project values:

```
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"
```

`VITE_EMBED_ALLOWED_ORIGINS` is optional — comma-separated allow-list for the iframe-host origin check (`src/integration/host.ts`). Leave unset for permissive dev.

## Deployment

Production runs on Vercel (Vite preset, output `dist/`). The single non-default piece is `vercel.json` at the repo root, which adds an SPA rewrite so direct navigation to `/play`, `/admin`, `/session/:id` resolves to `index.html`.

Schema lives in `supabase/migrations/` and is applied via the Supabase CLI (`supabase db push`) or by pasting the files into the SQL Editor. Seven tables, two enums, one signup trigger, one private RLS helper. No edge functions, no storage buckets.

## Routes

| Route | What |
|---|---|
| `/` | Landing |
| `/login`, `/register` | Auth (email + password) |
| `/game` | Standalone minigame (also used as iframe `src`) |
| `/play` | Auth-required: regime picker (T1 preset / T2 custom / T3 random) |
| `/session/:id` | Auth-required: harness wrapping the iframe game |
| `/admin` | Admin-only: presets, T3 ranges, sessions, feedback, CSV export |

## Project context

This is one piece of a larger educational project. The umbrella project's planning docs (CONTEXT, ROADMAP, design specification, parameter calculator) live one level up at `Charming ride/`. The migration history off Lovable.dev is documented in `Charming ride/docs/migration-from-lovable.md`.
