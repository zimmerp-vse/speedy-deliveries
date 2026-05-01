import { supabase } from '@/integrations/supabase/client';
import type { InitPayload } from '@/integration/protocol';

export type RegimeKey = 'T1_easy' | 'T1_medium' | 'T1_hard' | 'T2' | 'T3';

export interface ResolvedParams {
  difficulty: NonNullable<InitPayload['difficulty']>;
  economy: NonNullable<InitPayload['economy']>;
}

export const FALLBACK_PRESETS: Record<'T1_easy' | 'T1_medium' | 'T1_hard', ResolvedParams> = {
  T1_easy: {
    difficulty: { totalRounds: 5, tripDurationMs: 45000, carSpawnRate: 0.02, obstacleSpawnRate: 0.003, pedestrianSpawnRate: 0.002, malfunctionProbability: 0.1, maxSpeed: 120, acceleration: 18, braking: 80 },
    economy: { startingMoney: 1000, deliveryReward: 600, carCollisionCost: 200, obstacleCollisionCost: 150, pedestrianCollisionCost: 100, malfunctionCost: 150 },
  },
  T1_medium: {
    difficulty: { totalRounds: 8, tripDurationMs: 35000, carSpawnRate: 0.04, obstacleSpawnRate: 0.006, pedestrianSpawnRate: 0.004, malfunctionProbability: 0.25, maxSpeed: 120, acceleration: 18, braking: 80 },
    economy: { startingMoney: 1000, deliveryReward: 500, carCollisionCost: 300, obstacleCollisionCost: 200, pedestrianCollisionCost: 150, malfunctionCost: 250 },
  },
  T1_hard: {
    difficulty: { totalRounds: 10, tripDurationMs: 25000, carSpawnRate: 0.07, obstacleSpawnRate: 0.012, pedestrianSpawnRate: 0.008, malfunctionProbability: 0.45, maxSpeed: 120, acceleration: 18, braking: 80 },
    economy: { startingMoney: 1000, deliveryReward: 400, carCollisionCost: 500, obstacleCollisionCost: 300, pedestrianCollisionCost: 250, malfunctionCost: 400 },
  },
};

export const FALLBACK_T3_RANGES = {
  params_min: { totalRounds: 3, tripDurationMs: 20000, carSpawnRate: 0.01, obstacleSpawnRate: 0.002, pedestrianSpawnRate: 0.001, malfunctionProbability: 0.05, deliveryReward: 300, carCollisionCost: 150, obstacleCollisionCost: 100, pedestrianCollisionCost: 75, malfunctionCost: 100 },
  params_max: { totalRounds: 12, tripDurationMs: 50000, carSpawnRate: 0.09, obstacleSpawnRate: 0.015, pedestrianSpawnRate: 0.01, malfunctionProbability: 0.6, deliveryReward: 800, carCollisionCost: 600, obstacleCollisionCost: 400, pedestrianCollisionCost: 300, malfunctionCost: 500 },
};

export function isTransientDatabaseError(error: unknown) {
  const e = error as { code?: string; message?: string; details?: string; status?: number } | null | undefined;
  const text = `${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();
  return e?.status === 503 || ['PGRST000', 'PGRST001', 'PGRST002'].includes(e?.code ?? '') || text.includes('schema cache') || text.includes('database client error') || text.includes('recovery mode');
}

export async function loadPreset(regime: 'T1_easy' | 'T1_medium' | 'T1_hard'): Promise<ResolvedParams> {
  const { data, error } = await supabase.from('difficulty_presets').select('params').eq('regime', regime).single();
  if (error) throw error;
  return data.params as unknown as ResolvedParams;
}

export async function loadAllPresets(): Promise<{ regime: string; params: ResolvedParams }[]> {
  const { data, error } = await supabase.from('difficulty_presets').select('regime, params');
  if (error) throw error;
  return (data ?? []).map(r => ({ regime: r.regime, params: r.params as unknown as ResolvedParams }));
}

export async function loadT3Ranges(): Promise<{ params_min: Record<string, number>; params_max: Record<string, number> }> {
  const { data, error } = await supabase.from('t3_ranges').select('params_min, params_max').eq('id', 1).single();
  if (error) throw error;
  return {
    params_min: data.params_min as unknown as Record<string, number>,
    params_max: data.params_max as unknown as Record<string, number>,
  };
}

const NUMERIC_FIELDS = [
  'totalRounds', 'tripDurationMs',
  'carSpawnRate', 'obstacleSpawnRate', 'pedestrianSpawnRate',
  'malfunctionProbability',
  'deliveryReward', 'carCollisionCost', 'obstacleCollisionCost', 'pedestrianCollisionCost', 'malfunctionCost',
] as const;

const INTEGER_FIELDS = new Set(['totalRounds', 'tripDurationMs', 'deliveryReward', 'carCollisionCost', 'obstacleCollisionCost', 'pedestrianCollisionCost', 'malfunctionCost']);

const DIFFICULTY_FIELDS = new Set(['totalRounds','tripDurationMs','carSpawnRate','obstacleSpawnRate','pedestrianSpawnRate','malfunctionProbability']);

export function generateT3(min: Record<string, number>, max: Record<string, number>): ResolvedParams {
  const difficulty: any = {};
  const economy: any = {};
  for (const f of NUMERIC_FIELDS) {
    const lo = Number(min[f]);
    const hi = Number(max[f]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    let v = lo + Math.random() * (hi - lo);
    if (INTEGER_FIELDS.has(f)) v = Math.round(v);
    else v = Math.round(v * 1000) / 1000;
    if (DIFFICULTY_FIELDS.has(f)) difficulty[f] = v;
    else economy[f] = v;
  }
  return { difficulty, economy };
}

export const NUMERIC_FIELD_LIST = NUMERIC_FIELDS;
export const FIELD_LABELS: Record<string, string> = {
  totalRounds: 'Total rounds',
  tripDurationMs: 'Trip duration (ms)',
  carSpawnRate: 'Car spawn rate (0-1)',
  obstacleSpawnRate: 'Obstacle spawn rate (0-1)',
  pedestrianSpawnRate: 'Pedestrian spawn rate (0-1)',
  malfunctionProbability: 'Malfunction probability (0-1)',
  deliveryReward: 'Delivery reward',
  carCollisionCost: 'Car collision cost',
  obstacleCollisionCost: 'Obstacle collision cost',
  pedestrianCollisionCost: 'Pedestrian collision cost',
  malfunctionCost: 'Malfunction cost',
};

export function flattenParams(p: ResolvedParams): Record<string, number> {
  return { ...(p.difficulty as any), ...(p.economy as any) };
}

export function unflattenParams(flat: Record<string, number>): ResolvedParams {
  const difficulty: any = {}; const economy: any = {};
  for (const [k, v] of Object.entries(flat)) {
    if (DIFFICULTY_FIELDS.has(k)) difficulty[k] = v; else economy[k] = v;
  }
  return { difficulty, economy };
}
