

## Delivery Point: Destination Marker, Celebration & Extensible Delivery Types

### What we're building

1. **Destination marker visible from ~30 segments away** — a delivery place (house by default) rendered on the road, growing with perspective as the player approaches
2. **Person waving at the destination** — an animated figure outside the delivery point, waving hand up/down
3. **Driver & passenger celebration** — on delivery, both characters stand up and raise hands in a bouncing animation during the 1.5s celebration window
4. **Celebration effects** — emoji particle burst (⭐🎉💰) + screen flash + "DELIVERED!" text
5. **Extensible delivery type system** — config-driven delivery destinations (house, yacht, truck, etc.) so new types can be added later per scene

### Design

**Delivery types in config:**
```
deliveryTypes: [
  { emoji: '🏠', label: 'House', waver: '👋🧑' },
  { emoji: '🛥️', label: 'Yacht', waver: '👋🧑‍✈️' },
  { emoji: '🚛', label: 'Truck', waver: '👋👷' },
  { emoji: '🏢', label: 'Office', waver: '👋🧑‍💼' },
]
```

Each scene can optionally specify which delivery types are valid; otherwise a random one is picked.

**Celebration sequence (1.5s window already exists):**
- Frame 0–1.5s: passengers raise hands + bounce, particle burst, flash overlay, "DELIVERED!" scale-in text
- Waving person at destination animates throughout approach + celebration

### Files to modify

- **`src/game/config.ts`** — Add `deliveryTypes` array and `destinationVisibleDistance: 25`
- **`src/game/renderer.ts`** — Add `GameState` fields (`celebrationTimer`, `celebrationParticles`), destination rendering function, waving person animation, passenger celebration pose in `drawPassenger`, particle system draw, flash overlay
- **`src/game/engine.ts`** — On delivery: set celebration state, spawn particles, update particle positions during the 1.5s delay loop, pick random delivery type for the round

### Celebration details

- **Passengers**: `drawPassenger` gets a `celebrating` param — arms drawn above head, slight Y oscillation (sin-based bounce)
- **Waving person**: drawn next to the destination emoji, arm position oscillates using a sin wave tied to game time
- **Particles**: ~15 emojis launched upward with random velocity + gravity, fading alpha over 1.5s
- **Flash**: white overlay starting at alpha 0.6, fading to 0 over 0.3s

