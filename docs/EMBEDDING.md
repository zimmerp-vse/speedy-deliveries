# Embedding Dash Delivery in a Master Platform

Dash Delivery is a self-contained React app that runs in an `<iframe>` and communicates with the embedding ("master") page via `window.postMessage`.

## Quick start

```tsx
import { useEffect, useRef } from 'react';

const MINIGAME_URL = 'https://your-deployed-minigame.example.com';
const MINIGAME_ORIGIN = new URL(MINIGAME_URL).origin;

export function MinigameFrame({ player, onGameEnd }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const sessionId = useRef(crypto.randomUUID());

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== MINIGAME_ORIGIN) return;
      const m = e.data;
      if (!m || m.source !== 'dash-delivery') return;

      if (m.type === 'READY') {
        ref.current?.contentWindow?.postMessage({
          source: 'dash-delivery',
          type: 'INIT',
          version: 1,
          payload: {
            session: { sessionId: sessionId.current },
            player: { nickname: player.name, id: player.id },
            difficulty: {
              totalRounds: 5,
              tripDurationMs: 30000,
              carSpawnRate: 0.04,
              obstacleSpawnRate: 0.008,
              pedestrianSpawnRate: 0.004,
              malfunctionProbability: 0.3,
            },
            economy: {
              deliveryReward: 750,
              carCollisionCost: 400,
              obstacleCollisionCost: 250,
              pedestrianCollisionCost: 200,
              malfunctionCost: 300,
            },
            ui: { showQuitButton: true },
            extra: { questId: 'q-123' }, // anything you want echoed back
          }
        }, MINIGAME_ORIGIN);
      } else if (m.type === 'ROUND_END') {
        // m.payload: { round, outcome, timeMs, scene, moneyEarned, moneyLost, moneyBalance, sessionId }
        console.log('Round ended', m.payload);
      } else if (m.type === 'GAME_END') {
        onGameEnd(m.payload); // GameSummary
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [player, onGameEnd]);

  return <iframe ref={ref} src={MINIGAME_URL} style={{ width: '100%', height: '100%', border: 0 }} />;
}
```

## Protocol

All messages: `{ source: 'dash-delivery', type, version: 1, payload }`.

### Master → minigame

| Type     | When                                                  |
|----------|-------------------------------------------------------|
| `INIT`   | Once, after iframe sends `READY` (or before — buffered). |
| `QUIT`   | Force the game to end now and emit `GAME_END`.        |
| `PAUSE`  | Reserved (not yet implemented).                       |
| `RESUME` | Reserved (not yet implemented).                       |

### `INIT` payload

```ts
{
  session?: { sessionId?: string },
  player?: { nickname?: string, id?: string, avatarUrl?: string },
  difficulty?: {
    totalRounds?: number,                 // default 10
    tripDurationMs?: number,              // default 45000
    carSpawnRate?: number,                // 0..1, default 0.030
    obstacleSpawnRate?: number,           // 0..1, default 0.005
    pedestrianSpawnRate?: number,         // 0..1, default 0.003
    malfunctionProbability?: number,      // 0..1, default 0.25
    malfunctionFirstWindowSec?: { min?: number, max?: number }, // default 8..22
    maxSpeed?: number,                    // default 120
    acceleration?: number,                // default 18
    braking?: number,                     // default 80
    schedule?: Array<{                    // optional per-round conditions, see below
      tripDurationMs?: number,
      carSpawnRate?: number,
      obstacleSpawnRate?: number,
      pedestrianSpawnRate?: number,
      sceneIndex?: number,                // 0-based index into the 10 scenes
    }>,
  },
  economy?: {
    startingMoney?: number,
    deliveryReward?: number,
    carCollisionCost?: number,
    obstacleCollisionCost?: number,
    pedestrianCollisionCost?: number,
    malfunctionCost?: number,
  },
  ui?: {
    showHud?: boolean,
    showQuitButton?: boolean,
    locale?: string,
    autoStart?: boolean,                  // start round 1 right after INIT, skipping the start screen
    showRoundTotal?: boolean,             // default true; false shows "ROUND 3" instead of "ROUND 3/10"
  },
  extra?: Record<string, unknown>, // forward-compat slot, echoed back on GAME_END
}
```

### Per-round schedule (optional)

`difficulty.schedule` sets the conditions of each round. Entry `i` (0-based) is applied at the
start of round `i + 1`, on top of the base difficulty (the other `difficulty` fields, or the
defaults). Rules:

