import { GAME_CONFIG } from './config';

export interface GameState {
  position: number;
  speed: number;
  playerX: number;
  steering: number;
  segments: RoadSegment[];
  scene: typeof GAME_CONFIG.scenes[0];
  distance: number;
  deliveryProgress: number;
  isAccident: boolean;
  isDelivery: boolean;
  hornActive: boolean;
}

export interface RoadSegment {
  z: number;
  y: number;
  curve: number;
  sprite?: { type: 'car' | 'obstacle' | 'pedestrian'; emoji: string; offset: number; active: boolean };
}

const ROAD_W = 2000;
const CAM_D = 0.84;
const CAM_H = 1000;

export function createSegments(count: number): RoadSegment[] {
  const segs: RoadSegment[] = [];
  for (let i = 0; i < count; i++) {
    segs.push({
      z: i * GAME_CONFIG.segmentLength,
      y: Math.sin(i * 0.01) * 1500,
      curve: Math.sin(i * 0.02) * 2 + Math.cos(i * 0.007) * 3,
    });
  }
  return segs;
}

export function spawnObstacles(segments: RoadSegment[], playerSegIdx: number) {
  const cfg = GAME_CONFIG;
  for (let i = playerSegIdx + 20; i < playerSegIdx + cfg.drawDistance && i < segments.length; i++) {
    const seg = segments[i];
    if (seg.sprite) continue;
    if (Math.random() > 0.03) continue;

    const r = Math.random();
    let type: 'car' | 'obstacle' | 'pedestrian';
    let emojis: string[];
    if (r < 0.5) { type = 'car'; emojis = cfg.obstacles.cars; }
    else if (r < 0.8) { type = 'obstacle'; emojis = cfg.obstacles.roadObstacles; }
    else { type = 'pedestrian'; emojis = cfg.obstacles.pedestrians; }

    seg.sprite = {
      type,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      offset: (Math.random() - 0.5) * 1.2,
      active: true,
    };
  }
}

interface Projected {
  X: number; Y: number; W: number;
}

