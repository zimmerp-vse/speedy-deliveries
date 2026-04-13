import { GAME_CONFIG, AccidentType, RoundResult, GameData } from './config';
import { GameState, CelebrationParticle, createSegments, spawnObstacles, render } from './renderer';

export interface Controls {
  left: boolean;
  right: boolean;
  accelerate: boolean;
  brake: boolean;
  horn: boolean;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private controls: Controls;
  private lastTime: number = 0;
  private animFrame: number = 0;
  private running: boolean = false;
  private cruiseEnabled: boolean = false;
  private lastSpawnSegment: number = 0;
  private pendingCelebrationResult: RoundResult | null = null;
  
  private currentRound: number = 0;
  private gameData: GameData;
  private roundStartTime: number = 0;
  
  public onRoundEnd?: (result: RoundResult, gameData: GameData) => void;
  public onGameEnd?: (gameData: GameData) => void;
  public onSpeedUpdate?: (speed: number) => void;
  public onMoneyUpdate?: (money: number) => void;
  public onTimeUpdate?: (time: number) => void;
  public onCelebrationChange?: (active: boolean) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.controls = { left: false, right: false, accelerate: false, brake: false, horn: false };
    
    this.gameData = {
      rounds: [],
      totalMoney: GAME_CONFIG.startingMoney,
      totalDeliveries: 0,
      totalAccidents: { car: 0, obstacle: 0, pedestrian: 0 },
    };
    
