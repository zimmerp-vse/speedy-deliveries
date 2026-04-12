import { GAME_CONFIG } from './config';

export interface CelebrationParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  emoji: string;
  alpha: number;
}

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
  timeRemaining: number;
  // Celebration
  celebrating: boolean;
  celebrationTimer: number; // seconds remaining in celebration
  celebrationParticles: CelebrationParticle[];
  celebrationFlashAlpha: number;
  // Delivery type for this round
  deliveryType: typeof GAME_CONFIG.deliveryTypes[0];
  gameTime: number; // total elapsed time for animations
}

export interface RoadSegment {
  curve: number;
  hill: number;
  sprite?: { type: 'car' | 'obstacle' | 'pedestrian'; emoji: string; offset: number; active: boolean };
}

export function createSegments(count: number): RoadSegment[] {
  const segs: RoadSegment[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.max(0, i - 20);
    const curve = Math.sin(t * 0.015) * 0.15 + Math.sin(t * 0.04) * 0.08;
    segs.push({ curve, hill: Math.sin(i * 0.01) * 40 });
  }
  return segs;
}

export function spawnObstacles(segments: RoadSegment[], playerSegIdx: number) {
  const cfg = GAME_CONFIG;
  const totalSpawnChance = cfg.carSpawnRate + cfg.obstacleSpawnRate + cfg.pedestrianSpawnRate;
  if (Math.random() >= totalSpawnChance) return;

  const spawnStart = Math.min(segments.length - 1, playerSegIdx + 28);
  const spawnEnd = Math.min(segments.length - 1, playerSegIdx + 72);
  if (spawnStart >= spawnEnd) return;

  const spawnIdx = spawnStart + Math.floor(Math.random() * (spawnEnd - spawnStart + 1));
  const seg = segments[spawnIdx];
  if (seg.sprite) return;

  for (let i = Math.max(0, spawnIdx - 10); i <= Math.min(segments.length - 1, spawnIdx + 10); i++) {
    if (i !== spawnIdx && segments[i].sprite?.active) return;
  }

  const r = Math.random() * totalSpawnChance;
  let type: 'car' | 'obstacle' | 'pedestrian';
  let emojis: string[];

  if (r < cfg.carSpawnRate) {
    type = 'car'; emojis = cfg.obstacles.cars;
  } else if (r < cfg.carSpawnRate + cfg.obstacleSpawnRate) {
    type = 'obstacle'; emojis = cfg.obstacles.roadObstacles;
  } else {
    type = 'pedestrian'; emojis = cfg.obstacles.pedestrians;
  }

  const laneOffsets = [-0.58, 0, 0.58];
  const laneCenter = laneOffsets[Math.floor(Math.random() * laneOffsets.length)];

  seg.sprite = {
    type, emoji: emojis[Math.floor(Math.random() * emojis.length)],
    offset: laneCenter + (Math.random() - 0.5) * 0.06, active: true,
  };
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

  // Ground below horizon — split left/right for scene atmosphere
  const sceneAny = scene as any;
  ctx.fillStyle = sceneAny.groundLeft || '#23991a';
  ctx.fillRect(0, horizon, W / 2, H - horizon);
  ctx.fillStyle = sceneAny.groundRight || '#23991a';
  ctx.fillRect(W / 2, horizon, W / 2, H - horizon);

  // Parallax scroll offset
  const parallaxOffset = (position * 0.3) % W;

  // Distant horizon scenery (skyline — just above/at horizon)
  if ((scene as any).horizon?.length > 0) {
    const horizonEmojis = (scene as any).horizon as string[];
    const horizonY = horizon + 2;
    const spacing = W / 5;
    for (let layer = 0; layer < 2; layer++) {
      const layerOffset = parallaxOffset * (0.15 + layer * 0.1);
      const size = layer === 0 ? 28 : 20;
      const yOff = layer === 0 ? 0 : -4;
      ctx.globalAlpha = layer === 0 ? 0.5 : 0.35;
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (let i = -1; i < 7; i++) {
        const baseX = i * spacing - (layerOffset % spacing);
        const emoji = horizonEmojis[Math.abs(i + layer * 3 + 50) % horizonEmojis.length];
        ctx.fillText(emoji, baseX, horizonY + yOff);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Midground scenery (scattered across landscape, avoiding road center)
  if ((scene as any).midground?.length > 0) {
    const mgEmojis = (scene as any).midground as string[];
    const mgSpacing = W / 4;
    for (let depth = 0; depth < 3; depth++) {
      const depthFactor = 0.03 + depth * 0.04;
      const mgY = horizon + (H - horizon) * depthFactor;
      const size = 14 + depth * 6;
      const scrollSpeed = 0.25 + depth * 0.15;
      const layerOffset = (parallaxOffset * scrollSpeed) % mgSpacing;
      ctx.globalAlpha = 0.45 + depth * 0.15;
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (let i = -1; i < 8; i++) {
        const baseX = i * mgSpacing - layerOffset + (depth % 2) * mgSpacing * 0.5;
        if (baseX < W * 0.28 || baseX > W * 0.72) {
          const emoji = mgEmojis[Math.abs(i + depth * 5 + 30) % mgEmojis.length];
          ctx.fillText(emoji, baseX, mgY);
        }
      }
    }
    ctx.globalAlpha = 1;
  }


  const lines: { screenY: number; screenX: number; screenW: number; idx: number; absDist: number }[] = [];
  let x = 0, dx = 0;
  const playerAbsPos = Math.floor(position);

  for (let n = 1; n <= drawDist; n++) {
    const idx = (baseIdx + n) % N;
    const seg = segments[idx];
    const perspective = 1 / n;
    const screenY = horizon + (H - horizon) * perspective;
    const roadHalfW = W * 0.35 * perspective;
    const screenX = W / 2 + (x - playerX * n * 0.12) * perspective * W * 0.3;
    lines.push({ screenY, screenX, screenW: roadHalfW, idx, absDist: playerAbsPos + n });
    dx += seg.curve * 0.5;
    dx *= 0.98;
    x += dx;
  }

  // Destination segment info
  const cfg = GAME_CONFIG;
  const destSegStart = cfg.deliveryDistance - cfg.destinationVisibleDistance;
  const destSeg = cfg.deliveryDistance;

  // Draw from farthest to nearest
  for (let i = lines.length - 1; i > 0; i--) {
    const cur = lines[i];
    const prev = lines[i - 1];
    const seg = segments[prev.idx];
    const dark = Math.floor(cur.idx / 3) % 2 === 0;

    const y1 = Math.floor(cur.screenY);
    const y2 = Math.ceil(prev.screenY);
    if (y2 <= y1) continue;

    // Check if this segment is in the finish zone using absolute distance
    const segAbsDist = prev.absDist;
    const inFinishZone = segAbsDist >= destSegStart && segAbsDist <= destSeg;

    // Ground — draw as trapezoids that follow road curvature
    const leftGround = inFinishZone
      ? (dark ? '#0e8a2e' : '#18b840')
      : (dark ? (sceneAny.groundLeft || '#1a7a08') : (sceneAny.groundLeftAlt || '#23991a'));
    const rightGround = inFinishZone
      ? (dark ? '#0e8a2e' : '#18b840')
      : (dark ? (sceneAny.groundRight || '#1a7a08') : (sceneAny.groundRightAlt || '#23991a'));

    // Left ground: from screen left edge to road left edge (follows curve)
    ctx.fillStyle = leftGround;
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(cur.screenX - cur.screenW * 1.2, y1);
    ctx.lineTo(prev.screenX - prev.screenW * 1.2, y2 + 1);
    ctx.lineTo(0, y2 + 1);
    ctx.closePath();
    ctx.fill();

    // Right ground: from road right edge to screen right edge (follows curve)
    ctx.fillStyle = rightGround;
    ctx.beginPath();
    ctx.moveTo(cur.screenX + cur.screenW * 1.2, y1);
    ctx.lineTo(W, y1);
    ctx.lineTo(W, y2 + 1);
    ctx.lineTo(prev.screenX + prev.screenW * 1.2, y2 + 1);
    ctx.closePath();
    ctx.fill();
    const rumbleC = inFinishZone
      ? (dark ? '#ffffff' : '#222222')
      : (dark ? '#d61d1d' : '#f0e6e6');
    drawTrap(ctx, rumbleC,
      cur.screenX, y1, cur.screenW * 1.2,
      prev.screenX, y2 + 1, prev.screenW * 1.2);

    // Road surface - green tint in finish zone
    const roadColor = inFinishZone ? '#447744' : '#555555';
    drawTrap(ctx, roadColor,
      cur.screenX, y1 - 1, cur.screenW,
      prev.screenX, y2 + 1, prev.screenW);

    // Lane dividers
    if (dark) {
      const lw1 = Math.max(2, cur.screenW * 0.015);
      const lw2 = Math.max(2, prev.screenW * 0.015);
      const lane1Cur = cur.screenW * 0.33;
      const lane1Prev = prev.screenW * 0.33;
      const lineColor = inFinishZone ? '#aaffaa' : '#e8e8e0';
      drawTrap(ctx, lineColor, cur.screenX - lane1Cur, y1, lw1, prev.screenX - lane1Prev, y2, lw2);
      drawTrap(ctx, lineColor, cur.screenX + lane1Cur, y1, lw1, prev.screenX + lane1Prev, y2, lw2);
    }

    // Landscape scenery - spread across the full ground, not just road edge
    if (cur.idx % 4 === 0) {
      const distN = i;
      const baseScale = Math.max(0.15, Math.min(2.2, 4.0 / (distN + 1.0)));
      const sceneryY = Math.min(H - 10, prev.screenY);

      const leftEmojis = sceneAny.leftScenery || scene.scenery || [];
      const rightEmojis = sceneAny.rightScenery || scene.scenery || [];

      // Multiple placement depths on each side
      const placements = [
        { mult: 1.3, sizeF: 1.0, freq: 4, seed: 7 },   // close to road
        { mult: 2.0, sizeF: 0.75, freq: 5, seed: 13 },  // mid distance
        { mult: 3.2, sizeF: 0.55, freq: 6, seed: 19 },  // far from road
        { mult: 4.8, sizeF: 0.4, freq: 8, seed: 29 },   // very far / edge of screen
      ];

      for (const p of placements) {
        if (cur.idx % p.freq !== 0) continue;
        const fontSize = Math.max(6, Math.min(72, 55 * baseScale * p.sizeF));
        const jitterY = ((cur.idx * p.seed) % 7 - 3) * baseScale * 0.5;
        ctx.font = `${fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // Left side
        if (leftEmojis.length > 0) {
          const jitterX = ((cur.idx * p.seed * 3) % 5 - 2) * 0.15;
          const leftX = prev.screenX - prev.screenW * (p.mult + jitterX);
          const eidx = Math.abs(cur.idx * p.seed + 3) % leftEmojis.length;
          ctx.fillText(leftEmojis[eidx], leftX, sceneryY + jitterY);
        }

        // Right side
        if (rightEmojis.length > 0) {
          const jitterX = ((cur.idx * p.seed * 7) % 5 - 2) * 0.15;
          const rightX = prev.screenX + prev.screenW * (p.mult + jitterX);
          const eidx = Math.abs(cur.idx * p.seed + 11) % rightEmojis.length;
          ctx.fillText(rightEmojis[eidx], rightX, sceneryY + jitterY);
        }
      }
    }
    if (segAbsDist >= destSeg - 2 && segAbsDist <= destSeg + 2) {
      const distN = i;
      const scale = Math.max(0.3, Math.min(2.0, 4.0 / (distN + 1.15)));
      const destX = prev.screenX;
      const destY = Math.min(H - 18, prev.screenY);

      // Glow behind destination
      const glowRadius = 40 * scale;
      const glow = ctx.createRadialGradient(destX, destY - glowRadius * 0.5, 0, destX, destY - glowRadius * 0.5, glowRadius);
      glow.addColorStop(0, 'rgba(255,255,100,0.4)');
      glow.addColorStop(1, 'rgba(255,255,100,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(destX, destY - glowRadius * 0.5, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Destination emoji
      const fontSize = Math.max(20, Math.min(100, 65 * scale));
      ctx.font = `${fontSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(state.deliveryType.emoji, destX, destY);

      // Flags on road edges
      const flagSize = Math.max(12, Math.min(50, 30 * scale));
      ctx.font = `${flagSize}px serif`;
      ctx.fillText('🚩', destX - prev.screenW * 0.9, destY);
      ctx.fillText('🚩', destX + prev.screenW * 0.9, destY);

      // Waving person next to destination
      drawWavingPerson(ctx, destX + fontSize * 0.7, destY, scale, state.gameTime, state.deliveryType);
    }

    // Sprites
    if (seg.sprite?.active) {
      const distN = i;
      const spriteScale = Math.max(0.22, Math.min(1.6, 3.4 / (distN + 1.15)));
      const spriteX = prev.screenX + prev.screenW * seg.sprite.offset;
      const spriteY = Math.min(H - 18, prev.screenY);

      if (seg.sprite.type === 'car') {
        drawObstacleCar(ctx, spriteX, spriteY, spriteScale);
      } else {
        const fSize = Math.max(16, Math.min(88, 58 * spriteScale));
        ctx.font = `${fSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(seg.sprite.emoji, spriteX, spriteY);
      }
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

  // Celebration effects
  if (state.celebrating) {
    drawCelebrationEffects(ctx, state, W, H);
  }
}

function drawWavingPerson(
  ctx: CanvasRenderingContext2D, x: number, y: number, scale: number,
  gameTime: number, deliveryType: typeof GAME_CONFIG.deliveryTypes[0]
) {
  const waveOffset = Math.sin(gameTime * 5) * 6 * scale;
  const fontSize = Math.max(14, Math.min(60, 40 * scale));

  // Person
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(deliveryType.waver, x, y);

  // Waving hand above person
  const handSize = fontSize * 0.6;
  ctx.font = `${handSize}px serif`;
  ctx.fillText(deliveryType.waverEmoji, x + waveOffset, y - fontSize * 0.8);
}

function drawCelebrationEffects(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  // Flash overlay
  if (state.celebrationFlashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.celebrationFlashAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Particles
  for (const p of state.celebrationParticles) {
    if (p.alpha <= 0) continue;
    ctx.globalAlpha = p.alpha;
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.emoji, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  // "DELIVERED!" text with scale-in
  const t = 1 - (state.celebrationTimer / (GAME_CONFIG.celebrationDurationMs / 1000));
  const textScale = Math.min(1, t * 3); // quick scale in
  if (textScale > 0) {
    ctx.save();
    ctx.translate(W / 2, H * 0.35);
    ctx.scale(textScale, textScale);
    ctx.font = 'bold 48px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText('DELIVERED! 🎉', 0, 0);
    ctx.fillStyle = '#22c55e';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 20;
    ctx.fillText('DELIVERED! 🎉', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
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

function drawObstacleCar(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const w = 58 * scale, h = 42 * scale;
  const cx = x, cy = y;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2 * scale, w * 0.45, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const colors = ['#3b82f6', '#eab308', '#10b981', '#f97316', '#a855f7', '#ef4444'];
  const color = colors[Math.floor(Math.abs(x * 7 + y * 3)) % colors.length];

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h * 0.5, w, h * 0.5, [2 * scale, 2 * scale, 4 * scale, 4 * scale]);
  ctx.fill();

  ctx.fillStyle = shadeColor(color, -25);
  ctx.beginPath();
  ctx.roundRect(cx - w * 0.35, cy - h, w * 0.7, h * 0.55, [4 * scale, 4 * scale, 0, 0]);
  ctx.fill();

  ctx.fillStyle = 'rgba(135,206,235,0.7)';
  ctx.beginPath();
  ctx.roundRect(cx - w * 0.28, cy - h + 3 * scale, w * 0.56, h * 0.35, [3 * scale, 3 * scale, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#ff2222';
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 4 * scale;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 + 2 * scale, cy - h * 0.15, 6 * scale, 4 * scale, scale);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + w / 2 - 8 * scale, cy - h * 0.15, 6 * scale, 4 * scale, scale);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#111';
  ctx.fillRect(cx - w / 2 - 2 * scale, cy - 4 * scale, 5 * scale, 6 * scale);
  ctx.fillRect(cx + w / 2 - 3 * scale, cy - 4 * scale, 5 * scale, 6 * scale);

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(cx - 6 * scale, cy - 3 * scale, 12 * scale, 4 * scale, scale);
  ctx.fill();
}

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function drawCar(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const cx = W / 2 + state.steering * 30;
  const cy = H - 8;
  const cw = 90, ch = 60;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, cw * 0.52, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyG = ctx.createLinearGradient(cx - cw / 2, cy - ch, cx + cw / 2, cy);
  bodyG.addColorStop(0, '#ff3333');
  bodyG.addColorStop(0.3, '#ee1111');
  bodyG.addColorStop(0.7, '#cc0000');
  bodyG.addColorStop(1, '#880000');
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.roundRect(cx - cw / 2, cy - ch * 0.55, cw, ch * 0.55, [4, 4, 6, 6]);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(cx - cw / 2 + 4, cy - ch * 0.5, cw - 8, 3);

  ctx.fillStyle = '#bb0000';
  ctx.beginPath();
  ctx.roundRect(cx - cw * 0.35, cy - ch, cw * 0.7, ch * 0.5, [6, 6, 0, 0]);
  ctx.fill();

  const wsG = ctx.createLinearGradient(0, cy - ch, 0, cy - ch * 0.55);
  wsG.addColorStop(0, 'rgba(180,220,255,0.9)');
  wsG.addColorStop(1, 'rgba(100,160,220,0.7)');
  ctx.fillStyle = wsG;
  ctx.beginPath();
  ctx.roundRect(cx - cw * 0.3, cy - ch + 4, cw * 0.6, ch * 0.38, [4, 4, 0, 0]);
  ctx.fill();

  ctx.strokeStyle = '#990000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - cw * 0.3, cy - ch + 4, cw * 0.6, ch * 0.38, [4, 4, 0, 0]);
  ctx.stroke();

  // Passengers - celebrating if delivering
  const celebrating = state.celebrating;
  drawPassenger(ctx, cx - 10, cy - ch + 2, 'man', state.isAccident, celebrating, state.gameTime);
  drawPassenger(ctx, cx + 10, cy - ch + 2, 'woman', state.isAccident, celebrating, state.gameTime);

  // Side mirrors
  ctx.fillStyle = '#cc0000';
  ctx.beginPath();
  ctx.moveTo(cx - cw * 0.35, cy - ch * 0.7);
  ctx.lineTo(cx - cw * 0.35 - 10, cy - ch * 0.65);
  ctx.lineTo(cx - cw * 0.35 - 10, cy - ch * 0.55);
  ctx.lineTo(cx - cw * 0.35, cy - ch * 0.55);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + cw * 0.35, cy - ch * 0.7);
  ctx.lineTo(cx + cw * 0.35 + 10, cy - ch * 0.65);
  ctx.lineTo(cx + cw * 0.35 + 10, cy - ch * 0.55);
  ctx.lineTo(cx + cw * 0.35, cy - ch * 0.55);
  ctx.fill();
  ctx.fillStyle = 'rgba(135,206,235,0.6)';
  ctx.fillRect(cx - cw * 0.35 - 9, cy - ch * 0.64, 8, 8);
  ctx.fillRect(cx + cw * 0.35 + 2, cy - ch * 0.64, 8, 8);

  // Wheels
  ctx.fillStyle = '#111';
  const wheelW = 10, wheelH = 16;
  ctx.fillRect(cx - cw / 2 - 4, cy - ch * 0.48, wheelW, wheelH);
  ctx.fillRect(cx - cw / 2 - 4, cy - 14, wheelW, wheelH);
  ctx.fillRect(cx + cw / 2 - 6, cy - ch * 0.48, wheelW, wheelH);
  ctx.fillRect(cx + cw / 2 - 6, cy - 14, wheelW, wheelH);
  ctx.fillStyle = '#333';
  ctx.fillRect(cx - cw / 2 - 2, cy - ch * 0.45, 6, 3);
  ctx.fillRect(cx + cw / 2 - 4, cy - ch * 0.45, 6, 3);

  // Tail lights
  const braking = state.speed < 5;
  ctx.fillStyle = braking ? '#ff0000' : '#cc3333';
  if (braking) { ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 12; }
  ctx.beginPath();
  ctx.roundRect(cx - cw / 2 + 4, cy - 8, 10, 5, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + cw / 2 - 14, cy - 8, 10, 5, 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ff8800';
  ctx.fillRect(cx - cw / 2 + 4, cy - 14, 6, 3);
  ctx.fillRect(cx + cw / 2 - 10, cy - 14, 6, 3);

  // License plate
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(cx - 12, cy - 5, 24, 8, 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = 'bold 5px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OUT-RUN', cx, cy - 1);

  ctx.fillStyle = '#ddd';
  ctx.font = '4px sans-serif';
  ctx.fillText('TURBO', cx, cy - 18);
}

function drawPassenger(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  type: 'man' | 'woman', isAccident: boolean, celebrating: boolean, gameTime: number
) {
  // Celebration bounce
  const bounceY = celebrating ? Math.sin(gameTime * 8) * 4 : 0;
  const drawY = y - bounceY;

  // Head
  ctx.fillStyle = '#fcd5a0';
  ctx.beginPath();
  ctx.arc(x, drawY - 4, 6, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  if (type === 'man') {
    ctx.fillStyle = '#6b3e1f';
    ctx.beginPath();
    ctx.arc(x, drawY - 7, 6, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.fillRect(x - 5, drawY - 9, 10, 4);
  } else {
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.arc(x, drawY - 7, 6.5, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.fillRect(x - 6, drawY - 9, 12, 4);
    ctx.fillRect(x - 7, drawY - 7, 3, 10);
    ctx.fillRect(x + 4, drawY - 7, 3, 10);
  }

  if (celebrating) {
    // Raised arms!
    const armWave = Math.sin(gameTime * 10 + (type === 'woman' ? 1 : 0)) * 3;
    ctx.strokeStyle = '#fcd5a0';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    // Left arm raised
    ctx.beginPath();
    ctx.moveTo(x - 5, drawY);
    ctx.lineTo(x - 8 + armWave, drawY - 14);
    ctx.stroke();
    // Right arm raised
    ctx.beginPath();
    ctx.moveTo(x + 5, drawY);
    ctx.lineTo(x + 8 - armWave, drawY - 14);
    ctx.stroke();
    // Happy face
    ctx.fillStyle = '#333';
    ctx.font = '8px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('😄', x, drawY + 4);
  } else if (isAccident) {
    ctx.fillStyle = '#333';
    ctx.font = '8px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('>', x - 3, drawY - 4);
    ctx.fillText('<', x + 3, drawY - 4);
    ctx.fillStyle = '#c00';
    ctx.fillText(type === 'man' ? '😤' : '😱', x, drawY + 6);
  } else {
    // Sunglasses
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 5, drawY - 6, 4, 3);
    ctx.fillRect(x + 1, drawY - 6, 4, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x - 4, drawY - 6, 2, 1);
    ctx.fillRect(x + 2, drawY - 6, 2, 1);
  }
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
  ctx.fillText(state.deliveryType.emoji, x + w - 10, y + h / 2);
}
