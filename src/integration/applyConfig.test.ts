import { describe, it, expect, beforeEach } from 'vitest';
import { GAME_CONFIG } from '@/game/config';
import { applyInitConfig } from './applyConfig';
import { spawnObstacles, createSegments } from '@/game/renderer';

describe('safe finish', () => {
  beforeEach(() => {
    GAME_CONFIG.deliveryDistance = 300;
  });

  it('is off by default: the finish zone stays 40 segments', () => {
    const r = applyInitConfig({ difficulty: { deliveryDistance: 200 } });
    expect(r.safeFinish).toBe(false);
    expect(r.finishZone).toBe(40);
  });

  it('on: the zone is the last fifth of the road (at least 20 segments) and nothing spawns in it', () => {
    expect(applyInitConfig({ difficulty: { deliveryDistance: 200, safeFinish: true } }).finishZone).toBe(40);
    expect(applyInitConfig({ difficulty: { deliveryDistance: 60, safeFinish: true } }).finishZone).toBe(20);
    applyInitConfig({ difficulty: { deliveryDistance: 200, safeFinish: true, carSpawnRate: 1, obstacleSpawnRate: 0, pedestrianSpawnRate: 0 } });
    const segs = createSegments(400);
    // From segment 120, spawns land on 148..192: before the zone (148..159) or in it (160..).
    for (let i = 0; i < 2000; i++) spawnObstacles(segs, 120);
    const hazards = segs.map((s, i) => (s.sprite ? i : -1)).filter((i) => i >= 0);
    expect(hazards.length).toBeGreaterThan(0);
    expect(hazards.every((i) => i < 160)).toBe(true);
  });
});

describe('collision hitboxes', () => {
  // The player steers within +/- 2.6 road units and the three lanes sit 2.436 apart. A crash needs
  // the player's box and the hazard's box to overlap, so the two half-widths together say how wide
  // a hazard really is. The old widths (player 0.55 plus 0.5 for a car) blocked 2.1 of the 5.2
  // units the player can reach, about 40 % of the road, and 2.5 units for a lorry: that is why a
  // near miss felt like a crash. Half the lane spacing is a simple bound that keeps a clear gap.
  const LANE_SPACING = 0.58 * 4.2;

  it('leaves a way through next to any hazard, even the widest', () => {
    const hb = GAME_CONFIG.hitbox;
    for (const [name, w] of Object.entries(hb)) {
      expect(w, `${name} is wider than a lane`).toBeLessThan(LANE_SPACING / 2);
    }
    const widest = Math.max(hb.carBig, hb.carMedium, hb.car, hb.obstacle, hb.pedestrian);
    expect(hb.player + widest).toBeLessThan(LANE_SPACING / 2);
  });

  it('is narrower than the drawn sprites, so a near miss is a miss', () => {
    // A hazard fills about 0.3 of the road half-width on screen; the hitbox must be clearly less.
    expect((GAME_CONFIG.hitbox.player + GAME_CONFIG.hitbox.car) / 4.2).toBeLessThan(0.25);
  });
});
