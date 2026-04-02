import { GAME_CONFIG } from './config';

interface Segment {
  z: number;
  curve: number;
  y: number;
  sprite?: { type: 'car' | 'obstacle' | 'pedestrian'; emoji: string; offset: number; active: boolean };
  clip: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  w: number;
  scale: number;
}

export interface GameState {
  position: number;
  speed: number;
  playerX: number; // -1 to 1
  steering: number;
  segments: Segment[];
  scene: typeof GAME_CONFIG.scenes[0];
  distance: number;
  deliveryProgress: number; // 0 to 1
  isAccident: boolean;
  isDelivery: boolean;
  hornActive: boolean;
}

export function createSegments(numSegments: number): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < numSegments; i++) {
    const curve = Math.sin(i * 0.02) * 2 + Math.cos(i * 0.007) * 4;
    const y = Math.sin(i * 0.01) * 1500;
    segments.push({ z: i * GAME_CONFIG.segmentLength, curve, y, clip: 0 });
  }
  return segments;
}

export function spawnObstacles(segments: Segment[], playerSegIndex: number) {
  const cfg = GAME_CONFIG;
  const ahead = playerSegIndex + 50;
  const spawnRange = playerSegIndex + cfg.drawDistance;
  
  for (let i = ahead; i < spawnRange && i < segments.length; i++) {
    const seg = segments[i];
    if (seg.sprite) continue;
    
    const r = Math.random();
    const totalRate = (cfg.carSpawnRate + cfg.obstacleSpawnRate + cfg.pedestrianSpawnRate) / 60;
    
    if (r < totalRate) {
      const typeR = Math.random();
      let type: 'car' | 'obstacle' | 'pedestrian';
      let emojis: string[];
      
      if (typeR < 0.5) {
        type = 'car';
        emojis = cfg.obstacles.cars;
      } else if (typeR < 0.8) {
        type = 'obstacle';
        emojis = cfg.obstacles.roadObstacles;
      } else {
        type = 'pedestrian';
        emojis = cfg.obstacles.pedestrians;
      }
      
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const offset = (Math.random() - 0.5) * 1.6; // Within road bounds
      
      seg.sprite = { type, emoji, offset, active: true };
    }
  }
}

function project(
  point: { x: number; y: number; z: number },
  camX: number, camY: number, camZ: number,
  screenWidth: number, screenHeight: number
): ProjectedPoint {
  const depth = GAME_CONFIG.cameraDepth;
  const translatedZ = point.z - camZ;
  
  if (translatedZ <= 0) return { x: 0, y: 0, w: 0, scale: 0 };
  
  const scale = depth / translatedZ;
  const x = (screenWidth / 2) + (scale * (point.x - camX) * screenWidth / 2);
  const y = (screenHeight / 2) - (scale * (point.y - camY) * screenHeight / 2);
  const w = scale * GAME_CONFIG.roadWidth * screenWidth / 2;
  
  return { x, y, w, scale };
}

