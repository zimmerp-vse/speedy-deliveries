// Iframe ↔ master postMessage protocol for the minigame.
// All messages share the shape: { source: 'dash-delivery', type, version, payload }

export const PROTOCOL_VERSION = 1 as const;
export const MESSAGE_SOURCE = 'dash-delivery' as const;

export type RoundOutcome =
  | 'delivered'
  | 'crash_car'
  | 'crash_obstacle'
  | 'crash_pedestrian'
  | 'malfunction'
  | 'timeout';

// ---- Per-round conditions ----

/**
 * One entry of the optional per-round schedule. Entry i (0-based) is applied
 * at the start of round i + 1, on top of the base difficulty. A field left out
 * falls back to the base value (never to the previous round's value).
 */
export interface ScheduleEntry {
  tripDurationMs?: number;
  carSpawnRate?: number;
  obstacleSpawnRate?: number;
  pedestrianSpawnRate?: number;
  /** 0-based index into the game's scene list. Default: (round - 1) mod scene count. */
  sceneIndex?: number;
}

/** The conditions actually in force for a round, echoed in ROUND_START and ROUND_END. */
export interface AppliedConditions {
  tripDurationMs: number;
  carSpawnRate: number;
  obstacleSpawnRate: number;
  pedestrianSpawnRate: number;
  sceneIndex: number;
}

// ---- Inbound (master → minigame) ----

export interface InitPayload {
  session?: { sessionId?: string };
  player?: {
    nickname?: string;
    id?: string;
    avatarUrl?: string;
  };
  difficulty?: {
    totalRounds?: number;
    tripDurationMs?: number;
    carSpawnRate?: number;
    obstacleSpawnRate?: number;
    pedestrianSpawnRate?: number;
    malfunctionProbability?: number;
    malfunctionFirstWindowSec?: { min?: number; max?: number };
    maxSpeed?: number;
    acceleration?: number;
    braking?: number;
    /** Road length of one delivery, in road segments. Default 300; shorter means shorter rounds. */
    deliveryDistance?: number;
    /**
     * Optional per-round conditions. With a schedule, totalRounds defaults to
     * the schedule's length; rounds beyond the schedule use the base values.
     */
    schedule?: ScheduleEntry[];
    /**
     * Safe finish: the striped finish zone is shorter (12 % of deliveryDistance, at least 15
     * segments, instead of 40 segments) and no hazards appear in it, so the end of a delivery is
     * a free sprint. Default false.
     */
    safeFinish?: boolean;
  };
  economy?: {
    startingMoney?: number;
    deliveryReward?: number;
    carCollisionCost?: number;
    obstacleCollisionCost?: number;
    pedestrianCollisionCost?: number;
    malfunctionCost?: number;
  };
  ui?: {
    showHud?: boolean;
    showQuitButton?: boolean;
    locale?: string;
    autoStart?: boolean;
    /** Show "/total" next to the round number in the HUD. Default true. */
    showRoundTotal?: boolean;
    /** A coloured ring on the watch shows the share of the time left (green, orange, red). Default false. */
    timeRing?: boolean;
  };
  // Forward-compat slot — preserved and echoed back on GAME_END.
  extra?: Record<string, unknown>;
}

export type InboundMessage =
  | { source: typeof MESSAGE_SOURCE; type: 'INIT'; version: number; payload: InitPayload }
  | { source: typeof MESSAGE_SOURCE; type: 'QUIT'; version: number; payload?: undefined }
  | { source: typeof MESSAGE_SOURCE; type: 'PAUSE'; version: number; payload?: undefined }
  | { source: typeof MESSAGE_SOURCE; type: 'RESUME'; version: number; payload?: undefined };

// ---- Outbound (minigame → master) ----

export interface RoundEvent {
  round: number;
  outcome: RoundOutcome;
  timeMs: number;
  scene: string;
  moneyEarned: number;
  moneyLost: number;
  moneyBalance: number;
  applied?: AppliedConditions;
}

export interface GameSummary {
  sessionId?: string;
  player?: InitPayload['player'];
  endedReason: 'completed' | 'quit';
  rounds: RoundEvent[];
  totals: {
    deliveries: number;
    money: number;
    accidents: {
      car: number;
      obstacle: number;
      pedestrian: number;
      malfunction: number;
      timeout: number;
    };
  };
  extra?: Record<string, unknown>;
}

export type OutboundMessage =
  | { source: typeof MESSAGE_SOURCE; type: 'READY'; version: number; payload: { protocolVersion: number } }
  | { source: typeof MESSAGE_SOURCE; type: 'INIT_ACK'; version: number; payload: { appliedConfig: Record<string, unknown>; sessionId?: string } }
  | { source: typeof MESSAGE_SOURCE; type: 'ROUND_START'; version: number; payload: { sessionId?: string; round: number; scene: string; deliveryType: string; startedAt: number; applied?: AppliedConditions } }
  | { source: typeof MESSAGE_SOURCE; type: 'ROUND_END'; version: number; payload: { sessionId?: string } & RoundEvent }
  | { source: typeof MESSAGE_SOURCE; type: 'GAME_END'; version: number; payload: GameSummary }
  | { source: typeof MESSAGE_SOURCE; type: 'ERROR'; version: number; payload: { code: string; message: string } };

export function isInboundMessage(data: unknown): data is InboundMessage {
  if (!data || typeof data !== 'object') return false;
  const d = data as { source?: unknown; type?: unknown; version?: unknown };
  if (d.source !== MESSAGE_SOURCE) return false;
  if (typeof d.type !== 'string') return false;
  if (typeof d.version !== 'number') return false;
  return ['INIT', 'QUIT', 'PAUSE', 'RESUME'].includes(d.type);
}
