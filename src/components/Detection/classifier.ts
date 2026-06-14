import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

import {
  FINGERS,
  POINTING_MARGIN_RATIO,
  TIP_AT_MOUTH_RATIO,
  TIP_BELOW_MOUTH_RATIO,
  TIP_FAR_FROM_MOUTH_RATIO,
} from "./constants";

export type Point = { x: number; y: number };

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Maps a value in [near, far] to a confidence in [1, 0] (clamped). Closer than
 * `near` → 1, farther than `far` → 0, linear in between.
 */
function rampDown(value: number, near: number, far: number): number {
  if (value <= near) return 1;
  if (value >= far) return 0;
  return (far - value) / (far - near);
}

export type FingerScore = {
  name: string;
  /** Fingertip position; only x/y are needed for scoring and drawing. */
  tip: Point;
  /** This finger's contribution to the biting score, in [0, 1]. */
  score: number;
};

export type BiteAssessment = {
  /** Overall confidence that the user is biting a nail this frame, in [0, 1]. */
  score: number;
  /** Per-finger breakdown, useful for overlay drawing / debugging. */
  fingers: FingerScore[];
};

/**
 * Scale-normalized, geometry-based nail-biting classifier for a single frame.
 *
 * Instead of a single fixed distance threshold against the mouth point, it:
 *  - normalizes every distance by the inter-ocular (eye-to-eye) distance, so it
 *    behaves the same whether the user is close to or far from the camera;
 *  - requires each finger to point *toward* the mouth (tip meaningfully closer
 *    than its knuckle), rejecting a flat hand resting on the cheek or chin;
 *  - weights fingers (index/middle highest, thumb lowest) since people rarely
 *    bite with the thumb;
 *  - returns a continuous confidence rather than a hard boolean.
 *
 * `hands` is the list of detected hands, each a 21-point landmark array.
 * `handLabels` is the parallel handedness label per hand ("Left"/"Right"),
 * used to give every finger a stable identity so the overlay can smooth and
 * track them correctly when both hands are visible.
 */
export function assessBiting(
  hands: NormalizedLandmark[][],
  handLabels: string[],
  mouth: Point | undefined,
  leftEye: Point | undefined,
  rightEye: Point | undefined
): BiteAssessment {
  const fingers: FingerScore[] = [];
  if (!mouth || !leftEye || !rightEye || hands.length === 0) {
    return { score: 0, fingers };
  }

  // Face scale. Guard against a degenerate (near-zero) eye distance.
  const faceScale = distance(leftEye, rightEye);
  if (faceScale < 1e-4) return { score: 0, fingers };

  const nearDist = TIP_AT_MOUTH_RATIO * faceScale;
  const farDist = TIP_FAR_FROM_MOUTH_RATIO * faceScale;
  const pointingMargin = POINTING_MARGIN_RATIO * faceScale;
  // y grows downward in image space, so a tip "below" the mouth has a larger y.
  const maxBelowMouthY = mouth.y + TIP_BELOW_MOUTH_RATIO * faceScale;

  let best = 0;
  for (let h = 0; h < hands.length; h++) {
    const hand = hands[h];
    // Stable per-hand prefix so the two hands' fingers never collide. Fall back
    // to the array index if handedness is missing.
    const handKey = handLabels[h] ?? `hand${h}`;
    for (const finger of FINGERS) {
      const tip = hand[finger.tip];
      const mcp = hand[finger.mcp];
      if (!tip || !mcp) continue;

      const name = `${handKey}:${finger.name}`;

      // Reject fingertips sitting below the mouth: biting reaches *up* to the
      // lips, whereas a hand resting low (while the chin dips toward it during
      // a neck stretch) sits below. This is the main neck-stretch guard.
      if (tip.y > maxBelowMouthY) {
        fingers.push({ name, tip, score: 0 });
        continue;
      }

      const tipToMouth = distance(tip, mouth);
      const mcpToMouth = distance(mcp, mouth);

      // Proximity: how close the fingertip is to the mouth (scale-normalized).
      const proximity = rampDown(tipToMouth, nearDist, farDist);
      if (proximity <= 0) {
        fingers.push({ name, tip, score: 0 });
        continue;
      }

      // Pointing-in: the tip must be closer to the mouth than the knuckle by at
      // least the margin. Ramps 0→1 across one margin's worth of extra reach.
      const reach = mcpToMouth - tipToMouth; // >0 means tip is the leading edge
      const pointing = rampDown(
        pointingMargin - reach,
        0,
        pointingMargin
      );

      const score = proximity * pointing * finger.weight;
      fingers.push({ name, tip, score });
      if (score > best) best = score;
    }
  }

  // Use the single most-confident finger rather than summing: biting is one or
  // two fingers at the mouth, not "many fingers somewhat near".
  return { score: Math.min(1, best), fingers };
}