    this.state = this.createInitialState(0);
  }

  private createInitialState(sceneIdx: number): GameState {
    const deliveryType = GAME_CONFIG.deliveryTypes[Math.floor(Math.random() * GAME_CONFIG.deliveryTypes.length)];
    return {
      position: 0,
      speed: 0,
      playerX: 0,
      steering: 0,
      segments: createSegments(GAME_CONFIG.deliveryDistance + 200),
      scene: GAME_CONFIG.scenes[sceneIdx % GAME_CONFIG.scenes.length],
      distance: 0,
      deliveryProgress: 0,
      isAccident: false,
      isDelivery: false,
      hornActive: false,
      timeRemaining: GAME_CONFIG.tripDurationMs / 1000,
      celebrating: false,
      celebrationTimer: 0,
      celebrationParticles: [],
      celebrationFlashAlpha: 0,
      deliveryType,
      gameTime: 0,
      tireSmoke: [],
      crashSmoke: [],
      crashTimer: 0,
      crashSkipped: false,
    };
  }

  getGameData(): GameData { return this.gameData; }
  getCurrentRound(): number { return this.currentRound; }
  getMoney(): number { return this.gameData.totalMoney; }
  isCelebrating(): boolean { return this.state.celebrating; }

  startRound() {
    this.currentRound++;
    this.state = this.createInitialState(this.currentRound - 1);
    this.pendingCelebrationResult = null;
    this.onCelebrationChange?.(false);
    this.roundStartTime = performance.now();
    this.cruiseEnabled = false;
    this.lastSpawnSegment = 0;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }

  setControls(controls: Partial<Controls>) {
    Object.assign(this.controls, controls);
  }

  skipCelebration() {
    if (!this.state.celebrating) return;
    this.finishCelebration();
  }

  private loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.update(dt);
    this.renderFrame();
    this.animFrame = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    const cfg = GAME_CONFIG;
    const s = this.state;
    
    s.gameTime += dt;
    
    if (s.celebrating) {
      s.celebrationTimer -= dt;
      s.celebrationFlashAlpha = Math.max(0, s.celebrationFlashAlpha - dt * 2);
      for (const p of s.celebrationParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;
        p.alpha = Math.max(0, p.alpha - dt * 0.7);
      }
      if (s.celebrationTimer <= 0) {
        this.finishCelebration();
        return;
      }
      this.onSpeedUpdate?.(s.speed);
      this.onMoneyUpdate?.(this.gameData.totalMoney);
      this.onTimeUpdate?.(s.timeRemaining);
      return;
    }
    
    if (this.controls.accelerate) {
      this.cruiseEnabled = true;
      const accelRate = s.speed < cfg.cruiseSpeed ? cfg.launchAcceleration : cfg.acceleration;
      s.speed = Math.min(s.speed + accelRate * dt, cfg.maxSpeed);
    } else if (this.controls.brake) {
      s.speed = Math.max(s.speed - cfg.braking * dt, 0);
      if (s.speed <= cfg.stopSpeedThreshold) {
        this.cruiseEnabled = false;
      }
    } else if (this.cruiseEnabled) {
      if (s.speed > cfg.cruiseSpeed) {
        s.speed = Math.max(s.speed - cfg.coastDeceleration * dt, cfg.cruiseSpeed);
      } else {
        s.speed = Math.min(s.speed + cfg.coastDeceleration * 0.5 * dt, cfg.cruiseSpeed);
      }
    } else {
      s.speed = Math.max(s.speed - cfg.idleDeceleration * dt, 0);
    }
    
    const steerDir = (this.controls.left ? -1 : 0) + (this.controls.right ? 1 : 0);
    s.steering = steerDir;
    
    if (s.speed > 0) {
      const steerMul = 0.4 + 0.6 * (s.speed / cfg.maxSpeed);
      s.playerX += steerDir * cfg.steeringSpeed * dt * steerMul;
      
      const segIdx = Math.floor(s.position) % s.segments.length;
      const seg = s.segments[segIdx];
      if (seg) {
        s.playerX += seg.curve * dt * (s.speed / cfg.maxSpeed) * 0.3;
      }
      
      s.playerX = Math.max(-2.5, Math.min(2.5, s.playerX));
    }
    
    s.hornActive = this.controls.horn;
    
    const elapsed = (performance.now() - this.roundStartTime) / 1000;
    s.timeRemaining = Math.max(0, GAME_CONFIG.tripDurationMs / 1000 - elapsed);
    
    if (s.timeRemaining <= 0 && !s.isDelivery && !s.isAccident) {
      s.isAccident = true;
      s.speed = 0;
      this.endRound(false, undefined);
      return;
    }
    
    s.position += s.speed * dt * 0.22;

    const deliveryStopPosition = Math.max(0, cfg.deliveryDistance - 4);
    if (s.position >= deliveryStopPosition && !s.isDelivery && !s.isAccident) {
      s.position = deliveryStopPosition;
      s.distance = cfg.deliveryDistance;
      s.deliveryProgress = 1;
      s.isDelivery = true;
      s.speed = 0;
      s.hornActive = false;
      s.celebrating = true;
      s.celebrationTimer = GAME_CONFIG.celebrationDurationMs / 1000;
      s.celebrationFlashAlpha = 0.6;
      s.celebrationParticles = [];
      this.spawnCelebrationParticles();
      this.onCelebrationChange?.(true);
      this.endRound(true);
      this.onSpeedUpdate?.(s.speed);
      this.onMoneyUpdate?.(this.gameData.totalMoney);
      this.onTimeUpdate?.(s.timeRemaining);
      return;
    }

    s.distance = s.position;
    s.deliveryProgress = Math.min(s.distance / cfg.deliveryDistance, 1);
    
    const playerSegIdx = Math.floor(s.position) % s.segments.length;
    if (playerSegIdx !== this.lastSpawnSegment) {
      spawnObstacles(s.segments, playerSegIdx);
      this.lastSpawnSegment = playerSegIdx;
    }
    
    this.checkCollisions(playerSegIdx);
    
    this.onSpeedUpdate?.(s.speed);
    this.onMoneyUpdate?.(this.gameData.totalMoney);
    this.onTimeUpdate?.(s.timeRemaining);
  }

  private checkCollisions(playerSegIdx: number) {
    const s = this.state;
    if (s.isAccident || s.isDelivery || s.speed <= 10) return;

    const approach = s.position - Math.floor(s.position);
    if (approach < 0.72) return;

    const nextIdx = (playerSegIdx + 1) % s.segments.length;
    const seg = s.segments[nextIdx];
    if (!seg.sprite || !seg.sprite.active) return;

    const obstacleX = seg.sprite.offset * 4.2;
    const lateralDist = Math.abs(s.playerX - obstacleX);
    if (lateralDist > 0.65) return;

    if (seg.sprite.type === 'pedestrian' && s.hornActive) {
      seg.sprite.active = false;
      return;
    }

    seg.sprite.active = false;
    s.isAccident = true;
    s.speed = 0;
    this.endRound(false, seg.sprite.type);
  }

  private spawnCelebrationParticles() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const emojis = GAME_CONFIG.celebrationEmojis;
    for (let i = 0; i < 18; i++) {
      this.state.celebrationParticles.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.4,
        y: H * 0.5 + Math.random() * H * 0.2,
        vx: (Math.random() - 0.5) * 200,
        vy: -150 - Math.random() * 200,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        alpha: 1,
      });
    }
  }

  private finishCelebration() {
    const result = this.pendingCelebrationResult;
    this.pendingCelebrationResult = null;
    this.state.celebrating = false;
    this.state.celebrationTimer = 0;
    this.state.celebrationFlashAlpha = 0;
    this.onCelebrationChange?.(false);
    this.running = false;

    if (!result) return;

    if (this.currentRound >= GAME_CONFIG.totalRounds) {
      this.onGameEnd?.({ ...this.gameData });
    } else {
      this.onRoundEnd?.(result, { ...this.gameData });
    }
  }

  private endRound(success: boolean, accidentType?: AccidentType) {
    if (!success) this.running = false;
    const timeMs = performance.now() - this.roundStartTime;
    
    let moneyEarned = 0, moneyLost = 0;
    
    if (success) {
      moneyEarned = GAME_CONFIG.deliveryReward;
      this.gameData.totalDeliveries++;
    } else if (accidentType) {
      const costs = { car: GAME_CONFIG.carCollisionCost, obstacle: GAME_CONFIG.obstacleCollisionCost, pedestrian: GAME_CONFIG.pedestrianCollisionCost };
      moneyLost = costs[accidentType];
      this.gameData.totalAccidents[accidentType]++;
    }
    
    this.gameData.totalMoney += moneyEarned - moneyLost;
    
    const result: RoundResult = {
      round: this.currentRound, success, accidentType,
      moneyEarned, moneyLost, scene: this.state.scene.name, timeMs,
    };
    this.gameData.rounds.push(result);

    if (success) {
      this.pendingCelebrationResult = result;
      return;
    }
    
    setTimeout(() => {
      if (this.currentRound >= GAME_CONFIG.totalRounds) {
        this.onGameEnd?.(this.gameData);
      } else {
        this.onRoundEnd?.(result, this.gameData);
      }
    }, 1500);
  }

  private renderFrame() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);
    render(this.ctx, this.state, w, h);
  }

  destroy() { this.stop(); }
}