- A field left out of an entry falls back to the **base** value, not to the previous round's value.
- `sceneIndex` picks the scene (0 to 9). Without it the scene rotates by round number, as always:
  round `r` gets scene `(r - 1) mod 10`.
- Values are clamped like the base values (trip 5 000 to 600 000 ms, rates 0 to 1); a scene index
  out of range or a non-number is ignored. At most 100 entries are read.
- With a schedule and no `totalRounds`, `totalRounds` is the schedule's length. With both,
  `totalRounds` wins; rounds beyond the schedule use the base values.
- Without a schedule (or with an empty one) the game behaves exactly as before.
- Send one `INIT` per iframe load. To start over with a new schedule, reload the iframe.

`ROUND_START` and `ROUND_END` carry `applied`, the conditions actually in force for that round,
with or without a schedule. When `INIT` carried a schedule, `INIT_ACK.appliedConfig` also has
`scheduleLength`.

### Minigame → master

| Type           | Payload                                                                 |
|----------------|-------------------------------------------------------------------------|
| `READY`        | `{ protocolVersion }`                                                   |
| `INIT_ACK`     | `{ appliedConfig, sessionId }`                                          |
| `ROUND_START`  | `{ sessionId, round, scene, deliveryType, startedAt, applied }`         |
| `ROUND_END`    | `{ sessionId, round, outcome, timeMs, scene, moneyEarned, moneyLost, moneyBalance, applied }` |
| `GAME_END`     | `GameSummary` (see below)                                               |
| `ERROR`        | `{ code, message }`                                                     |

`applied` is `{ tripDurationMs, carSpawnRate, obstacleSpawnRate, pedestrianSpawnRate, sceneIndex }`.
`startedAt` is the player's clock (`Date.now()`); a host that needs reliable timing should use
its own server time.

Every finished round sends `ROUND_END`, the last one included; after the last round, `GAME_END`
follows. (Before 2026-11 the last round sent only `GAME_END` and was missing from its `rounds`.)

### Round lifecycle and `QUIT`

1. `ROUND_START` when the car starts.
2. The round ends with an outcome. A delivery plays a short celebration (Space skips it); a crash,
   timeout or malfunction plays a crash scene that ends by itself after 4 s (Space skips it).
3. Then `ROUND_END` is sent and a result screen shows the outcome, the money won or lost, the scene
   and the time, with a **NEXT DELIVERY** button. It does not move on by itself; the next round
   (and its `ROUND_START`) begins only when the player clicks. A host that measures time should
   expect this idle time between rounds.
4. After the last round: `ROUND_END`, then `GAME_END` with `endedReason: 'completed'` and the
   game-over screen.

`QUIT` ends the game at once and sends `GAME_END` with `endedReason: 'quit'`:

- **Between rounds** (result screen): clean; every finished round has had its `ROUND_END`.
- **During a round**: the round in progress is dropped. It had a `ROUND_START` but gets no
  `ROUND_END` and is not in `GAME_END.rounds`.
- **During the celebration or crash scene**: the outcome is already decided but its `ROUND_END`
  has not been sent yet, so this round is dropped too. To keep it, send `QUIT` only after the
  round's `ROUND_END`.

After `QUIT` the iframe shows the game-over screen (cash, deliveries out of `totalRounds`,
accidents). A host that does not want players to see it should hide the iframe.

### `outcome` values

- `delivered` — successful delivery
- `crash_car` — collided with NPC vehicle
- `crash_obstacle` — hit a road obstacle
- `crash_pedestrian` — hit a pedestrian
- `malfunction` — mechanical failure ended the round
- `timeout` — ran out of time

### `GameSummary` (sent on completion or `QUIT`)

```ts
{
  sessionId?: string,
  player?: { nickname?, id?, avatarUrl? },
  endedReason: 'completed' | 'quit',
  rounds: Array<{
    round: number,
    outcome: RoundOutcome,
    timeMs: number,
    scene: string,
    moneyEarned: number,
    moneyLost: number,
    moneyBalance: number,
  }>,
  totals: {
    deliveries: number,
    money: number,
    accidents: { car, obstacle, pedestrian, malfunction, timeout },
  },
  extra?: Record<string, unknown>, // echoed from INIT
}
```

## Security

- The minigame validates `event.origin` against `VITE_EMBED_ALLOWED_ORIGINS` (comma-separated) at build time. Leave unset for permissive dev mode.
- The master should always validate `event.origin` against the minigame's origin.
- Always pass the minigame origin (not `'*'`) as the second argument to `postMessage` in production.

## Local testing

A standalone host page is available at `/embed-example.html` when running this project. It boots an iframe of itself and prints every message in a sidebar.
