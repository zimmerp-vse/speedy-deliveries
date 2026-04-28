## Goal

Make this game embeddable as an iframe minigame inside a master React platform. The master sends player identity, difficulty, and economy parameters in; the minigame streams round-by-round results back and a final summary when finished or quit.

Yes — iframe + `window.postMessage` is the standard, framework-agnostic approach. It avoids cross-bundle React conflicts, isolates state/audio, and works regardless of what stack the master uses.

## Protocol overview

```text
master (parent)                    minigame (iframe)
      |                                     |
      |  ───── INIT (config) ─────────────▶ |
      |                                     | (validates, applies overrides,
      |                                     |  shows Start screen w/ player name)
      |  ◀───── READY ─────────────────────|
      |                                     |
      |                                     | (player plays round 1)
      |  ◀───── ROUND_END (result) ────────|
      |                                     |
      |                                     | ... (rounds 2..N)
      |                                     |
      |  ◀───── GAME_END (summary) ────────|
      |                                     |
      |  ───── QUIT ──────────────────────▶ | (optional, master forces exit)
      |  ◀───── GAME_END (summary) ────────|
```

All messages are JSON `{ type, version: 1, payload }`. Origin is validated on both sides.

### Messages from master → minigame

- `INIT` — sent once after iframe loads. Payload:
  - `player`: `{ nickname: string, id?: string, avatarUrl?: string }`
  - `difficulty`: all optional, override `GAME_CONFIG`:
    - `totalRounds` (int)
    - `tripDurationMs` (int) — max time per delivery
    - `carSpawnRate` (0..1)
    - `obstacleSpawnRate` (0..1)
    - `pedestrianSpawnRate` (0..1)
    - `malfunctionProbability` (0..1) — current hardcoded 0.25
    - `malfunctionFirstWindowSec` `{ min, max }` — current 8..22s
    - `maxSpeed`, `acceleration`, `braking` (advanced tuning)
  - `economy`: all optional
    - `startingMoney`
    - `deliveryReward`
    - `carCollisionCost`
    - `obstacleCollisionCost`
    - `pedestrianCollisionCost`
    - `malfunctionCost` (new — currently reuses obstacleCost)
  - `ui`: `{ showHud?: boolean, showQuitButton?: boolean, locale?: string }`
  - `session`: `{ sessionId: string }` — echoed back in every outbound event
  - `extra`: `Record<string, unknown>` — **forward-compat slot**, ignored today, echoed in `GAME_END`
- `QUIT` — master asks game to end now. Game emits `GAME_END` with what's been played.
- `PAUSE` / `RESUME` — optional, pause loop and audio.

### Messages from minigame → master

- `READY` — sent after iframe mounts and is listening. Master should wait for this before sending `INIT` (or master can send `INIT` immediately and minigame buffers it).
- `INIT_ACK` — `{ appliedConfig }` so the master can verify which overrides took effect.
- `ROUND_START` — `{ round, scene, deliveryType, startedAt }`
- `ROUND_END` — per round, mirrors current `RoundResult` plus richer outcome:
  - `round` (1..N)
  - `outcome`: `'delivered' | 'crash_car' | 'crash_obstacle' | 'crash_pedestrian' | 'malfunction' | 'timeout'`
  - `timeMs` (round duration)
  - `moneyEarned`, `moneyLost`, `moneyBalance`
  - `scene`
- `GAME_END` — sent when all rounds done OR on `QUIT`:
  - `sessionId`, `player`, `endedReason: 'completed' | 'quit'`
  - `rounds: RoundEvent[]` (full history)
  - `totals`: `{ deliveries, accidents: { car, obstacle, pedestrian, malfunction, timeout }, money }`
  - `extra` (echoed from INIT)
- `ERROR` — `{ code, message }` for invalid INIT payloads.

Outcome distinction: today the engine collapses malfunction → `accidentType: 'obstacle'` with emoji `🔧`, and timeout → `accidentType: undefined`. The protocol will report these as distinct `outcome` values so the master can score them separately.

## Implementation

### New files

