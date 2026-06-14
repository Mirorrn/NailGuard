import type { FingerScore, Point } from "./classifier";

// Palette tuned to read as a deliberate HUD rather than debug noise.
const SAFE = "#34d399"; // green
const ALERT = "#f43f5e"; // red
const DIM = "rgba(255, 255, 255, 0.35)";

export type OverlayState = {
  mouth?: Point;
  fingers: FingerScore[];
  /** Overall biting confidence this frame, in [0, 1]. */
  score: number;
  /** Whether the alarm is currently latched on (drives the alert framing). */
  alerting: boolean;
};

/** Linear interpolate between two normalized points. */
export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function mix(from: string, to: string, t: number): string {
  // Blend two hex/rgb colors; only used for our known SAFE/ALERT hexes.
  const pa = parseColor(from);
  const pb = parseColor(to);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const b = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function parseColor(c: string): [number, number, number] {
  const h = c.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Draws the detection overlay onto an already-painted video frame.
 *
 * The canvas is mirrored in CSS (`scaleX(-1)`) so the feed reads like a selfie;
 * markers drawn in raw normalized space therefore line up with the mirrored
 * image automatically. Text, however, would render backwards — so any labels
 * are drawn inside a locally un-mirrored transform.
 *
 * `markerScale` is the face size in pixels (inter-ocular distance), so every
 * marker stays proportional to the user whether near or far from the camera.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  state: OverlayState,
  markerScale: number
): void {
  const { width, height } = ctx.canvas;
  const px = (p: Point) => ({ x: p.x * width, y: p.y * height });

  // Base radius derived from face size, clamped so it never vanishes or bloats.
  const r = Math.max(4, Math.min(14, markerScale * width * 0.06));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const mouth = state.mouth ? px(state.mouth) : undefined;

  // Find the most "biting" finger so we can emphasize the active measurement.
  let lead: FingerScore | undefined;
  for (const f of state.fingers) {
    if (!lead || f.score > lead.score) lead = f;
  }

  // 1) Connecting line from the leading fingertip to the mouth — this is the
  //    quantity the classifier actually measures, so showing it builds trust.
  if (mouth && lead) {
    const tip = px(lead.tip);
    const color = mix(SAFE, ALERT, lead.score);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(mouth.x, mouth.y);
    ctx.strokeStyle = lead.score > 0.05 ? color : DIM;
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.setLineDash(lead.score > 0.05 ? [] : [r * 0.6, r * 0.6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 2) Fingertip markers: hollow rings, filled and brightened by their score.
  for (const f of state.fingers) {
    const p = px(f.tip);
    const color = mix(SAFE, ALERT, f.score);
    const isLead = f === lead && f.score > 0.05;
    const radius = isLead ? r * 1.25 : r;

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(color, 0.18 + 0.5 * f.score);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.22);
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  // 3) Mouth marker: a crosshair so it reads as the reference point, not a tip.
  if (mouth) {
    const color = mix(SAFE, ALERT, state.score);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, r * 0.22);
    ctx.beginPath();
    ctx.arc(mouth.x, mouth.y, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouth.x - r * 1.4, mouth.y);
    ctx.lineTo(mouth.x + r * 1.4, mouth.y);
    ctx.moveTo(mouth.x, mouth.y - r * 1.4);
    ctx.lineTo(mouth.x, mouth.y + r * 1.4);
    ctx.stroke();
  }

  // 4) Status pill, top-left. Drawn un-mirrored so the text is readable.
  drawStatusPill(ctx, state, width);
}

function drawStatusPill(
  ctx: CanvasRenderingContext2D,
  state: OverlayState,
  width: number
): void {
  const label = state.alerting
    ? "BITING"
    : state.score > 0.05
      ? "WATCHING"
      : "CLEAR";
  const color = state.alerting
    ? ALERT
    : state.score > 0.05
      ? mix(SAFE, ALERT, state.score)
      : SAFE;

  const pad = Math.round(width * 0.012);
  const fontSize = Math.round(width * 0.022);
  const x = pad;
  const y = pad;

  ctx.save();
  // Un-mirror: the canvas is flipped horizontally in CSS, so flip text back.
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  const mx = width - x; // mirrored x of the top-left corner

  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.textBaseline = "top";
  const textW = ctx.measureText(label).width;
  const dotR = fontSize * 0.32;
  const pillW = textW + dotR * 3 + pad * 2;
  const pillH = fontSize + pad;

  // Pill background.
  ctx.fillStyle = "rgba(15, 23, 25, 0.6)";
  roundRect(ctx, mx - pillW, y, pillW, pillH, pillH / 2);
  ctx.fill();

  // Status dot.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(mx - pillW + pad + dotR, y + pillH / 2, dotR, 0, Math.PI * 2);
  ctx.fill();

  // Label.
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(label, mx - pillW + pad + dotR * 2.4, y + pad * 0.4);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const rr = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function withAlpha(rgb: string, alpha: number): string {
  // rgb is "rgb(r, g, b)" from mix(); splice in an alpha channel.
  return rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}