function projectPoint(
  worldZ: number, worldY: number, camZ: number, camY: number, camX: number,
  W: number, H: number
): Projected | null {
  const dz = worldZ - camZ;
  if (dz <= 0) return null;
  const scale = CAM_D / dz;
  return {
    X: W / 2 + scale * (-camX) * W,
    Y: H / 2 - scale * (worldY - camY) * H,
    W: scale * ROAD_W * W,
  };
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const { scene, segments, position, playerX } = state;
  const segLen = GAME_CONFIG.segmentLength;
  const N = segments.length;

  // Sky
  const skyG = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  skyG.addColorStop(0, scene.skyTop);
  skyG.addColorStop(1, scene.skyBottom);
  ctx.fillStyle = skyG;
  ctx.fillRect(0, 0, W, H);

  // Ground fill below horizon
  ctx.fillStyle = scene.groundColor;
  ctx.fillRect(0, H / 2, W, H / 2);

  const baseIdx = Math.floor(position / segLen);
  const baseSeg = segments[baseIdx % N];
  const camZ = position;
  const camY = CAM_H + (baseSeg?.y || 0);
  const camXworld = playerX * ROAD_W * 0.5;

  // Build projected points with curve offset
  const projected: (Projected & { idx: number })[] = [];
  let curveX = 0;
  let curveDx = 0;

  for (let n = 1; n <= GAME_CONFIG.drawDistance; n++) {
    const idx = (baseIdx + n) % N;
    const seg = segments[idx];
    const worldZ = position + n * segLen;

    const p = projectPoint(worldZ, seg.y, camZ, camY, camXworld - curveX, W, H);
    if (p) {
      projected.push({ ...p, idx });
    }

    curveDx += seg.curve;
    curveX += curveDx;
  }

  // Draw back to front
  let clipY = H;
  for (let i = projected.length - 1; i > 0; i--) {
    const cur = projected[i];
    const prev = projected[i - 1];
    const seg = segments[cur.idx];

    if (cur.Y >= clipY) continue;

    const dark = (Math.floor(cur.idx / 2)) % 2 === 0;

    // Grass
    ctx.fillStyle = dark ? '#1e6b0a' : '#2d8c15';
    ctx.fillRect(0, cur.Y, W, prev.Y - cur.Y + 1);

    // Rumble
    const rc = dark ? '#cc0000' : '#cccccc';
    drawQuad(ctx, rc,
      cur.X - cur.W * 1.2, cur.Y, cur.X + cur.W * 1.2, cur.Y,
      prev.X + prev.W * 1.2, prev.Y, prev.X - prev.W * 1.2, prev.Y);

    // Road
    const roadC = dark ? '#505050' : '#606060';
    drawQuad(ctx, roadC,
      cur.X - cur.W, cur.Y, cur.X + cur.W, cur.Y,
      prev.X + prev.W, prev.Y, prev.X - prev.W, prev.Y);

    // Lane markings
    if (!dark) {
      const lw1 = cur.W * 0.02;
      const lw2 = prev.W * 0.02;
      // Center
      drawQuad(ctx, '#fff',
        cur.X - lw1, cur.Y, cur.X + lw1, cur.Y,
        prev.X + lw2, prev.Y, prev.X - lw2, prev.Y);
      // Left lane
      const lo1 = cur.W * 0.33, lo2 = prev.W * 0.33;
      drawQuad(ctx, '#fff',
        cur.X - lo1 - lw1, cur.Y, cur.X - lo1 + lw1, cur.Y,
        prev.X - lo2 + lw2, prev.Y, prev.X - lo2 - lw2, prev.Y);
      // Right lane
      drawQuad(ctx, '#fff',
        cur.X + lo1 - lw1, cur.Y, cur.X + lo1 + lw1, cur.Y,
        prev.X + lo2 + lw2, prev.Y, prev.X + lo2 - lw2, prev.Y);
    }

    // Sprites
    if (seg.sprite?.active) {
      const spriteW = cur.W / ROAD_W;
      const fs = Math.max(12, Math.min(72, spriteW * 4000));
      const sx = cur.X + cur.W * seg.sprite.offset;
      ctx.font = `${fs}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(seg.sprite.emoji, sx, cur.Y);
    }

    if (cur.Y < clipY) clipY = cur.Y;
  }

  // Player car
  drawCar(ctx, state, W, H);

  // Delivery bar
  drawBar(ctx, state, W);

  if (state.hornActive) {
    ctx.font = 'bold 28px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffdd00';
    ctx.fillText('📢 HONK!', W / 2, H * 0.4);
  }
}

function drawQuad(
  ctx: CanvasRenderingContext2D, color: string,
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

function drawCar(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const cx = W / 2 + state.steering * 40;
  const cy = H - 15;
  const cw = 70, ch = 48;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, cw * 0.55, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const g = ctx.createLinearGradient(cx - cw / 2, cy - ch, cx + cw / 2, cy);
  g.addColorStop(0, '#ff4040');
  g.addColorStop(0.5, '#cc0000');
  g.addColorStop(1, '#880000');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(cx - cw / 2, cy - ch, cw, ch * 0.65, [8, 8, 3, 3]);
  ctx.fill();

  // Roof
  ctx.fillStyle = '#aa0000';
  ctx.beginPath();
  ctx.roundRect(cx - cw * 0.28, cy - ch - 13, cw * 0.56, 16, [5, 5, 0, 0]);
  ctx.fill();

  // Windshield
  ctx.fillStyle = 'rgba(135,206,235,0.85)';
  ctx.fillRect(cx - cw * 0.22, cy - ch - 10, cw * 0.44, 12);

  // Wheels
  ctx.fillStyle = '#111';
  for (const [wx, wy] of [
    [cx - cw / 2 - 3, cy - ch + 3],
    [cx + cw / 2 - 5, cy - ch + 3],
    [cx - cw / 2 - 3, cy - 17],
    [cx + cw / 2 - 5, cy - 17],
  ]) {
    ctx.fillRect(wx, wy, 8, 16);
  }

  // Tail lights
  const braking = state.speed < 5;
  ctx.fillStyle = braking ? '#ff0000' : '#ff6666';
  if (braking) { ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 8; }
  ctx.fillRect(cx - cw / 2 + 4, cy - 8, 7, 4);
  ctx.fillRect(cx + cw / 2 - 11, cy - 8, 7, 4);
  ctx.shadowBlur = 0;

  // Passenger
  ctx.font = '16px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(state.isAccident ? '😤' : '😎', cx + 13, cy - ch - 14);
}

function drawBar(ctx: CanvasRenderingContext2D, state: GameState, W: number) {
  const x = 20, y = 5, w = W - 40, h = 10;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();

  if (state.deliveryProgress > 0) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#22c55e');
    g.addColorStop(1, '#86efac');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(0, w * state.deliveryProgress), h, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#fff';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('📦', x + 2, y + h / 2);
  ctx.fillText('🏠', x + w - 10, y + h / 2);
}
