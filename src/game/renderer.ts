import { GAME_CONFIG } from './config';

export interface CelebrationParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  emoji: string;
  alpha: number;
}

export interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
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
  celebrationTimer: number;
  celebrationParticles: CelebrationParticle[];
  celebrationFlashAlpha: number;
  // Delivery type for this round
  deliveryType: typeof GAME_CONFIG.deliveryTypes[0];
  gameTime: number;
  // Tire effects
  tireSmoke: SmokeParticle[];
  // Crash effects
  crashSmoke: SmokeParticle[];
  crashTimer: number; // seconds since crash
  crashSkipped: boolean;
  braking: boolean;
  collidedSprite?: { type: string; emoji: string; screenX?: number };
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

  // Celestial body (sun or moon) + clouds
  drawSky(ctx, scene, W, horizon, position);

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
function drawSmokeParticles(ctx: CanvasRenderingContext2D, particles: SmokeParticle[]) {
  for (const p of particles) {
    if (p.alpha <= 0) continue;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCrashScene(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const t = state.crashTimer;

  // Screen shake
  const shakeX = t < 0.5 ? (Math.random() - 0.5) * 12 * (1 - t * 2) : 0;
  const shakeY = t < 0.5 ? (Math.random() - 0.5) * 8 * (1 - t * 2) : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Red flash
  if (t < 0.3) {
    ctx.fillStyle = `rgba(255,0,0,${0.3 * (1 - t / 0.3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Hood smoke is drawn before the car (in main render) so it appears behind the driver.
  // Only draw any late-spawning smoke particles here as a safety pass — skipped to avoid covering driver.

  // Collided object — bumped ahead on impact then tumbles away
  if (state.collidedSprite) {
    const cx = W / 2 + state.steering * 40;
    // Object launches forward (up the screen = toward horizon) and slightly sideways
    const launchProgress = Math.min(t / 1.5, 1); // 0→1 over 1.5s
    const eased = 1 - Math.pow(1 - launchProgress, 2); // ease-out
    const bumpY = -eased * H * 0.35; // moves up toward horizon
    const bumpX = eased * 60 * (state.steering > 0 ? 1 : -1); // tumbles sideways
    const tumbleRotation = t * 4; // spin as it flies
    const shrink = Math.max(0.2, 1 - eased * 0.7); // gets smaller as it recedes
    const fadeAlpha = Math.max(0, 1 - launchProgress * 0.8);

    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    const objX = cx + bumpX + (Math.sin(t * 3) * 3);
    const objY = H - 55 + bumpY;
    ctx.translate(objX, objY);
    ctx.rotate(Math.sin(tumbleRotation) * 0.3);
    ctx.scale(shrink, shrink);

    if (state.collidedSprite.type === 'car') {
      drawObstacleCar(ctx, 0, 0, 1.2, state.collidedSprite.emoji);
    } else {
      ctx.font = '72px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.collidedSprite.emoji, 0, 0);
    }
    ctx.restore();
  }

  // Damage cracks on windshield
  const cx = W / 2 + state.steering * 40;
  const wy = H - 90;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 8, wy + 5);
  ctx.lineTo(cx - 2, wy + 15);
  ctx.lineTo(cx + 5, wy + 8);
  ctx.moveTo(cx + 3, wy + 5);
  ctx.lineTo(cx + 10, wy + 18);
  ctx.stroke();

  // "CRASH!" text
  if (t < 1.5) {
    const scale = Math.min(1, t * 5);
    ctx.save();
    ctx.translate(W / 2, H * 0.3);
    ctx.scale(scale, scale);
    ctx.font = 'bold 52px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText('💥 CRASH!', 0, 0);
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20;
    ctx.fillText('💥 CRASH!', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Angry passenger reaction text
  if (t > 0.8) {
    const reactions = GAME_CONFIG.accidentReactions;
    const reactionIdx = Math.floor(state.position * 7) % reactions.length;
    ctx.font = 'bold 16px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(reactions[reactionIdx], W / 2, H * 0.45);
    ctx.fillText(reactions[reactionIdx], W / 2, H * 0.45);
  }

  // Skip hint
  if (t > 1) {
    ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.3;
    ctx.font = '12px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('PRESS SPACE TO SKIP', W / 2, H * 0.55);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
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
    const screenX = W / 2 + (x - playerX * n * 0.32) * perspective * W * 0.3;
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

    // Ground — draw terrain bands that follow road curvature
    const leftBands = (sceneAny.leftBands as [string,string,number][] | undefined);
    const rightBands = (sceneAny.rightBands as [string,string,number][] | undefined);

    if (leftBands) {
      // Draw bands from outermost to innermost (painter's order)
      for (let b = leftBands.length - 1; b >= 0; b--) {
        const [col, colAlt, wMult] = leftBands[b];
        ctx.fillStyle = dark ? col : colAlt;
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.lineTo(cur.screenX - cur.screenW * wMult, y1);
        ctx.lineTo(prev.screenX - prev.screenW * wMult, y2 + 1);
        ctx.lineTo(0, y2 + 1);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      const leftGround = dark ? (sceneAny.groundLeft || '#1a7a08') : (sceneAny.groundLeftAlt || '#23991a');
      ctx.fillStyle = leftGround;
      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.lineTo(cur.screenX - cur.screenW * 1.2, y1);
      ctx.lineTo(prev.screenX - prev.screenW * 1.2, y2 + 1);
      ctx.lineTo(0, y2 + 1);
      ctx.closePath();
      ctx.fill();
    }

    if (rightBands) {
      for (let b = rightBands.length - 1; b >= 0; b--) {
        const [col, colAlt, wMult] = rightBands[b];
        ctx.fillStyle = dark ? col : colAlt;
        ctx.beginPath();
        ctx.moveTo(cur.screenX + cur.screenW * wMult, y1);
        ctx.lineTo(W, y1);
        ctx.lineTo(W, y2 + 1);
        ctx.lineTo(prev.screenX + prev.screenW * wMult, y2 + 1);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      const rightGround = dark ? (sceneAny.groundRight || '#1a7a08') : (sceneAny.groundRightAlt || '#23991a');
      ctx.fillStyle = rightGround;
      ctx.beginPath();
      ctx.moveTo(cur.screenX + cur.screenW * 1.2, y1);
      ctx.lineTo(W, y1);
      ctx.lineTo(W, y2 + 1);
      ctx.lineTo(prev.screenX + prev.screenW * 1.2, y2 + 1);
      ctx.closePath();
      ctx.fill();
    }
    // Rumble strips — checkpoint checker pattern at finish line, classic red/white otherwise
    const rumbleC = inFinishZone
      ? (dark ? '#111111' : '#ffffff')
      : (dark ? '#d61d1d' : '#f0e6e6');
    drawTrap(ctx, rumbleC,
      cur.screenX, y1, cur.screenW * 1.2,
      prev.screenX, y2 + 1, prev.screenW * 1.2);

    // Road surface — checker stripe at finish line, normal asphalt otherwise
    const roadColor = inFinishZone ? (dark ? '#222222' : '#dddddd') : '#555555';
    drawTrap(ctx, roadColor,
      cur.screenX, y1 - 1, cur.screenW,
      prev.screenX, y2 + 1, prev.screenW);

    // Lane dividers (skip in finish zone — checker is the marker)
    if (dark && !inFinishZone) {
      const lw1 = Math.max(2, cur.screenW * 0.015);
      const lw2 = Math.max(2, prev.screenW * 0.015);
      const lane1Cur = cur.screenW * 0.33;
      const lane1Prev = prev.screenW * 0.33;
      drawTrap(ctx, '#e8e8e0', cur.screenX - lane1Cur, y1, lw1, prev.screenX - lane1Prev, y2, lw2);
      drawTrap(ctx, '#e8e8e0', cur.screenX + lane1Cur, y1, lw1, prev.screenX + lane1Prev, y2, lw2);
    }

    // Landscape scenery - spread across the full ground, not just road edge
    if (cur.idx % 3 === 0) {
      const distN = i;
      // Much steeper scale curve so near objects are huge like OutRun
      const baseScale = Math.max(0.12, Math.min(3.5, 6.0 / (distN + 0.8)));
      const sceneryY = Math.min(H - 14, prev.screenY);

      const leftEmojis = sceneAny.leftScenery || scene.scenery || [];
      const rightEmojis = sceneAny.rightScenery || scene.scenery || [];

      // Multiple placement columns on each side — all same size at same depth
      const placements = [
        { mult: 1.9,  freq: 3, seed: 7 },    // roadside (kept off the road)
        { mult: 2.6,  freq: 3, seed: 11 },   // near
        { mult: 3.6,  freq: 3, seed: 17 },   // mid
        { mult: 5.0,  freq: 6, seed: 23 },   // far
        { mult: 7.0,  freq: 6, seed: 31 },   // very far
        { mult: 10.0, freq: 9, seed: 37 },   // screen edge
      ];

      for (const p of placements) {
        if (cur.idx % p.freq !== 0) continue;
        const jitterY = ((cur.idx * p.seed) % 7 - 3) * baseScale * 0.3;

        // Left side
        if (leftEmojis.length > 0) {
          const jitterX = ((cur.idx * p.seed * 3) % 5 - 2) * 0.15;
          const leftX = prev.screenX - prev.screenW * (p.mult + jitterX);
          if (leftX > -20 && leftX < W + 20) {
            const eidx = Math.abs(cur.idx * p.seed + 3) % leftEmojis.length;
            const emoji = leftEmojis[eidx];
            const sizeHint = getEmojiSizeHint(emoji);
            const fontSize = Math.max(6, Math.min(180, 70 * baseScale * sizeHint));
            ctx.font = `${fontSize}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(emoji, leftX, sceneryY + jitterY);
          }
        }

        // Right side
        if (rightEmojis.length > 0) {
          const jitterX = ((cur.idx * p.seed * 7) % 5 - 2) * 0.15;
          const rightX = prev.screenX + prev.screenW * (p.mult + jitterX);
          if (rightX > -20 && rightX < W + 20) {
            const eidx = Math.abs(cur.idx * p.seed + 11) % rightEmojis.length;
            const emoji = rightEmojis[eidx];
            const sizeHint = getEmojiSizeHint(emoji);
            const fontSize = Math.max(6, Math.min(180, 70 * baseScale * sizeHint));
            ctx.font = `${fontSize}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(emoji, rightX, sceneryY + jitterY);
          }
        }
      }
    }
    // Destination marker — visible over a wider range
    if (segAbsDist >= destSeg - 12 && segAbsDist <= destSeg + 2) {
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
      const spriteScale = Math.max(0.22, Math.min(2.2, 5.0 / (distN + 0.8)));
      const spriteX = prev.screenX + prev.screenW * seg.sprite.offset;
      const spriteY = Math.min(H - 20, prev.screenY);

      if (seg.sprite.type === 'car') {
        // Subtle bobbing animation per-vehicle for life-like feel
        const seed = (cur.idx * 13) % 1000;
        const bob = Math.sin(state.gameTime * 6 + seed) * 1.2 * spriteScale;
        const sway = Math.sin(state.gameTime * 3 + seed * 0.3) * 0.6 * spriteScale;
        const animX = spriteX + sway;
        const animY = spriteY + bob;
        if (isNightScene(scene)) {
          drawOncomingHeadlights(ctx, animX, animY, spriteScale, seg.sprite.emoji);
        }
        drawObstacleCar(ctx, animX, animY, spriteScale, seg.sprite.emoji);
      } else {
        // Cap pedestrians/road obstacles much tighter to avoid the "giant head" pop at very close range
        const isPed = seg.sprite.type === 'pedestrian';
        const cappedScale = Math.min(spriteScale, isPed ? 1.1 : 1.4);
        const fSize = Math.max(16, Math.min(isPed ? 64 : 80, 60 * cappedScale));
        ctx.font = `${fSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(seg.sprite.emoji, spriteX, spriteY);
      }
    }
  }

  // Crash smoke from trunk — drawn BEFORE the car so it appears behind the driver
  if (state.isAccident && state.crashTimer > 0 && !state.crashSkipped) {
    drawSmokeParticles(ctx, state.crashSmoke);
  }

  // Player headlights (night only) — projected forward onto road
  if (isNightScene(state.scene)) {
    drawPlayerHeadlights(ctx, state, W, H);
  }

  // Player car
  drawCar(ctx, state, W, H);

  // Tire smoke
  drawSmokeParticles(ctx, state.tireSmoke);

  // Crash scene overlay (flash, text, collided object — no smoke here)
  if (state.isAccident && state.crashTimer > 0 && !state.crashSkipped) {
    drawCrashScene(ctx, state, W, H);
  }

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

// Size hints for emojis so buildings are large and small items are small relative to the car
function getEmojiSizeHint(emoji: string): number {
  // Trees (tall, should tower over car like OutRun palm trees)
  if ('🌲🌳🌴'.includes(emoji)) return 2.0;
  // Large structures
  if ('🏠🏡🏘️🏢🏬🏨🏗️🏪🏭🏚️⛪🛖🏕️🏠'.includes(emoji)) return 1.8;
  // Mountains, big landmarks
  if ('🏔️⛰️🗻🌋🏙️🌃🏝️'.includes(emoji)) return 1.6;
  // Medium objects
  if ('⛵🚢🏄⛱️🚏'.includes(emoji)) return 1.0;
  // Small items — shells, flowers, animals, skulls
  if ('🐚🌺🦎💀🦂🍂🍁🐠🦌🦜🍍❄️'.includes(emoji)) return 0.45;
  // Water effects (flat, not tall)
  if ('🌊💨🔥'.includes(emoji)) return 0.5;
  // Default
  return 0.8;
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

type VehicleKind = 'sedan' | 'sports' | 'taxi' | 'police' | 'truck' | 'bigtruck' | 'garbage' | 'hummer' | 'van';

function vehicleKindFromEmoji(emoji?: string): VehicleKind {
  switch (emoji) {
    case '🏎️': return 'sports';
    case '🚕': return 'taxi';
    case '🚓': return 'police';
    case '🚚': return 'truck';
    case '🚛': return 'bigtruck';
    case '🚜': return 'garbage';
    case '🚙': return 'hummer';
    case '🚐': return 'van';
    default:   return 'sedan';
  }
}

function drawObstacleCar(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, emoji?: string) {
  const kind = vehicleKindFromEmoji(emoji);
  const w0 = (kind === 'bigtruck' ? 92 : kind === 'truck' || kind === 'garbage' ? 84 : kind === 'hummer' ? 80 : 72) * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 3 * scale, w0 * 0.5, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  switch (kind) {
    case 'sports':   return drawSports(ctx, x, y, scale);
    case 'taxi':     return drawSedan(ctx, x, y, scale, '#facc15', true);
    case 'police':   return drawPolice(ctx, x, y, scale);
    case 'truck':    return drawTruck(ctx, x, y, scale, '#dc2626', false);
    case 'bigtruck': return drawTruck(ctx, x, y, scale, '#1e40af', true);
    case 'garbage':  return drawGarbage(ctx, x, y, scale);
    case 'hummer':   return drawHummer(ctx, x, y, scale);
    case 'van':      return drawVan(ctx, x, y, scale);
    default: {
      const palette = ['#3b82f6', '#10b981', '#f97316', '#a855f7', '#ef4444', '#0ea5e9'];
      const color = palette[Math.floor(Math.abs(x * 7 + y * 3)) % palette.length];
      return drawSedan(ctx, x, y, scale, color, false);
    }
  }
}

function tailLights(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, scale: number) {
  ctx.fillStyle = '#ff2222';
  ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 5 * scale;
  ctx.beginPath(); ctx.roundRect(cx - w / 2 + 2 * scale, cy - 8 * scale, 6 * scale, 4 * scale, scale); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + w / 2 - 8 * scale, cy - 8 * scale, 6 * scale, 4 * scale, scale); ctx.fill();
  ctx.shadowBlur = 0;
}
function wheels(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, s: number, h = 7) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(cx - w / 2 - 2 * s, cy - 4 * s, 5 * s, h * s);
  ctx.fillRect(cx + w / 2 - 3 * s, cy - 4 * s, 5 * s, h * s);
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.arc(cx - w / 2 + 0.5 * s, cy - 0.5 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + w / 2 - 0.5 * s, cy - 0.5 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
}
function plate(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(cx - 6 * s, cy - 3 * s, 12 * s, 4 * s, s); ctx.fill();
}

function drawSedan(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, isTaxi: boolean) {
  const w = 72 * s, h = 52 * s; const cx = x, cy = y;
  const g = ctx.createLinearGradient(cx, cy - h, cx, cy);
  g.addColorStop(0, color); g.addColorStop(1, shadeColor(color, -30));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h * 0.5, w, h * 0.5, [3 * s, 3 * s, 5 * s, 5 * s]); ctx.fill();
  ctx.fillStyle = shadeColor(color, -20);
  ctx.beginPath(); ctx.roundRect(cx - w * 0.34, cy - h, w * 0.68, h * 0.55, [5 * s, 5 * s, 0, 0]); ctx.fill();
  ctx.fillStyle = 'rgba(150,210,240,0.75)';
  ctx.beginPath(); ctx.roundRect(cx - w * 0.28, cy - h + 3 * s, w * 0.56, h * 0.32, [3 * s, 3 * s, 0, 0]); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(cx - w / 2 + 3 * s, cy - h * 0.18, w - 6 * s, 1.5 * s);
  if (isTaxi) {
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - w * 0.34, cy - h * 0.32, w * 0.68, 4 * s);
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.roundRect(cx - 6 * s, cy - h * 1.05, 12 * s, 5 * s, s); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = `bold ${3.5 * s}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', cx, cy - h * 1.05 + 2.5 * s);
  }
  tailLights(ctx, cx, cy, w, s);
  wheels(ctx, cx, cy, w, s);
  plate(ctx, cx, cy, s);
}

function drawSports(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const w = 76 * s, h = 42 * s; const cx = x, cy = y;
  const g = ctx.createLinearGradient(cx, cy - h, cx, cy);
  g.addColorStop(0, '#fde047'); g.addColorStop(1, '#a16207');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h * 0.18);
  ctx.lineTo(cx - w * 0.42, cy - h * 0.65);
  ctx.lineTo(cx + w * 0.42, cy - h * 0.65);
  ctx.lineTo(cx + w / 2, cy - h * 0.18);
  ctx.lineTo(cx + w / 2 - 3 * s, cy - 2 * s);
  ctx.lineTo(cx - w / 2 + 3 * s, cy - 2 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(40,40,60,0.85)';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.3, cy - h * 0.62);
  ctx.lineTo(cx - w * 0.18, cy - h * 0.95);
  ctx.lineTo(cx + w * 0.18, cy - h * 0.95);
  ctx.lineTo(cx + w * 0.3, cy - h * 0.62);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - w * 0.32, cy - h * 0.78, w * 0.64, 2 * s);
  ctx.fillRect(cx - w * 0.3, cy - h * 0.78, 2 * s, 6 * s);
  ctx.fillRect(cx + w * 0.3 - 2 * s, cy - h * 0.78, 2 * s, 6 * s);
  tailLights(ctx, cx, cy, w, s);
  wheels(ctx, cx, cy, w, s, 8);
  plate(ctx, cx, cy, s);
}

function drawPolice(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const w = 74 * s, h = 52 * s; const cx = x, cy = y;
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h * 0.5, w, h * 0.5, [3 * s, 3 * s, 5 * s, 5 * s]); ctx.fill();
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h * 0.5, w, h * 0.18, 3 * s); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx - w * 0.34, cy - h, w * 0.68, h * 0.55, [5 * s, 5 * s, 0, 0]); ctx.fill();
  ctx.fillStyle = 'rgba(150,210,240,0.8)';
  ctx.beginPath(); ctx.roundRect(cx - w * 0.28, cy - h + 3 * s, w * 0.56, h * 0.3, [3 * s, 3 * s, 0, 0]); ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(cx - w * 0.18, cy - h * 0.28, 4 * s, 0, Math.PI * 2); ctx.fill();
  const flashRed = (Math.floor(performance.now() / 200) % 2) === 0;
  ctx.fillStyle = '#222';
  ctx.fillRect(cx - w * 0.22, cy - h * 1.04, w * 0.44, 4 * s);
  ctx.fillStyle = flashRed ? '#ef4444' : '#1d4ed8';
  ctx.shadowColor = flashRed ? '#ff0000' : '#0044ff'; ctx.shadowBlur = 8 * s;
  ctx.fillRect(cx - w * 0.22, cy - h * 1.04, w * 0.22, 4 * s);
  ctx.fillStyle = flashRed ? '#1d4ed8' : '#ef4444';
  ctx.shadowColor = flashRed ? '#0044ff' : '#ff0000';
  ctx.fillRect(cx, cy - h * 1.04, w * 0.22, 4 * s);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1d4ed8';
  ctx.font = `bold ${3.2 * s}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('POLICE', cx + w * 0.05, cy - h * 0.3);
  tailLights(ctx, cx, cy, w, s);
  wheels(ctx, cx, cy, w, s);
}

function drawTruck(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, cabColor: string, big: boolean) {
  const w = (big ? 92 : 84) * s, h = (big ? 70 : 60) * s; const cx = x, cy = y;
  ctx.fillStyle = '#e5e7eb';
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h, w * 0.78, h - 6 * s, [3 * s, 0, 4 * s, 4 * s]); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const px = cx - w / 2 + (w * 0.78) * (i / 4);
    ctx.beginPath(); ctx.moveTo(px, cy - h + 4 * s); ctx.lineTo(px, cy - 8 * s); ctx.stroke();
  }
  const cabW = w * 0.26;
  const cabX = cx + w / 2 - cabW;
  const g = ctx.createLinearGradient(cabX, cy - h, cabX, cy);
  g.addColorStop(0, cabColor); g.addColorStop(1, shadeColor(cabColor, -30));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(cabX, cy - h * 0.78, cabW, h * 0.78 - 6 * s, [4 * s, 4 * s, 4 * s, 4 * s]); ctx.fill();
  ctx.fillStyle = 'rgba(150,210,240,0.8)';
  ctx.beginPath(); ctx.roundRect(cabX + 2 * s, cy - h * 0.7, cabW - 4 * s, h * 0.28, 2 * s); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(cabX + cabW - 3 * s, cy - h * 0.35, 3 * s, h * 0.2);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(cx - w / 2, cy - 8 * s, w, 3 * s);
  ctx.fillStyle = '#ff2222'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 5 * s;
  ctx.fillRect(cx - w / 2 + 1 * s, cy - 14 * s, 4 * s, 5 * s);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0a0a0a';
  const wheelY = cy - 4 * s;
  ctx.fillRect(cx - w / 2 + 2 * s, wheelY, 6 * s, 8 * s);
  ctx.fillRect(cx - w / 2 + 14 * s, wheelY, 6 * s, 8 * s);
  ctx.fillRect(cabX, wheelY, 6 * s, 8 * s);
  if (big) ctx.fillRect(cabX + cabW - 6 * s, wheelY, 6 * s, 8 * s);
}

