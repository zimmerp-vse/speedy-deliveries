import { GAME_CONFIG } from './config';

export interface GameState {
  position: number;
  speed: number;
  playerX: number; // -1 to 1
  steering: number;
  segments: Segment[];
  scene: typeof GAME_CONFIG.scenes[0];
  distance: number;
  deliveryProgress: number;
  isAccident: boolean;
  isDelivery: boolean;
  hornActive: boolean;
}

export interface Segment {
  p: { world: { z: number; y: number }; screen: { x: number; y: number; w: number } };
  curve: number;
  hillY: number;
  sprite?: { type: 'car' | 'obstacle' | 'pedestrian'; emoji: string; offset: number; active: boolean };
}

export function createSegments(count: number): Segment[] {
  const segs: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const curve = Math.sin(i * 0.015) * 3 + Math.sin(i * 0.04) * 1.5;
    const hillY = Math.sin(i * 0.008) * 2000 + Math.cos(i * 0.013) * 1000;
    segs.push({
      p: { world: { z: i * GAME_CONFIG.segmentLength, y: hillY }, screen: { x: 0, y: 0, w: 0 } },
      curve,
      hillY,
    });
  }
  return segs;
}

export function spawnObstacles(segments: Segment[], playerSegIdx: number) {
  const cfg = GAME_CONFIG;
  for (let i = playerSegIdx + 30; i < playerSegIdx + cfg.drawDistance && i < segments.length; i++) {
    const seg = segments[i];
    if (seg.sprite) continue;
    if (Math.random() > (cfg.carSpawnRate + cfg.obstacleSpawnRate + cfg.pedestrianSpawnRate) / 60) continue;

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
  const segLen = GAME_CONFIG.segmentLength;
  const drawDist = GAME_CONFIG.drawDistance;

  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  skyGrad.addColorStop(0, scene.skyTop);
  skyGrad.addColorStop(1, scene.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  const baseIdx = Math.floor(position / segLen) % segments.length;
  const camH = 1500 + (segments[baseIdx]?.hillY || 0);

  // Project all visible segments
  let x = 0;
  let dx = 0;
  let maxY = H; // clip from bottom up

  for (let n = 0; n < drawDist; n++) {
    const idx = (baseIdx + n) % segments.length;
    const seg = segments[idx];
    const camDist = (seg.p.world.z - position) > 0
      ? seg.p.world.z - position
      : seg.p.world.z + segments.length * segLen - position;

    if (camDist <= 0) continue;

    const scale = (H / 2) / camDist;
    const projY = (H / 2) - scale * (seg.hillY - camH);
    const projW = scale * GAME_CONFIG.roadWidth;
    const projX = (W / 2) + scale * (x - playerX * GAME_CONFIG.roadWidth * 0.5) * 2;

    seg.p.screen.x = projX;
    seg.p.screen.y = projY;
    seg.p.screen.w = projW;

    x += dx;
    dx += seg.curve * 0.08;
  }

  // Draw from far to near
  for (let n = drawDist - 1; n > 0; n--) {
    const idx = (baseIdx + n) % segments.length;
    const pidx = (baseIdx + n - 1) % segments.length;
    const seg = segments[idx];
    const prev = segments[pidx];

    const sy = seg.p.screen.y;
    const py = prev.p.screen.y;

    if (sy >= maxY) continue;

    const isDark = (Math.floor(idx / 2)) % 2 === 0;

    // Grass - full width
    const grassCol = isDark ? '#2a6b1a' : '#35821f';
    ctx.fillStyle = grassCol;
    ctx.fillRect(0, sy, W, py - sy + 1);

    // Rumble strips
    const rumbleCol = isDark ? '#dd0000' : '#eeeeee';
    const sx = seg.p.screen.x, sw = seg.p.screen.w;
    const px = prev.p.screen.x, pw = prev.p.screen.w;

    drawTrapezoid(ctx, rumbleCol,
      sx, sy, sw * 1.15,
      px, py, pw * 1.15);

    // Road
    const roadCol = isDark ? '#555555' : '#666666';
    drawTrapezoid(ctx, roadCol,
      sx, sy, sw,
      px, py, pw);

    // Center line and lane markings
    if (!isDark) {
      // Lane dividers
      drawTrapezoid(ctx, '#ffffff',
        sx, sy, sw * 0.02,
        px, py, pw * 0.02);
      drawTrapezoid(ctx, '#ffffff',
        sx - sw * 0.33, sy, sw * 0.015,
        px - pw * 0.33, py, pw * 0.015);
      drawTrapezoid(ctx, '#ffffff',
        sx + sw * 0.33, sy, sw * 0.015,
        px + pw * 0.33, py, pw * 0.015);
    }

    // Sprites
    if (seg.sprite?.active) {
      const spriteScale = sw / GAME_CONFIG.roadWidth;
      const fontSize = Math.max(14, Math.min(80, spriteScale * 5000));
      const spriteX = sx + sw * seg.sprite.offset;

      ctx.font = `${fontSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(seg.sprite.emoji, spriteX, sy);
    }

    if (sy < maxY) maxY = sy;
  }

  // Player car
  drawPlayerCar(ctx, state, W, H);

  // Delivery bar
  drawDeliveryBar(ctx, state, W);

  // Horn
  if (state.hornActive) {
    ctx.font = 'bold 28px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffdd00';
    ctx.fillText('📢 HONK!', W / 2, H / 2 - 60);
  }
}

function drawTrapezoid(
  ctx: CanvasRenderingContext2D, color: string,
  x1: number, y1: number, w1: number,
  x2: number, y2: number, w2: number
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1);
  ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x2 - w2, y2);
  ctx.closePath();
  ctx.fill();
}

function drawPlayerCar(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const cx = W / 2 + state.steering * 40;
  const cy = H - 20;
  const cw = 70;
  const ch = 45;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, cw * 0.55, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const g = ctx.createLinearGradient(cx - cw / 2, cy - ch, cx + cw / 2, cy);
  g.addColorStop(0, '#ff4444');
  g.addColorStop(0.6, '#cc0000');
  g.addColorStop(1, '#880000');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(cx - cw / 2, cy - ch, cw, ch * 0.65, [8, 8, 4, 4]);
  ctx.fill();

  // Cabin
  ctx.fillStyle = '#aa0000';
  ctx.beginPath();
  ctx.roundRect(cx - cw * 0.28, cy - ch - 14, cw * 0.56, 18, [5, 5, 0, 0]);
  ctx.fill();

  // Windshield
  ctx.fillStyle = 'rgba(135,206,235,0.8)';
  ctx.fillRect(cx - cw * 0.22, cy - ch - 11, cw * 0.44, 13);

  // Wheels
  ctx.fillStyle = '#111';
  const wheelPositions = [
    [cx - cw / 2 - 4, cy - ch + 4, 8, 18],
    [cx + cw / 2 - 4, cy - ch + 4, 8, 18],
    [cx - cw / 2 - 4, cy - 18, 8, 18],
    [cx + cw / 2 - 4, cy - 18, 8, 18],
  ];
  for (const [wx, wy, ww, wh] of wheelPositions) {
    ctx.fillRect(wx, wy, ww, wh);
  }

  // Tail lights (glow when braking)
  ctx.fillStyle = state.speed < 5 ? '#ff0000' : '#ff6666';
  ctx.shadowColor = state.speed < 5 ? '#ff0000' : 'transparent';
  ctx.shadowBlur = state.speed < 5 ? 10 : 0;
  ctx.fillRect(cx - cw / 2 + 4, cy - 8, 8, 4);
  ctx.fillRect(cx + cw / 2 - 12, cy - 8, 8, 4);
  ctx.shadowBlur = 0;

  // Passenger emoji
  ctx.font = '18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(state.isAccident ? '😤' : '😎', cx + 14, cy - ch - 15);
}

function drawDeliveryBar(ctx: CanvasRenderingContext2D, state: GameState, W: number) {
  const bx = 20, by = 6, bw = W - 40, bh = 10;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 5);
  ctx.fill();

  const grd = ctx.createLinearGradient(bx, 0, bx + bw * state.deliveryProgress, 0);
  grd.addColorStop(0, '#22c55e');
  grd.addColorStop(1, '#86efac');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw * state.deliveryProgress, bh, 5);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = '9px Orbitron';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('📦', bx + 3, by + bh / 2);
  ctx.fillText('🏠', bx + bw - 12, by + bh / 2);
}
