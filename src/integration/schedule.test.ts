import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeSchedule, resolveRoundConditions, MAX_SCHEDULE_LENGTH } from './schedule';
import { applyInitConfig, getInitSchedule, snapshotBaseConditions } from './applyConfig';
import { GAME_CONFIG } from '@/game/config';

const base = {
  tripDurationMs: 45000,
  carSpawnRate: 0.03,
  obstacleSpawnRate: 0.005,
  pedestrianSpawnRate: 0.003,
};

describe('sanitizeSchedule', () => {
  it('returns undefined when no usable schedule is sent', () => {
    expect(sanitizeSchedule(undefined, 10)).toBeUndefined();
    expect(sanitizeSchedule(null, 10)).toBeUndefined();
    expect(sanitizeSchedule('x', 10)).toBeUndefined();
    expect(sanitizeSchedule([], 10)).toBeUndefined();
  });

  it('clamps numbers, drops bad values and out-of-range scenes', () => {
    const s = sanitizeSchedule(
      [
        { tripDurationMs: 1000, carSpawnRate: 2, obstacleSpawnRate: -1, pedestrianSpawnRate: 'x', sceneIndex: 3.7 },
        { sceneIndex: 10 },
        { sceneIndex: -1, foo: 1 },
        null,
      ],
      10,
    );
    expect(s).toEqual([
      { tripDurationMs: 5000, carSpawnRate: 1, obstacleSpawnRate: 0, sceneIndex: 3 },
      {},
      {},
      {},
    ]);
  });

  it('caps the length', () => {
    expect(sanitizeSchedule(new Array(150).fill({}), 10)).toHaveLength(MAX_SCHEDULE_LENGTH);
  });
});

describe('resolveRoundConditions', () => {
  it('without a schedule gives the base values and rotates the scene by round', () => {
    expect(resolveRoundConditions(base, undefined, 1, 10)).toEqual({ ...base, sceneIndex: 0 });
    expect(resolveRoundConditions(base, undefined, 12, 10)).toEqual({ ...base, sceneIndex: 1 });
  });

  it('applies entry i-1 at round i, falling back to base (not the previous round) per field', () => {
    const schedule = [
      { tripDurationMs: 20000, carSpawnRate: 0.09, sceneIndex: 7 },
      { obstacleSpawnRate: 0.015 },
    ];
    expect(resolveRoundConditions(base, schedule, 1, 10)).toEqual({
      ...base, tripDurationMs: 20000, carSpawnRate: 0.09, sceneIndex: 7,
    });
    expect(resolveRoundConditions(base, schedule, 2, 10)).toEqual({
      ...base, obstacleSpawnRate: 0.015, sceneIndex: 1,
    });
    // Beyond the schedule: base values.
    expect(resolveRoundConditions(base, schedule, 3, 10)).toEqual({ ...base, sceneIndex: 2 });
  });
});

describe('applyInitConfig with and without a schedule', () => {
  const pristine = { ...GAME_CONFIG };
  beforeEach(() => Object.assign(GAME_CONFIG, pristine));

  it('without a schedule: totalRounds and values as before, no scheduleLength', () => {
    const r = applyInitConfig({ difficulty: { totalRounds: 5, carSpawnRate: 0.04 } });
    expect(r.totalRounds).toBe(5);
    expect(r.scheduleLength).toBeUndefined();
    expect(getInitSchedule({ difficulty: { totalRounds: 5 } })).toBeUndefined();
    expect(snapshotBaseConditions().carSpawnRate).toBe(0.04);
  });

  it('with a schedule: totalRounds defaults to its length', () => {
    const r = applyInitConfig({ difficulty: { schedule: [{}, {}, {}] } });
    expect(r.totalRounds).toBe(3);
    expect(r.scheduleLength).toBe(3);
  });

  it('deliveryDistance: default unchanged, override clamped', () => {
    expect(applyInitConfig({}).deliveryDistance).toBe(300);
    expect(applyInitConfig({ difficulty: { deliveryDistance: 200 } }).deliveryDistance).toBe(200);
    expect(applyInitConfig({ difficulty: { deliveryDistance: 5 } }).deliveryDistance).toBe(50);
  });

  it('with a schedule and an explicit totalRounds: totalRounds wins', () => {
    const r = applyInitConfig({ difficulty: { totalRounds: 80, schedule: [{}, {}] } });
    expect(r.totalRounds).toBe(80);
    expect(r.scheduleLength).toBe(2);
  });
});
