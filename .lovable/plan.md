

## Fix variable game speed across devices

The game currently runs in slow-motion on weaker desktops and too fast on some mobiles. Root cause: the simulation advances by `dt` per `requestAnimationFrame` tick, but `dt` is **capped at 50ms**. When the renderer takes longer than that per frame (which happens on slower machines because the renderer redraws hundreds of gradients, emoji, and scenery layers every frame), simulated time falls behind real time — so a 20-second trip can feel like a minute. On very small mobile canvases the renderer is cheap and the loop runs at the device refresh rate (often 90/120 Hz) without any throttling.

The fix has two parts: make the simulation run on a **fixed real-time accumulator** (independent of render FPS), and **cut render cost** so most devices comfortably hit 60 FPS.

### 1. Fixed-timestep simulation loop (`src/game/engine.ts`)

Replace the current "one update per RAF, dt capped at 50ms" loop with a fixed-step accumulator:

- Simulation step: `1/60 s` (16.67 ms).
- Each RAF frame: compute real elapsed time, add to accumulator, run as many fixed `update(1/60)` steps as fit, then render once.
- Hard cap accumulator at 250 ms so a tab-switch doesn't trigger a huge catch-up.
- Result: 1 second of wall-clock = 1 second of game, regardless of whether the device renders at 30, 60, 90, or 144 FPS.

### 2. Render performance (`src/game/renderer.ts` + `DrivingGame.tsx`)

- Cap `devicePixelRatio` used for the canvas backing store at **1.5** (currently the canvas matches CSS pixels but renders many gradients; on retina mobiles the implicit upscaling and on desktops a too-large canvas both hurt). Set `canvas.width = clientWidth * dpr` once on resize, then `ctx.scale(dpr, dpr)` so game code keeps using CSS pixels.
- Reduce `GAME_CONFIG.drawDistance` from 150 to ~90 segments — beyond that, segments project to <1 px anyway.
- Skip the canvas-clear+resize check inside the render hot path (only resize on the `resize` event, not every frame).
- Pre-render the static car sprites (sedan, sports, taxi, police, truck, hummer, garbage, van) once into offscreen canvases keyed by approximate width, and `drawImage` them scaled — instead of rebuilding 5–10 gradients per car per frame.
- Throttle scenery: draw the far horizon scenery layer every 2nd frame, midground every frame.
- Skip tire/crash smoke updates when there are zero particles (tiny win, but the loop currently iterates anyway).

### 3. Lightweight FPS / perf guard (optional, same change)

Add a tiny rolling FPS sampler in the engine; if average frame time stays above 28 ms for >2 s, automatically drop `drawDistance` to 60 and disable scenery jitter for the rest of the session. This protects the long tail of slow Chromebooks/old laptops without affecting good devices.

### Files to change

- `src/game/engine.ts` — fixed-timestep accumulator loop, FPS sampler.
- `src/game/renderer.ts` — cached car sprites, cheaper scenery, cleaner clears.
- `src/game/config.ts` — lower `drawDistance` default (150 → 90).
- `src/components/DrivingGame.tsx` — DPR-aware canvas resize (cap at 1.5).

### How to verify after the change

- Throttle Chrome DevTools CPU to 6× and confirm a round still completes in ~45 s of wall-clock time (not 3 minutes).
- Open on a 120 Hz phone and confirm the car no longer flies through trips in a few seconds.
- Watch the FPS overlay (if added) — should sit at the device refresh rate on modern hardware and degrade gracefully on slow ones without changing game speed.

