// Per-round schedule: pure helpers, no access to GAME_CONFIG, so they can be unit-tested.

import type { AppliedConditions, ScheduleEntry } from './protocol';

/** Maximum number of schedule entries accepted (matches the totalRounds cap). */
export const MAX_SCHEDULE_LENGTH = 100;

/** The base values a schedule entry is applied on top of. */
export type BaseConditions = Omit<AppliedConditions, 'sceneIndex'>;

// Same bounds as applyInitConfig uses for the base difficulty.
const BOUNDS = {
  tripDurationMs: [5000, 600000],
  carSpawnRate: [0, 1],
  obstacleSpawnRate: [0, 1],
  pedestrianSpawnRate: [0, 1],
} as const;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Validate a schedule from INIT. Returns undefined if no usable schedule was sent
 * (missing, not an array, or empty), so the game behaves exactly as without one.
 * Unknown fields and non-numeric values are dropped; numbers are clamped.
 */
export function sanitizeSchedule(raw: unknown, sceneCount: number): ScheduleEntry[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.slice(0, MAX_SCHEDULE_LENGTH).map((item) => {
    const src = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const entry: ScheduleEntry = {};
    for (const key of Object.keys(BOUNDS) as (keyof typeof BOUNDS)[]) {
      const v = src[key];
      if (finite(v)) entry[key] = clamp(v, BOUNDS[key][0], BOUNDS[key][1]);
    }
    const s = src.sceneIndex;
    if (finite(s) && sceneCount > 0) {
      const i = Math.floor(s);
      if (i >= 0 && i < sceneCount) entry.sceneIndex = i;
    }
    return entry;
  });
}

/**
 * Conditions for round `round` (1-based): the schedule entry for that round on top
 * of the base values. Without an entry the scene rotates by round number, as the
 * game always did.
 */
export function resolveRoundConditions(
  base: BaseConditions,
  schedule: ScheduleEntry[] | undefined,
  round: number,
  sceneCount: number,
): AppliedConditions {
  const entry = schedule?.[round - 1] ?? {};
  const defaultScene = sceneCount > 0 ? (round - 1) % sceneCount : 0;
  return {
    tripDurationMs: entry.tripDurationMs ?? base.tripDurationMs,
    carSpawnRate: entry.carSpawnRate ?? base.carSpawnRate,
    obstacleSpawnRate: entry.obstacleSpawnRate ?? base.obstacleSpawnRate,
    pedestrianSpawnRate: entry.pedestrianSpawnRate ?? base.pedestrianSpawnRate,
    sceneIndex: entry.sceneIndex ?? defaultScene,
  };
}