function drawGarbage(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const w = 84 * s, h = 64 * s; const cx = x, cy = y;
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h * 0.85);
  ctx.lineTo(cx - w * 0.42, cy - h);
  ctx.lineTo(cx + w * 0.18, cy - h);
  ctx.lineTo(cx + w * 0.18, cy - 8 * s);
  ctx.lineTo(cx - w / 2, cy - 8 * s);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 5; i++) {
    const px = cx - w / 2 + (w * 0.68) * (i / 5);
    ctx.beginPath(); ctx.moveTo(px, cy - h * 0.95); ctx.lineTo(px, cy - 9 * s); ctx.stroke();
  }
  ctx.fillStyle = '#ca8a04';
  ctx.beginPath(); ctx.roundRect(cx + w * 0.18, cy - h * 0.7, w * 0.32, h * 0.7 - 8 * s, [4 * s, 4 * s, 3 * s, 3 * s]); ctx.fill();
  ctx.fillStyle = 'rgba(150,210,240,0.8)';
  ctx.beginPath(); ctx.roundRect(cx + w * 0.2, cy - h * 0.62, w * 0.28, h * 0.28, 2 * s); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(cx - w / 2 - 4 * s, cy - h * 0.5, 4 * s, h * 0.4);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(cx - w / 2, cy - 8 * s, w, 3 * s);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(cx - w / 2 + 4 * s, cy - 4 * s, 7 * s, 9 * s);
  ctx.fillRect(cx - w * 0.05, cy - 4 * s, 7 * s, 9 * s);
  ctx.fillRect(cx + w * 0.32, cy - 4 * s, 7 * s, 9 * s);
}

