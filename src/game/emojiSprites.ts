// Emoji as cached sprites.
//
// Drawing an emoji with fillText at a new font size every frame is very slow on some
// machines (Windows above all): each size is a new glyph to rasterise, and the roadside
// scenery alone draws a few hundred of them per frame. Here every emoji is rasterised once
// per size step into a small off-screen canvas and then scaled with drawImage.

const STEPS = [24, 48, 96, 192]; // glyph sizes in device pixels
const PAD = 0.25; // free space around the em square, as a share of the glyph size

interface Sprite {
  canvas: HTMLCanvasElement;
  side: number;
  bottom: number; // y of the em square's bottom edge inside the sprite
}

const cache = new Map<string, Sprite | null>();

function sprite(emoji: string, step: number): Sprite | null {
  const key = `${step}|${emoji}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let made: Sprite | null = null;
  const side = Math.ceil(step * (1 + 2 * PAD));
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const c = canvas.getContext('2d');
  if (c) {
    const bottom = Math.round(side - step * PAD);
    c.font = `${step}px serif`;
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    c.fillText(emoji, side / 2, bottom);
    made = { canvas, side, bottom };
  }
  cache.set(key, made);
  return made;
}

/**
 * Draws an emoji centred on x, with its bottom (or middle) at y: the same placement as
 * fillText with textAlign 'center' and textBaseline 'bottom' or 'middle'. The context's
 * globalAlpha applies as usual.
 */
export function drawEmoji(
  ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number,
  baseline: 'bottom' | 'middle' = 'bottom',
) {
  if (!(size > 0)) return;
  const t = ctx.getTransform();
  const wanted = size * (Math.hypot(t.a, t.b) || 1);
  const step = STEPS.find((s) => s >= wanted) ?? STEPS[STEPS.length - 1];
  const sp = sprite(emoji, step);
  if (!sp) {
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = baseline;
    ctx.fillText(emoji, x, y);
    return;
  }
  const k = size / step;
  const anchorY = baseline === 'bottom' ? sp.bottom : sp.bottom - step / 2;
  ctx.drawImage(sp.canvas, x - (sp.side * k) / 2, y - anchorY * k, sp.side * k, sp.side * k);
}
