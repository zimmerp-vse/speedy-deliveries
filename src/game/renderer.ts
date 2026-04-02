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
  curve: number;
  hill: number;
  sprite?: { type: 'car' | 'obstacle' | 'pedestrian'; emoji: string; offset: number; active: boolean };
}

export function createSegments(count: number): RoadSegment[] {
  const segs: RoadSegment[] = [];
  for (let i = 0; i < count; i++) {
    segs.push({
      curve: Math.sin(i * 0.02) * 0.3 + Math.cos(i * 0.007) * 0.5,
      hill: Math.sin(i * 0.01) * 40,
    });
  }
  return segs;
}

export function spawnObstacles(segments: RoadSegment[], playerSegIdx: number) {
  const cfg = GAME_CONFIG;
  for (let i = playerSegIdx + 15; i < playerSegIdx + 80 && i < segments.length; i++) {
    const seg = segments[i];
    if (seg.sprite) continue;
    if (Math.random() > 0.025) continue;

    const r = Math.random();
    let type: 'car' | 'obstacle' | 'pedestrian';
    let emojis: string[];
    if (r < 0.5) { type = 'car'; emojis = cfg.obstacles.cars; }
    else if (r < 0.8) { type = 'obstacle'; emojis = cfg.obstacles.roadObstacles; }
    else { type = 'pedestrian'; emojis = cfg.obstacles.pedestrians; }

    seg.sprite = {
      type,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      offset: (Math.random() - 0.5) * 1.4,
      active: true,
    };
  }
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const { scene, segments, position, playerX } = state;
  const N = segments.length;
  const drawDist = 120;
  const baseIdx = Math.floor(position) % N;
  const horizon = H * 0.4;

  // Sky gradient
  const skyG = ctx.createLinearGradient(0, 0, 0, horizon);
  skyG.addColorStop(0, scene.skyTop);
  skyG.addColorStop(1, scene.skyBottom);
  ctx.fillStyle = skyG;
  ctx.fillRect(0, 0, W, horizon);

  // Fill ground below horizon
  ctx.fillStyle = scene.groundColor;
  ctx.fillRect(0, horizon, W, H - horizon);

  // Build projected lines from near (bottom) to far (horizon)
  // Each line = one road segment
  const lines: {
    screenY: number; screenX: number; screenW: number; idx: number;
  }[] = [];

  let x = 0;
  let dx = 0;

  for (let n = 1; n <= drawDist; n++) {
    const idx = (baseIdx + n) % N;
    const seg = segments[idx];

    const perspective = 1 / n;
    const screenY = horizon + (H - horizon) * perspective;
    const roadHalfW = W * 0.35 * perspective;
    const screenX = W / 2 + x * perspective * W * 0.5 - playerX * perspective * W * 0.8;

    lines.push({ screenY, screenX, screenW: roadHalfW, idx });

    dx += seg.curve;
    x += dx;
  }

  // Draw from farthest to nearest
  for (let i = lines.length - 1; i > 0; i--) {
    const cur = lines[i];
    const prev = lines[i - 1];
    const seg = segments[cur.idx];
    const dark = (Math.floor(cur.idx / 2)) % 2 === 0;

    const y1 = cur.screenY;
    const y2 = prev.screenY;
    if (y2 <= y1) continue;

    // Grass
    ctx.fillStyle = dark ? '#1a7a08' : '#23991a';
    ctx.fillRect(0, y1, W, y2 - y1 + 1);

    // Rumble strips
    const rumbleC = dark ? '#dd1111' : '#dddddd';
    drawTrap(ctx, rumbleC,
      cur.screenX, y1, cur.screenW * 1.2,
      prev.screenX, y2, prev.screenW * 1.2);

    // Road surface
    const roadC = dark ? '#4a4a4a' : '#5a5a5a';
    drawTrap(ctx, roadC,
      cur.screenX, y1, cur.screenW,
      prev.screenX, y2, prev.screenW);

    // Lane markings (only on light segments)
    if (!dark) {
      const lw1 = cur.screenW * 0.015, lw2 = prev.screenW * 0.015;
      // Center
      drawTrap(ctx, '#fff',
        cur.screenX, y1, lw1,
        prev.screenX, y2, lw2);
      // Left lane
      drawTrap(ctx, '#fff',
        cur.screenX - cur.screenW * 0.33, y1, lw1,
        prev.screenX - prev.screenW * 0.33, y2, lw2);
      // Right lane
      drawTrap(ctx, '#fff',
        cur.screenX + cur.screenW * 0.33, y1, lw1,
        prev.screenX + prev.screenW * 0.33, y2, lw2);
    }

    // Sprites
    if (seg.sprite?.active && i > 3) {
      const fontSize = Math.max(10, Math.min(64, (y2 - y1) * 4));
      const spriteX = cur.screenX + cur.screenW * seg.sprite.offset;
      ctx.font = `${fontSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(seg.sprite.emoji, spriteX, y1);
    }
  }

  // Player car
  drawCar(ctx, state, W, H);

  // Delivery bar
  drawBar(ctx, state, W);

  // Horn
  if (state.hornActive) {
    ctx.font = 'bold 24px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffdd00';
    ctx.shadowColor = '#ffdd00';
    ctx.shadowBlur = 10;
    ctx.fillText('📢 HONK!', W / 2, horizon - 20);
    ctx.shadowBlur = 0;
  }
}

function drawTrap(
  ctx: CanvasRenderingContext2D, color: string,
  x1: number, y1: number, hw1: number,
  x2: number, y2: number, hw2: number
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - hw1, y1);
  ctx.lineTo(x1 + hw1, y1);
  ctx.lineTo(x2 + hw2, y2);
  ctx.lineTo(x2 - hw2, y2);
  ctx.closePath();
  ctx.fill();
}

function drawCar(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const cx = W / 2 + state.steering * 30;
  const cy = H - 12;
  const cw = 70, ch = 48;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, cw * 0.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const g = ctx.createLinearGradient(cx - cw / 2, cy - ch, cx + cw / 2, cy);
  g.addColorStop(0, '#ff4444');
  g.addColorStop(0.5, '#cc0000');
  g.addColorStop(1, '#880000');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(cx - cw / 2, cy - ch, cw, ch * 0.65, [8, 8, 3, 3]);
  ctx.fill();

  // Roof
  ctx.fillStyle = '#aa0000';
  ctx.beginPath();
  ctx.roundRect(cx - cw * 0.28, cy - ch - 12, cw * 0.56, 15, [5, 5, 0, 0]);
  ctx.fill();

  // Windshield
  ctx.fillStyle = 'rgba(135,206,235,0.85)';
  ctx.fillRect(cx - cw * 0.22, cy - ch - 9, cw * 0.44, 11);

  // Wheels
  ctx.fillStyle = '#111';
  for (const [wx, wy] of [
    [cx - cw / 2 - 3, cy - ch + 3],
    [cx + cw / 2 - 5, cy - ch + 3],
    [cx - cw / 2 - 3, cy - 16],
    [cx + cw / 2 - 5, cy - 16],
  ]) {
    ctx.fillRect(wx, wy, 8, 15);
  }

  // Tail lights
  const braking = state.speed < 5;
  ctx.fillStyle = braking ? '#ff0000' : '#ff6666';
  if (braking) { ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 8; }
  ctx.fillRect(cx - cw / 2 + 4, cy - 7, 7, 4);
  ctx.fillRect(cx + cw / 2 - 11, cy - 7, 7, 4);
  ctx.shadowBlur = 0;

  // Passenger
  ctx.font = '15px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(state.isAccident ? '😤' : '😎', cx + 12, cy - ch - 13);
}

function drawBar(ctx: CanvasRenderingContext2D, state: GameState, W: number) {
  const x = 20, y = 5, w = W - 40, h = 10;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();

  if (state.deliveryProgress > 0) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#22c55e'); g.addColorStop(1, '#86efac');
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