function drawHummer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const w = 80 * s, h = 60 * s; const cx = x, cy = y;
  const g = ctx.createLinearGradient(cx, cy - h, cx, cy);
  g.addColorStop(0, '#4d7c0f'); g.addColorStop(1, '#1a2e05');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h * 0.55, w, h * 0.55, 3 * s); ctx.fill();
  ctx.fillStyle = '#3f6212';
  ctx.fillRect(cx - w * 0.4, cy - h, w * 0.8, h * 0.5);
  ctx.fillStyle = 'rgba(120,180,200,0.7)';
  ctx.fillRect(cx - w * 0.34, cy - h + 3 * s, w * 0.68, h * 0.22);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - w * 0.42, cy - h - 2 * s, w * 0.84, 2 * s);
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx - w * 0.4 + i * w * 0.22, cy - h - 4 * s, 1.5 * s, 2 * s);
  }
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - w * 0.18, cy - h * 0.32, w * 0.36, h * 0.12);
  ctx.strokeStyle = '#777'; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const gx = cx - w * 0.18 + (w * 0.36) * (i / 6);
    ctx.beginPath(); ctx.moveTo(gx, cy - h * 0.32); ctx.lineTo(gx, cy - h * 0.2); ctx.stroke();
  }
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath(); ctx.arc(cx - w * 0.32, cy - h * 0.28, 3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + w * 0.32, cy - h * 0.28, 3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(cx - w / 2 - 3 * s, cy - 5 * s, 8 * s, 10 * s);
  ctx.fillRect(cx + w / 2 - 5 * s, cy - 5 * s, 8 * s, 10 * s);
  tailLights(ctx, cx, cy, w, s);
}

