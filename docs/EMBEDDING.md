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
  },
  economy?: {
    startingMoney?: number,
    deliveryReward?: number,
    carCollisionCost?: number,
    obstacleCollisionCost?: number,
    pedestrianCollisionCost?: number,
    malfunctionCost?: number,
  },
  ui?: { showHud?: boolean, showQuitButton?: boolean, locale?: string },
  extra?: Record<string, unknown>, // forward-compat slot, echoed back on GAME_END
}
```

### Minigame → master

| Type           | Payload                                                                 |
|----------------|-------------------------------------------------------------------------|
| `READY`        | `{ protocolVersion }`                                                   |
| `INIT_ACK`     | `{ appliedConfig, sessionId }`                                          |
| `ROUND_START`  | `{ sessionId, round, scene, deliveryType, startedAt }`                  |
| `ROUND_END`    | `{ sessionId, round, outcome, timeMs, scene, moneyEarned, moneyLost, moneyBalance }` |
| `GAME_END`     | `GameSummary` (see below)                                               |
| `ERROR`        | `{ code, message }`                                                     |

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
