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

  it('on: the zone is 12 % of the road (at least 15 segments) and nothing spawns in it', () => {
    expect(applyInitConfig({ difficulty: { deliveryDistance: 200, safeFinish: true } }).finishZone).toBe(24);
    expect(applyInitConfig({ difficulty: { deliveryDistance: 60, safeFinish: true } }).finishZone).toBe(15);
    applyInitConfig({ difficulty: { deliveryDistance: 200, safeFinish: true, carSpawnRate: 1, obstacleSpawnRate: 0, pedestrianSpawnRate: 0 } });
    const segs = createSegments(400);
    // From segment 120, spawns land on 148..192: before the zone (148..175) or in it (176..).
    for (let i = 0; i < 2000; i++) spawnObstacles(segs, 120);
    const hazards = segs.map((s, i) => (s.sprite ? i : -1)).filter((i) => i >= 0);
    expect(hazards.length).toBeGreaterThan(0);
    expect(hazards.every((i) => i < 176)).toBe(true);
  });
});