function drawVan(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const w = 76 * s, h = 60 * s; const cx = x, cy = y;
  ctx.fillStyle = '#e0e7ff';
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h, w, h - 6 * s, [10 * s, 10 * s, 4 * s, 4 * s]); ctx.fill();
  ctx.fillStyle = '#c7d2fe';
  ctx.beginPath();
  ctx.moveTo(cx + w / 2, cy - h * 0.55);
  ctx.lineTo(cx + w / 2, cy - 6 * s);
  ctx.lineTo(cx + w * 0.3, cy - 6 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(120,180,210,0.8)';
  ctx.beginPath(); ctx.roundRect(cx - w * 0.42, cy - h * 0.85, w * 0.5, h * 0.3, 2 * s); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + w * 0.1, cy - h * 0.85, w * 0.32, h * 0.28, 2 * s); ctx.fill();
  ctx.fillStyle = '#4f46e5';
  ctx.fillRect(cx - w / 2, cy - h * 0.42, w, 3 * s);
  tailLights(ctx, cx, cy, w, s);
  wheels(ctx, cx, cy, w, s, 8);
}

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function drawCar(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const baseCx = W / 2 + state.steering * 40;
  const cy = H - 10;
  const cw = 140, ch = 78;

  // Ground shadow (drawn flat, before rotation)
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(baseCx, cy + 3, cw * 0.55, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Apply steering rotation + slight lateral lean around rear axle pivot
  const steerAngle = state.steering * 0.09; // ~5° tilt
  const pivotY = cy - 4;
  ctx.save();
  ctx.translate(baseCx, pivotY);
  ctx.rotate(steerAngle);
  ctx.transform(1, 0, -state.steering * 0.08, 1, 0, 0); // subtle skew for body lean
  ctx.translate(-baseCx, -pivotY);
  // Inside this transform we still draw using baseCx/cy so geometry is unchanged
  const cx = baseCx;

  // ===== LOWER BODY (sleek wedge) =====
  const bodyG = ctx.createLinearGradient(cx, cy - ch * 0.6, cx, cy);
  bodyG.addColorStop(0, '#ff2a2a');
  bodyG.addColorStop(0.4, '#e60a0a');
  bodyG.addColorStop(0.85, '#a00505');
  bodyG.addColorStop(1, '#5a0202');
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2, cy - ch * 0.18);
  ctx.lineTo(cx - cw / 2 + 6, cy - ch * 0.55);
  ctx.lineTo(cx - cw * 0.42, cy - ch * 0.62);
  ctx.lineTo(cx + cw * 0.42, cy - ch * 0.62);
  ctx.lineTo(cx + cw / 2 - 6, cy - ch * 0.55);
  ctx.lineTo(cx + cw / 2, cy - ch * 0.18);
  ctx.lineTo(cx + cw / 2 - 4, cy - 4);
  ctx.lineTo(cx - cw / 2 + 4, cy - 4);
  ctx.closePath();
  ctx.fill();

  // Side body highlight
  const hlG = ctx.createLinearGradient(cx, cy - ch * 0.4, cx, cy - ch * 0.3);
  hlG.addColorStop(0, 'rgba(255,255,255,0.4)');
  hlG.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hlG;
  ctx.fillRect(cx - cw / 2 + 8, cy - ch * 0.4, cw - 16, 4);

  // Lower side skirt
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(cx - cw / 2 + 4, cy - ch * 0.18, cw - 8, 5);

  // ===== CABRIO COCKPIT (open top) =====
  ctx.fillStyle = '#1a0808';
  ctx.beginPath();
  ctx.roundRect(cx - cw * 0.36, cy - ch * 0.78, cw * 0.72, ch * 0.32, [10, 10, 4, 4]);
  ctx.fill();

  const seatG = ctx.createLinearGradient(cx, cy - ch * 0.78, cx, cy - ch * 0.5);
  seatG.addColorStop(0, '#3a1a0a');
  seatG.addColorStop(1, '#1a0808');
  ctx.fillStyle = seatG;
  ctx.beginPath();
  ctx.roundRect(cx - cw * 0.32, cy - ch * 0.74, cw * 0.64, ch * 0.22, [8, 8, 2, 2]);
  ctx.fill();

  // Windshield (small angled cabrio glass)
  const wsG = ctx.createLinearGradient(0, cy - ch, 0, cy - ch * 0.78);
  wsG.addColorStop(0, 'rgba(180,220,255,0.85)');
  wsG.addColorStop(1, 'rgba(80,140,200,0.5)');
  ctx.fillStyle = wsG;
  ctx.beginPath();
  ctx.moveTo(cx - cw * 0.28, cy - ch * 0.78);
  ctx.lineTo(cx - cw * 0.22, cy - ch * 0.95);
  ctx.lineTo(cx + cw * 0.22, cy - ch * 0.95);
  ctx.lineTo(cx + cw * 0.28, cy - ch * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,220,220,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Roll bars behind seats
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx - cw * 0.16, cy - ch * 0.74, 6, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + cw * 0.16, cy - ch * 0.74, 6, Math.PI, 0);
  ctx.stroke();

  // Passengers
  const celebrating = state.celebrating;
  drawPassenger(ctx, cx - 18, cy - ch * 0.62, 'man', state.isAccident, celebrating, state.gameTime);
  drawPassenger(ctx, cx + 18, cy - ch * 0.62, 'woman', state.isAccident, celebrating, state.gameTime);

  // Center console
  ctx.fillStyle = '#2a0a0a';
  ctx.fillRect(cx - 2, cy - ch * 0.66, 4, ch * 0.15);

  // ===== HOOD DETAILS =====
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - ch * 0.5, cw * 0.08, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - cw * 0.2, cy - ch * 0.6);
  ctx.lineTo(cx - cw * 0.3, cy - ch * 0.2);
  ctx.moveTo(cx + cw * 0.2, cy - ch * 0.6);
  ctx.lineTo(cx + cw * 0.3, cy - ch * 0.2);
  ctx.stroke();

  // ===== SIDE MIRRORS =====
  ctx.fillStyle = '#cc0000';
  ctx.beginPath();
  ctx.moveTo(cx - cw * 0.32, cy - ch * 0.78);
  ctx.lineTo(cx - cw * 0.32 - 11, cy - ch * 0.7);
  ctx.lineTo(cx - cw * 0.32 - 11, cy - ch * 0.6);
  ctx.lineTo(cx - cw * 0.32, cy - ch * 0.62);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + cw * 0.32, cy - ch * 0.78);
  ctx.lineTo(cx + cw * 0.32 + 11, cy - ch * 0.7);
  ctx.lineTo(cx + cw * 0.32 + 11, cy - ch * 0.6);
  ctx.lineTo(cx + cw * 0.32, cy - ch * 0.62);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(cx - cw * 0.32 - 10, cy - ch * 0.69, 8, 7);
  ctx.fillRect(cx + cw * 0.32 + 2, cy - ch * 0.69, 8, 7);

  // ===== WHEELS with alloy detail =====
  const wheelW = 14, wheelH = 22;
  const drawWheel = (wx: number, wy: number) => {
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.roundRect(wx, wy, wheelW, wheelH, 3);
    ctx.fill();
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(wx + wheelW / 2, wy + wheelH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(wx + wheelW / 2, wy + wheelH / 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 0.8;
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2 + state.gameTime * 8;
      ctx.beginPath();
      ctx.moveTo(wx + wheelW / 2, wy + wheelH / 2);
      ctx.lineTo(wx + wheelW / 2 + Math.cos(a) * 4, wy + wheelH / 2 + Math.sin(a) * 4);
      ctx.stroke();
    }
  };
  drawWheel(cx - cw / 2 - 3, cy - ch * 0.42);
  drawWheel(cx - cw / 2 - 3, cy - 18);
  drawWheel(cx + cw / 2 - 11, cy - ch * 0.42);
  drawWheel(cx + cw / 2 - 11, cy - 18);

  // ===== TAIL LIGHTS / BRAKE LIGHTS =====
  const braking = state.braking || state.speed < 5;
  const tailColor = braking ? '#ff2222' : '#992020';
  if (braking) { ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 22; }
  ctx.fillStyle = tailColor;
  const tailR = braking ? 5.5 : 4.5;
  ctx.beginPath(); ctx.arc(cx - cw / 2 + 12, cy - 10, tailR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - cw / 2 + 24, cy - 10, tailR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + cw / 2 - 12, cy - 10, tailR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + cw / 2 - 24, cy - 10, tailR, 0, Math.PI * 2); ctx.fill();
  // Center high-mount brake light
  if (braking) {
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(cx - 14, cy - ch * 0.5, 28, 3);
  }
  ctx.shadowBlur = 0;

  // Reverse / fog lights
  ctx.fillStyle = '#ffaa33';
  ctx.fillRect(cx - cw / 2 + 6, cy - 15, 4, 3);
  ctx.fillRect(cx + cw / 2 - 10, cy - 15, 4, 3);

  // ===== LICENSE PLATE =====
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(cx - 16, cy - 6, 32, 9, 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FERRARI', cx, cy - 1);

  // Prancing horse badge
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.roundRect(cx - 5, cy - 22, 10, 12, 1);
  ctx.fill();
  ctx.font = 'bold 9px serif';
  ctx.fillText('🐎', cx, cy - 16);
  ctx.restore();
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
    // Angry passenger hitting the driver
    const hitAnim = Math.sin(gameTime * 12) * 4;
    ctx.strokeStyle = '#fcd5a0';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    // Hitting arm toward driver (left = toward center)
    ctx.beginPath();
    ctx.moveTo(x - 4, drawY);
    ctx.lineTo(x - 12 + hitAnim, drawY - 2 + Math.abs(hitAnim) * 0.5);
    ctx.stroke();
    // Other arm flailing
    ctx.beginPath();
    ctx.moveTo(x + 4, drawY);
    ctx.lineTo(x + 8, drawY - 10 - hitAnim);
    ctx.stroke();
    // Angry face
    ctx.fillStyle = '#333';
    ctx.font = '10px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type === 'man' ? '😤' : '🤬', x, drawY + 4);
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

function drawSky(
  ctx: CanvasRenderingContext2D,
  scene: typeof GAME_CONFIG.scenes[0],
  W: number,
  horizon: number,
  position: number,
) {
  const name = scene.name.toLowerCase();
  const isNight = name.includes('night');
  const isRainy = name.includes('rainy');
  const isSnow = name.includes('snow');
  const isVolcano = name.includes('volcano');

  // Celestial body
  const bodyX = W * 0.72;
  const bodyY = horizon * 0.45;
  const bodyR = Math.min(W, horizon) * 0.08;

  if (isNight) {
    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97) % W);
      const sy = ((i * 53) % (horizon * 0.8));
      const r = (i % 3) * 0.4 + 0.4;
      ctx.fillRect(sx, sy, r, r);
    }
    // Moon with glow
    const glow = ctx.createRadialGradient(bodyX, bodyY, bodyR * 0.5, bodyX, bodyY, bodyR * 2.2);
    glow.addColorStop(0, 'rgba(230,230,255,0.45)');
    glow.addColorStop(1, 'rgba(230,230,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bodyX, bodyY, bodyR * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5f3e7';
    ctx.beginPath();
    ctx.arc(bodyX, bodyY, bodyR, 0, Math.PI * 2);
    ctx.fill();
    // Moon craters
    ctx.fillStyle = 'rgba(180,180,200,0.4)';
    ctx.beginPath();
    ctx.arc(bodyX - bodyR * 0.3, bodyY - bodyR * 0.2, bodyR * 0.18, 0, Math.PI * 2);
    ctx.arc(bodyX + bodyR * 0.25, bodyY + bodyR * 0.15, bodyR * 0.12, 0, Math.PI * 2);
    ctx.arc(bodyX + bodyR * 0.05, bodyY - bodyR * 0.4, bodyR * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (!isRainy) {
    // Sun with glow
    const sunColor = isVolcano ? '#ffeb6b' : '#fffbe0';
    const glow = ctx.createRadialGradient(bodyX, bodyY, bodyR * 0.6, bodyX, bodyY, bodyR * 2.8);
    glow.addColorStop(0, 'rgba(255,240,180,0.55)');
    glow.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bodyX, bodyY, bodyR * 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = sunColor;
    ctx.beginPath();
    ctx.arc(bodyX, bodyY, bodyR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clouds (skip volcano — uses smoke)
  if (!isVolcano) {
    const cloudColor = isNight ? 'rgba(180,180,210,0.35)'
      : isRainy ? 'rgba(80,85,100,0.7)'
      : isSnow ? 'rgba(255,255,255,0.85)'
      : 'rgba(255,255,255,0.75)';
    const cloudCount = 5;
    const scroll = (position * 0.4) % W;
    for (let i = 0; i < cloudCount; i++) {
      const seed = i * 137;
      const baseX = (seed % W);
      const x = ((baseX - scroll) % (W + 200) + W + 200) % (W + 200) - 100;
      const y = horizon * (0.15 + ((seed * 13) % 100) / 400);
      const scale = 0.7 + ((seed * 7) % 10) / 20;
      drawCloud(ctx, x, y, scale, cloudColor);
    }
  }
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number, color: string,
) {
  ctx.fillStyle = color;
  const r = 14 * scale;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.9, y - r * 0.4, r * 0.9, 0, Math.PI * 2);
  ctx.arc(x + r * 1.8, y, r * 0.85, 0, Math.PI * 2);
  ctx.arc(x + r * 0.9, y + r * 0.2, r * 1.1, 0, Math.PI * 2);
  ctx.arc(x + r * 2.4, y + r * 0.2, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

function isNightScene(scene: typeof GAME_CONFIG.scenes[0]): boolean {
  return scene.name.toLowerCase().includes('night');
}

function drawOncomingHeadlights(
  ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, emoji?: string,
) {
  const kind = vehicleKindFromEmoji(emoji);
  const w = (kind === 'bigtruck' ? 92 : kind === 'truck' || kind === 'garbage' ? 84 : kind === 'hummer' ? 80 : 72) * scale;
  const headY = y - 30 * scale;
  const lampR = Math.max(2, 5 * scale);
  const haloR = Math.max(8, 22 * scale);

  const halo = ctx.createRadialGradient(x, headY, 0, x, headY, haloR * 2);
  halo.addColorStop(0, 'rgba(255,240,180,0.55)');
  halo.addColorStop(0.5, 'rgba(255,230,140,0.18)');
  halo.addColorStop(1, 'rgba(255,220,100,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, headY, haloR * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = '#fff8c8';
  ctx.shadowBlur = 14 * scale;
  ctx.fillStyle = '#fffbe0';
  ctx.beginPath(); ctx.arc(x - w * 0.32, headY, lampR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.32, headY, lampR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPlayerHeadlights(
  ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number,
) {
  const baseCx = W / 2 + state.steering * 40;
  const cy = H - 10;
  const cw = 140;
  const lampL = { x: baseCx - cw * 0.36, y: cy - 50 };
  const lampR = { x: baseCx + cw * 0.36, y: cy - 50 };
  const horizonY = H * 0.55;
  const aim = baseCx + state.steering * 80;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const lamp of [lampL, lampR]) {
    const beam = ctx.createLinearGradient(lamp.x, lamp.y, aim, horizonY);
    beam.addColorStop(0, 'rgba(255,245,200,0.55)');
    beam.addColorStop(0.4, 'rgba(255,235,160,0.25)');
    beam.addColorStop(1, 'rgba(255,225,120,0)');
    ctx.fillStyle = beam;
    const spread = 60;
    ctx.beginPath();
    ctx.moveTo(lamp.x - 4, lamp.y);
    ctx.lineTo(lamp.x + 4, lamp.y);
    ctx.lineTo(aim + spread, horizonY);
    ctx.lineTo(aim - spread, horizonY);
    ctx.closePath();
    ctx.fill();
  }

  ctx.shadowColor = '#fff8c8';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#fffbe0';
  ctx.beginPath(); ctx.arc(lampL.x, lampL.y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(lampR.x, lampR.y, 5, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}
