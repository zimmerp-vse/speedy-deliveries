
# Master Testing Platform for Dash Delivery

Build a master platform on top of this project that registers volunteer users, lets them pick a testing regime (T1/T2/T3), embeds the game in an iframe, and stores the full structured dataset for admin export.

## Routes & flow

- `/` — Landing page. If logged in: redirect to `/play`. If not: links to `/login` and `/register`.
- `/register` — Email + password + nickname + age + date of birth (age stored as integer, validated 6–120).
- `/login` — Email + password sign-in.
- `/play` — Authenticated regime picker. Three cards: T1 (Easy/Medium/Hard buttons), T2 (form with all difficulty/economy params), T3 (single "Generate & play" button — params randomized in admin-defined ranges, shown for transparency before launch).
- `/session/:id` — Embeds the existing game (`/game`) in an iframe, sends INIT with chosen params, captures all `ROUND_END` / `GAME_END` events, persists them. Shows a summary screen at the end.
- `/admin` — Admin-only (whitelist: nickname `zimmerp`). Tabs: **Presets** (edit T1 easy/medium/hard), **T3 Ranges** (min/max for each random param), **Sessions** (table of all sessions, filters, "Export CSV" button), **Users** (read-only list).

The current game stays at `/game` — it's the iframe source. The existing `DrivingGame` component is unchanged; only the host page wraps it.

## Database (Lovable Cloud)

- `profiles` — `id` (FK auth.users), `nickname` (unique), `age`, `date_of_birth`, `created_at`. Auto-created via trigger on signup.
- `user_roles` — `id`, `user_id`, `role` (enum `admin`|`user`). Separate table per security rules. `has_role()` SECURITY DEFINER function for RLS.
- `difficulty_presets` — `id`, `regime` (`T1_easy`|`T1_medium`|`T1_hard`), `params` (jsonb of full InitPayload difficulty+economy), `updated_at`, `updated_by`. Seeded with sensible defaults.
- `t3_ranges` — single-row config: `params_min` jsonb, `params_max` jsonb. Admin edits.
- `game_sessions` — `id`, `user_id`, `nickname` (denormalized for export), `regime` (T1_easy/medium/hard, T2, T3), `params` jsonb (the resolved InitPayload sent to game), `started_at`, `ended_at`, `ended_reason` (completed/quit/abandoned), `totals` jsonb (deliveries, money, accidents).
- `round_events` — `id`, `session_id`, `round_number`, `outcome` (delivered/crash_car/crash_obstacle/crash_pedestrian/malfunction/timeout), `time_ms`, `scene`, `money_earned`, `money_lost`, `money_balance`, `created_at`.

RLS: users read/write only their own sessions and rounds; admins read all. Presets/ranges readable by all authenticated, writable by admins only.

## Admin whitelist

On signup, a DB trigger checks if `NEW.raw_user_meta_data->>'nickname' = 'zimmerp'` and inserts an `admin` role; otherwise inserts `user`. (Can later be managed via admin UI.)

## CSV export

Admin clicks "Export CSV". One row per round (joined session + round). Columns:
`session_id, user_id, nickname, age, regime, started_at, ended_at, ended_reason, total_rounds, trip_duration_ms, car_spawn_rate, obstacle_spawn_rate, pedestrian_spawn_rate, malfunction_probability, max_speed, acceleration, braking, delivery_reward, car_collision_cost, obstacle_collision_cost, pedestrian_collision_cost, malfunction_cost, round_number, outcome, time_ms, scene, money_earned, money_lost, money_balance`

Generated client-side from a single Supabase query (no edge function needed).

## Game integration

The existing `postMessage` protocol (v1) already supports everything we need. The session host page:
1. Renders `<iframe src="/game">`.
2. On `READY` → posts `INIT` with the resolved params + `session: { sessionId }` + `player: { nickname }` + `ui: { showQuitButton: true }`.
3. On `ROUND_END` → inserts a `round_events` row.
4. On `GAME_END` → updates the `game_sessions` row with `ended_reason`, `ended_at`, `totals`.
5. "Abandoned" sessions (user closes tab) stay with `ended_reason = null` — admin can filter them out.

## T1 default presets (seeded)

| Param | Easy | Medium | Hard |
|---|---|---|---|
| totalRounds | 5 | 8 | 10 |
| tripDurationMs | 45000 | 35000 | 25000 |
| carSpawnRate | 0.02 | 0.04 | 0.07 |
| obstacleSpawnRate | 0.003 | 0.006 | 0.012 |
| pedestrianSpawnRate | 0.002 | 0.004 | 0.008 |
| malfunctionProbability | 0.1 | 0.25 | 0.45 |
| deliveryReward | 600 | 500 | 400 |
| carCollisionCost | 200 | 300 | 500 |

Admin can change any of these later.

## T3 default ranges

Each numeric difficulty/economy field gets `[min, max]`; on T3 launch we pick a uniform random value per field. Defaults sit just outside the easy/hard bracket so randomized games span the meaningful difficulty space.

## Files to create

- `src/pages/Landing.tsx`, `Login.tsx`, `Register.tsx`, `Play.tsx`, `SessionHost.tsx`, `Admin.tsx`
- `src/pages/Game.tsx` — moves current `Index.tsx` game-rendering logic here at route `/game`
- `src/components/regime/T1Card.tsx`, `T2Form.tsx`, `T3Card.tsx`
- `src/components/admin/PresetsEditor.tsx`, `T3RangesEditor.tsx`, `SessionsTable.tsx`, `UsersTable.tsx`
- `src/lib/auth.ts` — `useAuth` hook (session + onAuthStateChange), `useIsAdmin` hook
- `src/lib/csv.ts` — flatten + download helper
- `src/lib/regimes.ts` — preset/range fetchers, T3 randomizer
- Supabase migration: enums, tables, RLS, signup trigger, seed data

## Files to modify

- `src/App.tsx` — add all new routes, auth-guarded wrapper
- `src/pages/Index.tsx` — becomes the landing redirect (or replaced by `Landing.tsx`)

## Out of scope (this iteration)

- Email verification flow (will disable "Confirm email" in auth settings for faster volunteer onboarding; user can re-enable later)
- Promoting other users to admin via UI (only zimmerp via signup trigger; manual DB edits possible)
- Resuming abandoned sessions
- Per-user dashboards (volunteers just play; admin sees all)

After approval I'll implement everything in one pass and seed the T1 presets and T3 ranges.
