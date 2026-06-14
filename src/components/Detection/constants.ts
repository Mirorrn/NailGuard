// Hand landmark indices (MediaPipe HandLandmarker, 21-point model).
// Each fingertip is paired with its MCP "knuckle" joint so we can tell whether
// the finger is pointing toward the mouth (tip closer than knuckle) rather than
// the whole hand just resting near the face.
export const FINGERS = [
  { name: "thumb", tip: 4, mcp: 2, weight: 0.6 },
  { name: "index", tip: 8, mcp: 5, weight: 1.0 },
  { name: "middle", tip: 12, mcp: 9, weight: 1.0 },
  { name: "ring", tip: 16, mcp: 13, weight: 0.8 },
  { name: "pinky", tip: 20, mcp: 17, weight: 0.7 },
] as const;
export const FINGER_TIPS_IDS = FINGERS.map((f) => f.tip);

// FaceDetector (BlazeFace) keypoint order: 0=left eye, 1=right eye, 2=nose,
// 3=mouth, 4=left tragion, 5=right tragion.
export const MOUTH_KEYPOINT_INDEX = 3;
export const LEFT_EYE_KEYPOINT_INDEX = 0;
export const RIGHT_EYE_KEYPOINT_INDEX = 1;

// --- Classifier tuning -----------------------------------------------------
// All distances below are expressed as a fraction of the inter-ocular distance
// (eye-to-eye), which is a stable, scale-invariant proxy for face size. This
// makes detection work whether the user sits close to or far from the camera.

// A fingertip at or below this fraction of eye-distance from the mouth counts
// as "at the mouth". Kept tight (≈half an eye-width) so a finger resting on the
// chin/jaw/neck doesn't read as biting — it must be right at the lips.
export const TIP_AT_MOUTH_RATIO = 0.55;
// Above this distance the finger contributes nothing.
export const TIP_FAR_FROM_MOUTH_RATIO = 1.3;
// The fingertip must be at least this much closer to the mouth than its own
// knuckle for the finger to count as "pointing in" (guards against a flat hand
// resting against the cheek/chin, and against incidental geometry while the
// head moves, e.g. stretching the neck).
export const POINTING_MARGIN_RATIO = 0.35;
// Biting brings the fingertip up to the mouth, not below it. Reject fingertips
// more than this fraction of eye-distance *below* the mouth — that's a hand
// resting low while the head/chin dips toward it (the classic neck-stretch
// false positive). Allows a little slack for tip jitter.
export const TIP_BELOW_MOUTH_RATIO = 0.35;

// Per-inference confidence above which the frame is considered "biting".
export const BITING_SCORE_THRESHOLD = 0.5;

// Inference runs on a fixed cadence (decoupled from the render loop), so the
// sliding window is sized in inferences, not animation frames.
export const SLIDING_WINDOW_SIZE = 8;
// Hysteresis: fraction of the window that must be positive to START alerting,
// and the (lower) fraction it must fall below to STOP — prevents flicker.
export const TRIGGER_ON_RATIO = 0.6;
export const TRIGGER_OFF_RATIO = 0.35;
export const COOLDOWN_MS = 3000;
// Minimum gap between desktop notifications, so a sustained biting episode
// raises one popup rather than a stream of them.
export const NOTIFY_INTERVAL_MS = 10000;

// Run the detection models at a fixed rate instead of every animation frame.
// The preview keeps redrawing at full rAF; only inference is throttled.
export const INFERENCE_INTERVAL_MS = 66; // ~15 Hz
// The mouth barely moves between frames, so re-run the face detector only
// every Nth inference and reuse the last mouth keypoint in between.
export const FACE_DETECT_EVERY_N = 5;
// Posture changes slowly, so run the (heavier) pose model far less often than
// the hand model. Every 5th inference ≈ 3 Hz.
export const POSE_DETECT_EVERY_N = 5;

// --- Posture (MediaPipe PoseLandmarker, 33-point BlazePose) ----------------
export const POSE_LANDMARKS = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
} as const;

// Landmarks below this visibility are treated as unreliable (occluded / off
// frame) and the posture reading for that frame is skipped.
export const POSE_MIN_VISIBILITY = 0.6;

// Posture is judged as drift from a user-calibrated baseline, so these are
// tolerances on relative change rather than absolute geometry.
// Head-to-shoulder vertical gap shrinking by this fraction = slumping/craning.
export const SLOUCH_DROP_RATIO = 0.18;
// Shoulder-line tilt beyond this many radians = leaning to one side (~9°).
export const SHOULDER_TILT_RAD = 0.16;
// Fraction of the window that must be "bad posture" to START / STOP warning.
export const POSTURE_TRIGGER_ON_RATIO = 0.7;
export const POSTURE_TRIGGER_OFF_RATIO = 0.4;

export const HAND_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
export const FACE_DETECTOR_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
export const POSE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
export const VISION_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
