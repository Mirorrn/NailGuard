import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

import {
  POSE_LANDMARKS,
  POSE_MIN_VISIBILITY,
  SHOULDER_TILT_RAD,
  SLOUCH_DROP_RATIO,
} from "./constants";

/**
 * Scale-invariant posture metrics derived from a single pose. Both are designed
 * to be compared against a calibrated baseline rather than judged absolutely.
 */
export type PostureMetrics = {
  /**
   * Vertical gap between the head (nose) and the shoulder line, normalized by
   * shoulder width. Shrinks when the user cranes forward / slumps down.
   */
  headShoulderGap: number;
  /** Signed angle of the shoulder line from horizontal, in radians. */
  shoulderTilt: number;
};

export type PostureBaseline = PostureMetrics;

export type PostureAssessment = {
  /** True once we have a reliable reading this frame. */
  valid: boolean;
  metrics?: PostureMetrics;
  /** Per-frame verdict (only meaningful once calibrated). */
  bad: boolean;
  /** Human-readable reason, for the HUD. */
  reason?: "slouch" | "tilt";
};

function visible(lm: NormalizedLandmark | undefined): lm is NormalizedLandmark {
  return !!lm && (lm.visibility ?? 0) >= POSE_MIN_VISIBILITY;
}

/**
 * Computes posture metrics from a 33-point pose, or undefined if the relevant
 * landmarks aren't reliably visible.
 */
export function computeMetrics(
  pose: NormalizedLandmark[] | undefined
): PostureMetrics | undefined {
  if (!pose) return undefined;
  const nose = pose[POSE_LANDMARKS.nose];
  const ls = pose[POSE_LANDMARKS.leftShoulder];
  const rs = pose[POSE_LANDMARKS.rightShoulder];
  if (!visible(nose) || !visible(ls) || !visible(rs)) return undefined;

  const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  if (shoulderWidth < 1e-4) return undefined;

  const shoulderMidY = (ls.y + rs.y) / 2;
  // Positive when the head sits above the shoulders (normal). Normalized by
  // shoulder width so it's invariant to camera distance.
  const headShoulderGap = (shoulderMidY - nose.y) / shoulderWidth;

  // atan2 of the shoulder line; 0 = level. Sign indicates which side is lower.
  const shoulderTilt = Math.atan2(ls.y - rs.y, ls.x - rs.x);

  return { headShoulderGap, shoulderTilt };
}

/**
 * Judges a frame's metrics against the calibrated baseline. Before calibration
 * (no baseline) it just reports validity, never "bad".
 */
export function assessPosture(
  pose: NormalizedLandmark[] | undefined,
  baseline: PostureBaseline | undefined
): PostureAssessment {
  const metrics = computeMetrics(pose);
  if (!metrics) return { valid: false, bad: false };
  if (!baseline) return { valid: true, metrics, bad: false };

  // Slouch: head-to-shoulder gap collapsed relative to the calibrated upright
  // gap (craning forward both shrinks the gap and drops the head).
  const drop =
    (baseline.headShoulderGap - metrics.headShoulderGap) /
    baseline.headShoulderGap;
  if (drop >= SLOUCH_DROP_RATIO) {
    return { valid: true, metrics, bad: true, reason: "slouch" };
  }

  // Tilt: shoulder line rotated away from the calibrated baseline angle.
  const tilt = Math.abs(metrics.shoulderTilt - baseline.shoulderTilt);
  if (tilt >= SHOULDER_TILT_RAD) {
    return { valid: true, metrics, bad: true, reason: "tilt" };
  }

  return { valid: true, metrics, bad: false };
}
