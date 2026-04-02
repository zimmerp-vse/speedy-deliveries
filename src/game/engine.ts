import { GAME_CONFIG, AccidentType, RoundResult, GameData } from './config';
import { GameState, createSegments, spawnObstacles, render } from './renderer';

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
  
  // Round tracking
  private currentRound: number = 0;
  private gameData: GameData;
  private roundStartTime: number = 0;
  
  // Callbacks
  public onRoundEnd?: (result: RoundResult, gameData: GameData) => void;
  public onGameEnd?: (gameData: GameData) => void;
  public onSpeedUpdate?: (speed: number) => void;
  public onMoneyUpdate?: (money: number) => void;

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
    
    const scene = GAME_CONFIG.scenes[0];
    this.state = {
      position: 0,
      speed: 0,
      playerX: 0,
      steering: 0,
      segments: createSegments(GAME_CONFIG.deliveryDistance + 100),
      scene,
      distance: 0,
      deliveryProgress: 0,
      isAccident: false,
      isDelivery: false,
      hornActive: false,
    };
  }

  getGameData(): GameData {
    return this.gameData;
  }

  getCurrentRound(): number {
    return this.currentRound;
  }

  getMoney(): number {
    return this.gameData.totalMoney;
  }

  startRound() {
    this.currentRound++;
    const sceneIdx = (this.currentRound - 1) % GAME_CONFIG.scenes.length;
    
    this.state = {
      position: 0,
      speed: 0,
      playerX: 0,
      steering: 0,
      segments: createSegments(GAME_CONFIG.deliveryDistance + 100),
      scene: GAME_CONFIG.scenes[sceneIdx],
      distance: 0,
      deliveryProgress: 0,
      isAccident: false,
      isDelivery: false,
      hornActive: false,
    };
    
    this.roundStartTime = performance.now();
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
  }

  setControls(controls: Partial<Controls>) {
    Object.assign(this.controls, controls);
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
    
    // Acceleration / braking
    if (this.controls.accelerate) {
      s.speed = Math.min(s.speed + cfg.acceleration * dt, cfg.maxSpeed);
    } else if (this.controls.brake) {
      s.speed = Math.max(s.speed - cfg.braking * dt, 0);
    } else {
      s.speed = Math.max(s.speed - cfg.deceleration * dt, 0);
    }
    
    // Steering
    const steerDir = (this.controls.left ? -1 : 0) + (this.controls.right ? 1 : 0);
    s.steering = steerDir;
    
    if (s.speed > 0) {
      s.playerX += steerDir * cfg.steeringSpeed * dt * (s.speed / cfg.maxSpeed);
      s.playerX = Math.max(-2.5, Math.min(2.5, s.playerX));
      
      // Apply road curve force
      const segIdx = Math.floor(s.position / cfg.segmentLength);
      const seg = s.segments[segIdx];
      if (seg) {
        s.playerX += seg.curve * dt * (s.speed / cfg.maxSpeed) * 0.3;
      }
    }
    
    // Horn
    s.hornActive = this.controls.horn;
    
    // Position
    s.position += s.speed * dt * 50;
    s.distance = s.position / cfg.segmentLength;
    s.deliveryProgress = Math.min(s.distance / cfg.deliveryDistance, 1);
    
    // Spawn obstacles
    const playerSegIdx = Math.floor(s.position / cfg.segmentLength);
    spawnObstacles(s.segments, playerSegIdx);
    
    // Collision detection
    this.checkCollisions(playerSegIdx);
    
    // Check delivery completion
    if (s.deliveryProgress >= 1 && !s.isDelivery && !s.isAccident) {
      s.isDelivery = true;
      s.speed = 0;
      this.endRound(true);
    }
    
    // Update callbacks
    this.onSpeedUpdate?.(s.speed);
    this.onMoneyUpdate?.(this.gameData.totalMoney);
  }

  private checkCollisions(playerSegIdx: number) {
    const s = this.state;
    if (s.isAccident || s.isDelivery) return;
    
    // Check nearby segments
    for (let i = -1; i <= 2; i++) {
      const idx = playerSegIdx + i;
      if (idx < 0 || idx >= s.segments.length) continue;
      
      const seg = s.segments[idx];
      if (!seg.sprite || !seg.sprite.active) continue;
      
      // Check if player is close to sprite
      const lateralDist = Math.abs(s.playerX - seg.sprite.offset * 2.5);
      
      if (lateralDist < 0.6 && s.speed > 10) {
        // Horn scares away pedestrians
        if (seg.sprite.type === 'pedestrian' && s.hornActive) {
          seg.sprite.active = false;
          continue;
        }
        
        seg.sprite.active = false;
        s.isAccident = true;
        s.speed = 0;
        this.endRound(false, seg.sprite.type);
        return;
      }
    }
  }

  private endRound(success: boolean, accidentType?: AccidentType) {
    this.running = false;
    const timeMs = performance.now() - this.roundStartTime;
    
    let moneyEarned = 0;
    let moneyLost = 0;
    
    if (success) {
      moneyEarned = GAME_CONFIG.deliveryReward;
      this.gameData.totalDeliveries++;
    } else if (accidentType) {
      const costs = {
        car: GAME_CONFIG.carCollisionCost,
        obstacle: GAME_CONFIG.obstacleCollisionCost,
        pedestrian: GAME_CONFIG.pedestrianCollisionCost,
      };
      moneyLost = costs[accidentType];
      this.gameData.totalAccidents[accidentType]++;
    }
    
    this.gameData.totalMoney += moneyEarned - moneyLost;
    
    const result: RoundResult = {
      round: this.currentRound,
      success,
      accidentType,
      moneyEarned,
      moneyLost,
      scene: this.state.scene.name,
      timeMs,
    };
    
    this.gameData.rounds.push(result);
    
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

  destroy() {
    this.stop();
  }
}
