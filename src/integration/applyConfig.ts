import { GAME_CONFIG } from '@/game/config';
import type { InitPayload, ScheduleEntry } from './protocol';
import { sanitizeSchedule, type BaseConditions } from './schedule';

export interface ResolvedConfig {
  totalRounds: number;
  tripDurationMs: number;
  startingMoney: number;
  deliveryReward: number;
  carCollisionCost: number;
  obstacleCollisionCost: number;
  pedestrianCollisionCost: number;
  malfunctionCost: number;
  maxSpeed: number;
  acceleration: number;
  braking: number;
  deliveryDistance: number;
  malfunctionProbability: number;
  malfunctionFirstWindowMinSec: number;
  malfunctionFirstWindowMaxSec: number;
  /** Present only when INIT carried a usable schedule. */
  scheduleLength?: number;
}

/** The INIT schedule, validated against the game's scene list; undefined if none was sent. */
export function getInitSchedule(init: InitPayload | undefined): ScheduleEntry[] | undefined {
  return sanitizeSchedule(init?.difficulty?.schedule, GAME_CONFIG.scenes.length);
}

/** Current base values on GAME_CONFIG, which schedule entries are applied on top of. */
export function snapshotBaseConditions(): BaseConditions {
  return {
    tripDurationMs: GAME_CONFIG.tripDurationMs,
    carSpawnRate: GAME_CONFIG.carSpawnRate,
    obstacleSpawnRate: GAME_CONFIG.obstacleSpawnRate,
    pedestrianSpawnRate: GAME_CONFIG.pedestrianSpawnRate,
  };
}

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
};

/**
 * Build a per-session config from INIT overrides on top of GAME_CONFIG defaults.
 * Also mutates spawn-rate fields on GAME_CONFIG (read by the renderer module
 * directly) so difficulty applies to obstacle generation too.
 */
export function applyInitConfig(init: InitPayload | undefined): ResolvedConfig {
  const d = init?.difficulty ?? {};
  const e = init?.economy ?? {};

  // Spawn rates live on the shared GAME_CONFIG singleton consumed by renderer.
  if (typeof d.carSpawnRate === 'number') GAME_CONFIG.carSpawnRate = num(d.carSpawnRate, GAME_CONFIG.carSpawnRate, 0, 1);
  if (typeof d.obstacleSpawnRate === 'number') GAME_CONFIG.obstacleSpawnRate = num(d.obstacleSpawnRate, GAME_CONFIG.obstacleSpawnRate, 0, 1);
  if (typeof d.pedestrianSpawnRate === 'number') GAME_CONFIG.pedestrianSpawnRate = num(d.pedestrianSpawnRate, GAME_CONFIG.pedestrianSpawnRate, 0, 1);

  // Also mirror onto GAME_CONFIG so the engine (which still reads from it for
  // many timing values) sees the overrides.
  if (typeof d.totalRounds === 'number') GAME_CONFIG.totalRounds = num(d.totalRounds, GAME_CONFIG.totalRounds, 1, 100);
  // With a schedule and no explicit totalRounds, play exactly the scheduled rounds.
  const schedule = getInitSchedule(init);
  if (schedule && typeof d.totalRounds !== 'number') GAME_CONFIG.totalRounds = schedule.length;
  if (typeof d.tripDurationMs === 'number') GAME_CONFIG.tripDurationMs = num(d.tripDurationMs, GAME_CONFIG.tripDurationMs, 5000, 600000);
  if (typeof d.maxSpeed === 'number') GAME_CONFIG.maxSpeed = num(d.maxSpeed, GAME_CONFIG.maxSpeed, 10, 500);
  if (typeof d.acceleration === 'number') GAME_CONFIG.acceleration = num(d.acceleration, GAME_CONFIG.acceleration, 1, 500);
  if (typeof d.braking === 'number') GAME_CONFIG.braking = num(d.braking, GAME_CONFIG.braking, 1, 500);
  if (typeof d.deliveryDistance === 'number') {
    GAME_CONFIG.deliveryDistance = Math.round(num(d.deliveryDistance, GAME_CONFIG.deliveryDistance, 50, 2000));
  }

  if (typeof e.startingMoney === 'number') GAME_CONFIG.startingMoney = num(e.startingMoney, GAME_CONFIG.startingMoney, 0);
  if (typeof e.deliveryReward === 'number') GAME_CONFIG.deliveryReward = num(e.deliveryReward, GAME_CONFIG.deliveryReward, 0);
  if (typeof e.carCollisionCost === 'number') GAME_CONFIG.carCollisionCost = num(e.carCollisionCost, GAME_CONFIG.carCollisionCost, 0);
  if (typeof e.obstacleCollisionCost === 'number') GAME_CONFIG.obstacleCollisionCost = num(e.obstacleCollisionCost, GAME_CONFIG.obstacleCollisionCost, 0);
  if (typeof e.pedestrianCollisionCost === 'number') GAME_CONFIG.pedestrianCollisionCost = num(e.pedestrianCollisionCost, GAME_CONFIG.pedestrianCollisionCost, 0);

  const resolved: ResolvedConfig = {
    totalRounds: GAME_CONFIG.totalRounds,
    tripDurationMs: GAME_CONFIG.tripDurationMs,
    startingMoney: GAME_CONFIG.startingMoney,
    deliveryReward: GAME_CONFIG.deliveryReward,
    carCollisionCost: GAME_CONFIG.carCollisionCost,
    obstacleCollisionCost: GAME_CONFIG.obstacleCollisionCost,
    pedestrianCollisionCost: GAME_CONFIG.pedestrianCollisionCost,
    malfunctionCost: num(e.malfunctionCost, GAME_CONFIG.obstacleCollisionCost, 0),
    maxSpeed: GAME_CONFIG.maxSpeed,
    acceleration: GAME_CONFIG.acceleration,
    braking: GAME_CONFIG.braking,
    deliveryDistance: GAME_CONFIG.deliveryDistance,
    malfunctionProbability: num(d.malfunctionProbability, 0.25, 0, 1),
    malfunctionFirstWindowMinSec: num(d.malfunctionFirstWindowSec?.min, 8, 0, 600),
    malfunctionFirstWindowMaxSec: num(d.malfunctionFirstWindowSec?.max, 22, 0, 600),
  };
  if (schedule) resolved.scheduleLength = schedule.length;

  // Stash on GAME_CONFIG for engine access (added as ad-hoc fields).
  (GAME_CONFIG as any).malfunctionProbability = resolved.malfunctionProbability;
  (GAME_CONFIG as any).malfunctionFirstWindowMinSec = resolved.malfunctionFirstWindowMinSec;
  (GAME_CONFIG as any).malfunctionFirstWindowMaxSec = resolved.malfunctionFirstWindowMaxSec;
  (GAME_CONFIG as any).malfunctionCost = resolved.malfunctionCost;

  return resolved;
}
