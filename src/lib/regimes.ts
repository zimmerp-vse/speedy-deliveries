import { supabase } from '@/integrations/supabase/client';
import type { InitPayload } from '@/integration/protocol';

export type RegimeKey = 'T1_easy' | 'T1_medium' | 'T1_hard' | 'T2' | 'T3';

export interface ResolvedParams {
  difficulty: NonNullable<InitPayload['difficulty']>;
  economy: NonNullable<InitPayload['economy']>;
}

export async function loadPreset(regime: 'T1_easy' | 'T1_medium' | 'T1_hard'): Promise<ResolvedParams> {
  const { data, error } = await supabase.from('difficulty_presets').select('params').eq('regime', regime).single();
  if (error) throw error;
  return data.params as ResolvedParams;
}

export async function loadAllPresets() {
  const { data, error } = await supabase.from('difficulty_presets').select('regime, params');
  if (error) throw error;
  return data;
}

export async function loadT3Ranges() {
  const { data, error } = await supabase.from('t3_ranges').select('params_min, params_max').eq('id', 1).single();
  if (error) throw error;
  return data;
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