- `src/integration/protocol.ts` — TypeScript types for every message, version constant, type guards.
- `src/integration/host.ts` — small class used by `DrivingGame`:
  - validates `event.origin` against an allow-list (configurable; default `*` with warning in dev)
  - buffers an early `INIT` arriving before React mount
  - exposes `onInit`, `sendReady`, `sendRoundStart`, `sendRoundEnd`, `sendGameEnd`, `sendError`
  - listens for `QUIT` / `PAUSE` / `RESUME`
- `src/integration/applyConfig.ts` — merges `INIT.difficulty` + `INIT.economy` over `GAME_CONFIG` and returns a per-session config object. We will also refactor the engine to read from an injected config rather than the imported `GAME_CONFIG` singleton (small change: pass `config` into `GameEngine` constructor; default = `GAME_CONFIG`).
- `public/embed-example.html` — minimal standalone host page demonstrating the protocol (useful for QA without building the master).
- `docs/EMBEDDING.md` — short integration guide for the master platform team, including a copy-pastable React `<MinigameFrame />` component.

### Edits

- `src/game/config.ts`
  - Add `malfunctionProbability`, `malfunctionFirstWindowMinSec`, `malfunctionFirstWindowMaxSec`, `malfunctionCost` so they're tunable.
  - Export a `GameConfig` type and a `mergeConfig(base, overrides)` helper.
- `src/game/engine.ts`
  - Constructor takes optional `config: GameConfig`; replace `GAME_CONFIG` references inside engine with `this.config`.
  - In `endRound`, accept a richer `outcome` string and pass it through to callbacks so the host bridge can forward it.
  - Distinguish malfunction vs obstacle vs timeout when calling `endRound` (already separated internally — just expose).
  - Add `quit()` method that forces `GAME_END` with current data.
  - Optional `pause()` / `resume()` that freeze the RAF loop and mute sounds.
- `src/components/DrivingGame.tsx`
  - On mount, instantiate `host` and `sendReady()`.
  - On `INIT`: build engine with merged config, set player nickname, send `INIT_ACK`.
  - Wire `onRoundEnd` → `host.sendRoundEnd`, `onGameEnd` → `host.sendGameEnd`.
  - Handle `QUIT` → `engine.quit()`.
- `src/components/StartScreen.tsx`
  - Show `player.nickname` if provided ("Welcome, {nickname}").
  - Optional "Quit" button when embedded (`ui.showQuitButton`).
- `src/components/GameOverScreen.tsx`
  - When embedded, replace "DATA READY FOR MASTER PLATFORM" with a "Return" button that posts `GAME_END` again and the master closes the iframe.

### Security & robustness

- Validate `event.origin` against a configurable allow-list (env var `VITE_EMBED_ALLOWED_ORIGINS`, comma-separated; `*` allowed only in dev).
- Validate INIT payload with a small zod-like manual validator (no new deps); send `ERROR` on bad shape.
- Version field on every message; reject mismatched major versions with `ERROR`.
- Always echo `sessionId` and `extra` so the master can correlate.
- `extra: Record<string, unknown>` is the forward-compat slot you asked for — anything the master adds today is preserved in `GAME_END` without code changes here.

### Master-side usage (sketch, lives in `docs/EMBEDDING.md`)

```tsx
<iframe ref={ref} src={MINIGAME_URL} onLoad={() => {
  ref.current!.contentWindow!.postMessage({
    type: 'INIT', version: 1, payload: {
      session: { sessionId: crypto.randomUUID() },
      player: { nickname: 'Alice' },
      difficulty: { totalRounds: 5, carSpawnRate: 0.05, malfunctionProbability: 0.4 },
      economy: { deliveryReward: 750, carCollisionCost: 400 },
      extra: { questId: 'abc-123' },
    }
  }, MINIGAME_ORIGIN);
}} />
```

Master listens with `window.addEventListener('message', ...)`, filters by origin, switches on `type`, persists `ROUND_END`s, finalizes on `GAME_END`.

## Out of scope (can add later)

- Cryptographic signing of results (needs a backend).
- Leaderboards / persistence — master's responsibility.
- Resizing protocol (iframe currently fills its container).