function drawPolygon(ctx: CanvasRenderingContext2D, color: string, x1: number, y1: number, w1: number, x2: number, y2: number, w2: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1);
  ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x2 - w2, y2);
  ctx.closePath();
  ctx.fill();
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number) {
  const { scene, position, playerX, segments } = state;
  
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height / 2);
  skyGrad.addColorStop(0, scene.skyTop);
  skyGrad.addColorStop(1, scene.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height / 2);
  
  // Ground
  ctx.fillStyle = scene.groundColor;
  ctx.fillRect(0, height / 2, width, height / 2);
  
  const baseSegment = Math.floor(position / GAME_CONFIG.segmentLength);
  const camZ = position;
  const camY = GAME_CONFIG.cameraHeight + (segments[baseSegment]?.y || 0);
  let camX = playerX * GAME_CONFIG.roadWidth;
  
  let maxY = height;
  
  // Accumulate curve for perspective shift
  let curveAccum = 0;
  
  // Render road segments from far to near
  const drawSegs: { seg: Segment; p1: ProjectedPoint; p2: ProjectedPoint; idx: number }[] = [];
  
  for (let n = 0; n < GAME_CONFIG.drawDistance; n++) {
    const idx = (baseSegment + n) % segments.length;
    const seg = segments[idx];
    if (!seg) continue;
    
    const z1 = seg.z;
    const z2 = z1 + GAME_CONFIG.segmentLength;
    const nextIdx = (idx + 1) % segments.length;
    const nextSeg = segments[nextIdx];
    
    curveAccum += seg.curve;
    const offsetX = curveAccum * GAME_CONFIG.segmentLength;
    
    const p1 = project(
      { x: offsetX - curveAccum * GAME_CONFIG.segmentLength * 0.5, y: seg.y, z: z1 },
      camX, camY, camZ, width, height
    );
    const p2 = project(
      { x: offsetX, y: nextSeg?.y || seg.y, z: z2 },
      camX, camY, camZ, width, height
    );
    
    if (p1.scale <= 0 || p2.scale <= 0) continue;
    if (p2.y >= maxY) continue;
    
    drawSegs.push({ seg, p1, p2, idx });
  }
  
  // Draw from far to near
  for (let i = drawSegs.length - 1; i >= 0; i--) {
    const { seg, p1, p2, idx } = drawSegs[i];
    
    const isDark = (Math.floor(idx / 3)) % 2 === 0;
    
    // Grass
    const grassColor = isDark ? '#2d5016' : '#3a6b22';
    drawPolygon(ctx, grassColor, 0, p2.y, width, 0, p1.y, width);
    
    // Road
    const roadColor = isDark ? '#333' : '#3a3a3a';
    drawPolygon(ctx, roadColor, p1.x, p1.y, p1.w * 1.1, p2.x, p2.y, p2.w * 1.1);
    
    // Rumble strips
    const rumbleColor = isDark ? '#cc0000' : '#ffffff';
    drawPolygon(ctx, rumbleColor, p1.x, p1.y, p1.w * 1.15, p2.x, p2.y, p2.w * 1.15);
    drawPolygon(ctx, roadColor, p1.x, p1.y, p1.w * 1.1, p2.x, p2.y, p2.w * 1.1);
    
    // Lane markings
    if (!isDark) {
      const laneW1 = p1.w / 20;
      const laneW2 = p2.w / 20;
      for (let lane = -1; lane <= 1; lane += 2) {
        const lx1 = p1.x + p1.w * lane * 0.33;
        const lx2 = p2.x + p2.w * lane * 0.33;
        drawPolygon(ctx, '#ffffff', lx1, p1.y, laneW1, lx2, p2.y, laneW2);
      }
    }
    
    // Draw sprites
    if (seg.sprite && seg.sprite.active) {
      const spriteScale = p1.scale * 3000;
      const fontSize = Math.max(12, Math.min(80, spriteScale));
      const spriteX = p1.x + p1.w * seg.sprite.offset;
      
      ctx.font = `${fontSize}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(seg.sprite.emoji, spriteX, p1.y);
    }
    
    maxY = Math.min(maxY, p2.y);
  }
  
  // Draw player car
  drawPlayerCar(ctx, state, width, height);
  
  // Delivery progress bar
  drawDeliveryBar(ctx, state, width);
  
  // Horn effect
  if (state.hornActive) {
    ctx.font = `bold 32px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('📢 HONK!', width / 2, height / 2 - 100);
  }
}

function drawPlayerCar(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number) {
  const carY = height - 30;
  const carX = width / 2 + state.steering * 60;
  const carW = 80;
  const carH = 50;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(carX, carY, carW * 0.6, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Car body
  const carGrad = ctx.createLinearGradient(carX - carW / 2, carY - carH, carX + carW / 2, carY);
  carGrad.addColorStop(0, '#ff3333');
  carGrad.addColorStop(0.5, '#cc0000');
  carGrad.addColorStop(1, '#990000');
  
  // Main body
  ctx.fillStyle = carGrad;
  ctx.beginPath();
  ctx.roundRect(carX - carW / 2, carY - carH, carW, carH * 0.7, 8);
  ctx.fill();
  
  // Roof
  ctx.fillStyle = '#aa0000';
  ctx.beginPath();
  ctx.roundRect(carX - carW * 0.3, carY - carH - 15, carW * 0.6, 20, 6);
  ctx.fill();
  
  // Windshield
  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(carX - carW * 0.25, carY - carH - 12, carW * 0.5, 14);
  
  // Wheels
  ctx.fillStyle = '#222';
  ctx.fillRect(carX - carW / 2 - 5, carY - carH + 5, 10, 20);
  ctx.fillRect(carX + carW / 2 - 5, carY - carH + 5, 10, 20);
  ctx.fillRect(carX - carW / 2 - 5, carY - 20, 10, 20);
  ctx.fillRect(carX + carW / 2 - 5, carY - 20, 10, 20);
  
  // Tail lights
  ctx.fillStyle = state.speed < 5 ? '#ff0000' : '#ff6666';
  ctx.fillRect(carX - carW / 2 + 5, carY - 10, 8, 5);
  ctx.fillRect(carX + carW / 2 - 13, carY - 10, 8, 5);
  
  // Passenger (angry or happy)
  ctx.font = '20px serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.isAccident ? '😤' : '😎', carX + 15, carY - carH - 18);
}

function drawDeliveryBar(ctx: CanvasRenderingContext2D, state: GameState, width: number) {
  const barW = width - 40;
  const barH = 12;
  const barX = 20;
  const barY = 10;
  
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(barX, barY, barW, barH);
  
  const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  grad.addColorStop(0, '#22c55e');
  grad.addColorStop(1, '#4ade80');
  ctx.fillStyle = grad;
  ctx.fillRect(barX, barY, barW * state.deliveryProgress, barH);
  
  ctx.fillStyle = '#fff';
  ctx.font = '10px Orbitron';
  ctx.textAlign = 'left';
  ctx.fillText('📦 DELIVERY', barX + 4, barY + 10);
  
  // Delivery destination marker
  ctx.fillText('🏠', barX + barW - 15, barY + 11);
}
