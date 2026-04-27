import { GAME_CONFIG, AccidentType, RoundResult, GameData } from './config';
import { GameState, CelebrationParticle, SmokeParticle, createSegments, spawnObstacles, render } from './renderer';
import { sounds } from './sounds';

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
  private pendingCrashResult: RoundResult | null = null;
  private crashTimeout: ReturnType<typeof setTimeout> | null = null;
  private accumulator: number = 0;
  private readonly fixedStep: number = 1 / 60;
  private fpsSamples: number[] = [];
  private perfDegraded: boolean = false;
  private lastTickSecond: number = -1;
  private lastHornState: boolean = false;
  private lastScreechState: boolean = false;
  private nextMalfunctionAt: number = 0; // gameTime threshold to attempt next malfunction
  
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
      braking: false,
    };
  }

  getGameData(): GameData { return this.gameData; }
  getCurrentRound(): number { return this.currentRound; }
  getMoney(): number { return this.gameData.totalMoney; }
  isCelebrating(): boolean { return this.state.celebrating; }
  isCrashScene(): boolean { return this.state.isAccident && this.state.crashTimer > 0 && !this.state.crashSkipped; }

  startRound() {
    // Clear any pending state from previous round
    if (this.crashTimeout) { clearTimeout(this.crashTimeout); this.crashTimeout = null; }
    if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = 0; }
    this.pendingCelebrationResult = null;
    this.pendingCrashResult = null;
    this.running = false;

    this.currentRound++;
    this.state = this.createInitialState(this.currentRound - 1);
    this.onCelebrationChange?.(false);
    this.roundStartTime = performance.now();
    this.cruiseEnabled = false;
    this.lastSpawnSegment = -1;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.fpsSamples = [];
    this.lastTickSecond = -1;
    // First malfunction can happen 8-22s into the round
    this.nextMalfunctionAt = 8 + Math.random() * 14;
    sounds.ensureContext();
    sounds.startEngine();
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

  skipCrash() {
    if (!this.state.isAccident || this.state.crashSkipped) return;
    this.state.crashSkipped = true;
    if (this.crashTimeout) { clearTimeout(this.crashTimeout); this.crashTimeout = null; }
    this.finishCrash();
  }

  private loop = () => {
    if (!this.running) return;
    const now = performance.now();
    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // FPS sampling for perf guard (rolling ~120 frames)
    this.fpsSamples.push(frameTime);
    if (this.fpsSamples.length > 120) this.fpsSamples.shift();
    if (!this.perfDegraded && this.fpsSamples.length >= 60) {
      const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
      if (avg > 0.028) {
        this.perfDegraded = true;
        (this.state as any).__drawDistOverride = 60;
      }
    }

    // Cap accumulator so a tab-switch doesn't trigger a huge catch-up
    this.accumulator = Math.min(this.accumulator + frameTime, 0.25);

    // Run as many fixed simulation steps as fit
    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < 8) {
      this.update(this.fixedStep);
      this.accumulator -= this.fixedStep;
      steps++;
      if (!this.running) break;
    }

    this.renderFrame();
    this.animFrame = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    const cfg = GAME_CONFIG;
    const s = this.state;
    
    s.gameTime += dt;

    // Update all smoke particles (tire + crash)
    this.updateSmoke(s.tireSmoke, dt);
    this.updateSmoke(s.crashSmoke, dt);
    
    // Crash scene — keep rendering but don't move
    if (s.isAccident && !s.crashSkipped) {
      s.crashTimer += dt;
      // Spawn crash smoke from hood
      if (s.crashTimer < 4 && Math.random() < 0.35) {
        const W = this.canvas.clientWidth;
        // Spawn from trunk (rear/bottom of car), drift up & back
        s.crashSmoke.push({
          x: W / 2 + s.steering * 40 + (Math.random() - 0.5) * 30,
          y: this.canvas.clientHeight - 18 - Math.random() * 8,
          vx: (Math.random() - 0.5) * 40,
          vy: -30 - Math.random() * 50,
          size: 8 + Math.random() * 12,
          alpha: 0.7 + Math.random() * 0.3,
          color: Math.random() < 0.3 ? '#333' : '#888',
        });
      }
      this.onSpeedUpdate?.(0);
      this.onMoneyUpdate?.(this.gameData.totalMoney);
      this.onTimeUpdate?.(s.timeRemaining);
      return;
    }
    
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
    s.braking = !!this.controls.brake && s.speed > 0;
    
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
      
      s.playerX = Math.max(-2.6, Math.min(2.6, s.playerX));
    }

    // Tire smoke when steering hard at speed
    if (s.speed > 30 && Math.abs(steerDir) > 0) {
      const W = this.canvas.clientWidth;
      const cx = W / 2 + s.steering * 40;
      const cy = this.canvas.clientHeight - 10;
      for (let i = 0; i < 2; i++) {
        s.tireSmoke.push({
          x: cx + (steerDir > 0 ? -38 : 38) + (Math.random() - 0.5) * 10,
          y: cy - Math.random() * 6,
          vx: -steerDir * (10 + Math.random() * 20),
          vy: -5 - Math.random() * 15,
          size: 4 + Math.random() * 6,
          alpha: 0.4 + Math.random() * 0.3,
          color: '#ccc',
        });
      }
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

    // --- Mechanical malfunctions (random, comedic) ---
    this.updateMalfunction(dt);

    // --- Audio sync ---
    sounds.setEngineSpeed(s.speed / GAME_CONFIG.maxSpeed);
    if (s.hornActive !== this.lastHornState) {
      sounds.setHorn(s.hornActive);
      this.lastHornState = s.hornActive;
    }
    const screeching = s.speed > 30 && s.steering !== 0;
    if (screeching !== this.lastScreechState) {
      sounds.setScreech(screeching);
      this.lastScreechState = screeching;
    }
    // Countdown ticks for last 5 seconds
    const sec = Math.ceil(s.timeRemaining);
    if (sec <= 5 && sec > 0 && sec !== this.lastTickSecond) {
      sounds.playTick(sec === 1);
      this.lastTickSecond = sec;
    }

    this.onSpeedUpdate?.(s.speed);
    this.onMoneyUpdate?.(this.gameData.totalMoney);
    this.onTimeUpdate?.(s.timeRemaining);
  }

  private updateMalfunction(dt: number) {
    const s = this.state;
    // Don't trigger while crashed, delivering, celebrating, or barely moving
    if (s.isAccident || s.isDelivery || s.celebrating) return;

    // Tick down active malfunction
    if (s.malfunction) {
      s.malfunction.timer -= dt;
      s.malfunction.labelTimer = Math.max(0, s.malfunction.labelTimer - dt);

      // Force the car to slow down rapidly — mechanical failure!
      s.speed = Math.max(0, s.speed - GAME_CONFIG.braking * 1.4 * dt);
      this.cruiseEnabled = false;

      // Continuous side-effects per kind
      if (s.malfunction.kind === 'smoke' && s.speed > 5) {
        // Black smoke from the hood — spawn a couple particles per frame
        const W = this.canvas.clientWidth;
        const H = this.canvas.clientHeight;
        const cx = W / 2 + s.steering * 40;
        if (Math.random() < 0.55) {
          s.crashSmoke.push({
            x: cx + (Math.random() - 0.5) * 30,
            y: H - 55 - Math.random() * 6,
            vx: (Math.random() - 0.5) * 30,
            vy: -50 - Math.random() * 40,
            size: 7 + Math.random() * 9,
            alpha: 0.6 + Math.random() * 0.3,
            color: Math.random() < 0.7 ? '#1a1a1a' : '#3a3a3a',
          });
        }
      }

      if (s.malfunction.timer <= 0) {
        s.malfunction = undefined;
        // Schedule next attempt 10-25s later
        this.nextMalfunctionAt = s.gameTime + 10 + Math.random() * 15;
      }
      return;
    }

    // Don't roll new malfunctions until threshold and only when actually driving
    if (s.gameTime < this.nextMalfunctionAt || s.speed < 25) return;

    // Roll for a malfunction (~25% chance once threshold hits, retry every ~2s otherwise)
    if (Math.random() > 0.25) {
      this.nextMalfunctionAt = s.gameTime + 2;
      return;
    }

    const r = Math.random();
    if (r < 0.4) {
      s.malfunction = {
        kind: 'smoke',
        timer: 4 + Math.random() * 3,
        label: '💨 ENGINE OVERHEATING!',
        labelTimer: 2.5,
      };
      sounds.playMalfunction();
    } else if (r < 0.7) {
      s.malfunction = {
        kind: 'wheel',
        timer: 5 + Math.random() * 3,
        missingWheel: Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3,
        label: '🛞 LOST A WHEEL!',
        labelTimer: 2.5,
      };
      sounds.playWheelOff();
    } else if (r < 0.9) {
      s.malfunction = {
        kind: 'backfire',
        timer: 1.5,
        label: '💥 BACKFIRE!',
        labelTimer: 2,
      };
      sounds.playMalfunction();
    } else {
      s.malfunction = {
        kind: 'bouncy',
        timer: 3,
        label: '🔧 SUSPENSION GLITCH!',
        labelTimer: 2,
      };
      sounds.playMalfunction();
    }
  }

  private updateSmoke(particles: SmokeParticle[], dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 8;
      p.alpha -= dt * 0.8;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  private checkCollisions(playerSegIdx: number) {
    const s = this.state;
    if (s.isAccident || s.isDelivery || s.speed <= 10) return;

    // Check current and next few segments to prevent skipping at high speed
    const checkRange = Math.max(2, Math.ceil(s.speed * 0.016 * 0.22) + 1);
    for (let offset = 0; offset <= checkRange; offset++) {
      const idx = (playerSegIdx + offset) % s.segments.length;
      const seg = s.segments[idx];
      if (!seg.sprite || !seg.sprite.active) continue;

      const obstacleX = seg.sprite.offset * 4.2;
      const lateralDist = Math.abs(s.playerX - obstacleX);
      // Per-type collision half-widths (sum of player + obstacle half-widths in world units)
      const playerHalfW = 0.55;
      let obsHalfW = 0.4;
      if (seg.sprite.type === 'car') {
        const e = seg.sprite.emoji ?? '';
        if (e === '🚛' || e === '🚜') obsHalfW = 0.7;        // big trucks
        else if (e === '🚚' || e === '🚙') obsHalfW = 0.6;   // truck / hummer
        else obsHalfW = 0.5;                                 // sedan/sports/police/taxi/van
      } else if (seg.sprite.type === 'obstacle') {
        obsHalfW = 0.4;
      } else {
        obsHalfW = 0.25; // pedestrians
      }
      if (lateralDist > playerHalfW + obsHalfW) continue;

      if (seg.sprite.type === 'pedestrian' && s.hornActive) {
        seg.sprite.active = false;
        continue;
      }

      // Store collided sprite info for rendering
      s.collidedSprite = { type: seg.sprite.type, emoji: seg.sprite.emoji };
      seg.sprite.active = false;
      s.isAccident = true;
      s.crashTimer = 0;
      s.speed = 0;
      this.endRound(false, seg.sprite.type as AccidentType);
      return;
    }
  }

  private spawnCelebrationParticles() {
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
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

  private finishCrash() {
    const result = this.pendingCrashResult;
    this.pendingCrashResult = null;
    this.running = false;

    if (!result) return;

    if (this.currentRound >= GAME_CONFIG.totalRounds) {
      this.onGameEnd?.({ ...this.gameData });
    } else {
      this.onRoundEnd?.(result, { ...this.gameData });
    }
  }

  private endRound(success: boolean, accidentType?: AccidentType) {
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

    // Stop continuous SFX once the round outcome is decided
    sounds.setHorn(false); this.lastHornState = false;
    sounds.setScreech(false); this.lastScreechState = false;
    sounds.setEngineSpeed(0);

    if (success) {
      this.pendingCelebrationResult = result;
      sounds.playDelivery();
      sounds.stopEngine();
      return;
    }

    sounds.playCrash();
    sounds.stopEngine();

    // Crash: keep the loop running so crash scene renders, auto-skip after 4s
    this.pendingCrashResult = result;
    this.crashTimeout = setTimeout(() => {
      if (!this.state.crashSkipped) {
        this.state.crashSkipped = true;
        this.finishCrash();
      }
    }, 4000);
  }

  private renderFrame() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.ctx.clearRect(0, 0, w, h);
    render(this.ctx, this.state, w, h);
  }

  destroy() {
    this.stop();
    if (this.crashTimeout) clearTimeout(this.crashTimeout);
    sounds.setHorn(false);
    sounds.setScreech(false);
    sounds.stopEngine();
  }
}
