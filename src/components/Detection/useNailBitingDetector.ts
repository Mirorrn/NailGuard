import { useCallback, useEffect, useRef, useState } from "react";
import type Webcam from "react-webcam";
import {
  FaceDetector,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import bitingSound from "../../assets/biting_hit.webm";
import { createCooldownPlayer } from "./audio";
import {
  assessBiting,
  distance,
  type FingerScore,
  type Point,
} from "./classifier";
import {
  assessPosture,
  computeMetrics,
  type PostureBaseline,
} from "./posture";
import { drawOverlay, lerpPoint } from "./overlay";
import {
  createBiteNotifier,
  getPermissionState,
  requestPermission,
  type NotificationPermissionState,
} from "./notifier";
import { SessionRecorder, type SessionSummary } from "./recorder";
import {
  BITING_SCORE_THRESHOLD,
  COOLDOWN_MS,
  FACE_DETECT_EVERY_N,
  FACE_DETECTOR_MODEL_URL,
  HAND_LANDMARKER_MODEL_URL,
  INFERENCE_INTERVAL_MS,
  LEFT_EYE_KEYPOINT_INDEX,
  MOUTH_KEYPOINT_INDEX,
  NOTIFY_INTERVAL_MS,
  POSE_DETECT_EVERY_N,
  POSE_LANDMARKER_MODEL_URL,
  POSTURE_TRIGGER_OFF_RATIO,
  POSTURE_TRIGGER_ON_RATIO,
  RIGHT_EYE_KEYPOINT_INDEX,
  SLIDING_WINDOW_SIZE,
  TRIGGER_OFF_RATIO,
  TRIGGER_ON_RATIO,
  VISION_WASM_URL,
} from "./constants";

export type DetectorError = {
  kind: "model" | "camera";
  message: string;
};

export type PostureStatus = "unknown" | "good" | "slouch" | "tilt";

async function loadModels() {
  const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_LANDMARKER_MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.5,
  });
  const faceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: FACE_DETECTOR_MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
  });
  const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: POSE_LANDMARKER_MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  return { handLandmarker, faceDetector, poseLandmarker };
}

export function useNailBitingDetector() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  const frameResults = useRef<boolean[]>(
    new Array(SLIDING_WINDOW_SIZE).fill(false)
  );
  const writeIndex = useRef(0);
  const isAlerting = useRef(false);
  const player = useRef(createCooldownPlayer(bitingSound, COOLDOWN_MS));

  // Desktop notifications reach the user even when the window is unfocused or
  // sound is muted. Fired on the rising edge of a bite, independent of sound.
  const notifier = useRef(createBiteNotifier(NOTIFY_INTERVAL_MS));
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(() => getPermissionState());
  // Once permission is granted the user can still mute/unmute alerts without
  // touching browser settings. Read from a ref on the inference hot path.
  const notifyMutedRef = useRef(false);
  const [notifyMuted, setNotifyMuted] = useState(false);

  // --- Posture -------------------------------------------------------------
  const postureResults = useRef<boolean[]>(
    new Array(SLIDING_WINDOW_SIZE).fill(false)
  );
  const postureWriteIndex = useRef(0);
  const isBadPosture = useRef(false);
  const wasBadPosture = useRef(false);
  const lastPoseRef = useRef<NormalizedLandmark[] | undefined>(undefined);
  const baselineRef = useRef<PostureBaseline | undefined>(undefined);
  const lastBadReasonRef = useRef<"slouch" | "tilt" | undefined>(undefined);
  const [postureStatus, setPostureStatus] = useState<PostureStatus>("unknown");
  const [isCalibrated, setIsCalibrated] = useState(false);
  // Set when a calibration attempt fails because no reliable pose was visible;
  // cleared on the next successful calibration. Lets the UI explain the no-op.
  const [calibrationError, setCalibrationError] = useState(false);

  // Inference runs on a throttled cadence; these refs cache its latest output
  // so the full-rate render loop can keep drawing the overlay in between.
  const lastInferenceAt = useRef(0);
  const inferenceCount = useRef(0);
  const mouthRef = useRef<Point | undefined>(undefined);
  const eyesRef = useRef<{ left?: Point; right?: Point }>({});

  // `target` holds the latest raw inference; `display` is eased toward it every
  // animation frame so the overlay glides instead of stepping at the inference
  // rate. `scoreRef` is the latest overall biting confidence for the HUD.
  const target = useRef<{ mouth?: Point; fingers: FingerScore[] }>({
    fingers: [],
  });
  const display = useRef<{ mouth?: Point; fingers: FingerScore[] }>({
    fingers: [],
  });
  const scoreRef = useRef(0);

  // --- Session recording ---------------------------------------------------
  // The recorder accumulates the dense signal in a ref (hot path, every tick);
  // a low-frequency snapshot is mirrored into React state for the live UI so we
  // don't re-render on every inference.
  const recorderRef = useRef<SessionRecorder | null>(null);
  const wasAlerting = useRef(false);
  const soundOnRef = useRef(true);
  const [soundOn, setSoundOn] = useState(true);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  // Mirrored from the alerting ref on the snapshot tick so the UI can show a
  // live "biting now" badge without re-rendering on the per-frame hot path.
  const [isBiting, setIsBiting] = useState(false);

  const [isModelReady, setIsModelReady] = useState(false);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [error, setError] = useState<DetectorError | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadModels()
      .then(({ handLandmarker, faceDetector, poseLandmarker }) => {
        if (cancelled) {
          handLandmarker.close();
          faceDetector.close();
          poseLandmarker.close();
          return;
        }
        handLandmarkerRef.current = handLandmarker;
        faceDetectorRef.current = faceDetector;
        poseLandmarkerRef.current = poseLandmarker;
        setIsModelReady(true);
      })
      .catch((cause) => {
        console.error("Failed to load detection models:", cause);
        if (!cancelled) {
          setError({
            kind: "model",
            message:
              "Couldn’t load the detection models. Check your internet connection and try again.",
          });
        }
      });

    return () => {
      cancelled = true;
      handLandmarkerRef.current?.close();
      faceDetectorRef.current?.close();
      poseLandmarkerRef.current?.close();
      handLandmarkerRef.current = null;
      faceDetectorRef.current = null;
      poseLandmarkerRef.current = null;
    };
  }, []);

  // Throttled: runs the models, updates the detection window, and refreshes the
  // cached landmarks the render loop draws. The face detector only runs every
  // FACE_DETECT_EVERY_N inferences since the mouth barely moves.
  const runInference = useCallback(
    (video: HTMLVideoElement, timestamp: number) => {
      const handLandmarker = handLandmarkerRef.current;
      const faceDetector = faceDetectorRef.current;
      const poseLandmarker = poseLandmarkerRef.current;
      if (!handLandmarker || !faceDetector || !poseLandmarker) return;

      const handResult = handLandmarker.detectForVideo(video, timestamp);

      if (inferenceCount.current % FACE_DETECT_EVERY_N === 0) {
        const face = faceDetector.detectForVideo(video, timestamp)
          .detections[0];
        const keypoints = face?.keypoints;
        mouthRef.current = keypoints?.[MOUTH_KEYPOINT_INDEX];
        eyesRef.current = {
          left: keypoints?.[LEFT_EYE_KEYPOINT_INDEX],
          right: keypoints?.[RIGHT_EYE_KEYPOINT_INDEX],
        };
      }
      inferenceCount.current += 1;

      // Handedness gives each hand a stable "Left"/"Right" label so the two
      // hands' fingers keep distinct identities across frames.
      const handLabels = handResult.handedness.map(
        (h) => h[0]?.categoryName ?? ""
      );
      const { score, fingers } = assessBiting(
        handResult.landmarks,
        handLabels,
        mouthRef.current,
        eyesRef.current.left,
        eyesRef.current.right
      );
      target.current = { mouth: mouthRef.current, fingers };
      scoreRef.current = score;

      frameResults.current[writeIndex.current] = score >= BITING_SCORE_THRESHOLD;
      writeIndex.current = (writeIndex.current + 1) % SLIDING_WINDOW_SIZE;

      const positiveRatio =
        frameResults.current.reduce((acc, v) => acc + (v ? 1 : 0), 0) /
        SLIDING_WINDOW_SIZE;

      // Hysteresis: require a high ratio to start alerting, a lower one to stop,
      // so a borderline score doesn't rapidly toggle the alarm on and off.
      if (isAlerting.current) {
        if (positiveRatio < TRIGGER_OFF_RATIO) isAlerting.current = false;
      } else if (positiveRatio >= TRIGGER_ON_RATIO) {
        isAlerting.current = true;
      }

      if (isAlerting.current && soundOnRef.current) {
        player.current.play();
      }

      // On the rising edge of a bite, raise a desktop notification too. This is
      // independent of the sound toggle, so a muted user (or one in another
      // window) still gets alerted. The notifier no-ops without permission and
      // self-throttles, so calling it every rising edge is safe.
      const biteStarted = isAlerting.current && !wasAlerting.current;
      if (biteStarted && !notifyMutedRef.current) {
        notifier.current.fire(timestamp);
      }

      // Reflect the alert edges into React state so the live badge flips with
      // the alarm. Only fires on a transition, so it's not a per-frame setState.
      if (isAlerting.current !== wasAlerting.current) {
        setIsBiting(isAlerting.current);
      }

      // Record the session signal. Every tick becomes a sample; the rising edge
      // of the alert becomes a discrete bite event.
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.addSample(
          timestamp,
          score,
          isAlerting.current,
          fingers.map((f) => ({ name: f.name, score: f.score }))
        );
        if (biteStarted) {
          recorder.addBite(timestamp, score);
        }
      }
      wasAlerting.current = isAlerting.current;

      // --- Posture (slow cadence; posture changes gradually) ---------------
      if (inferenceCount.current % POSE_DETECT_EVERY_N === 0) {
        const pose = poseLandmarker.detectForVideo(video, timestamp)
          .landmarks[0];
        lastPoseRef.current = pose;

        const assessment = assessPosture(pose, baselineRef.current);
        // Only feed the window when we have a reliable reading; otherwise hold
        // the last verdict rather than flipping to "good" when the user steps
        // out of frame.
        if (assessment.valid && baselineRef.current) {
          postureResults.current[postureWriteIndex.current] = assessment.bad;
          postureWriteIndex.current =
            (postureWriteIndex.current + 1) % SLIDING_WINDOW_SIZE;
          if (assessment.bad) lastBadReasonRef.current = assessment.reason;

          const badRatio =
            postureResults.current.reduce((acc, v) => acc + (v ? 1 : 0), 0) /
            SLIDING_WINDOW_SIZE;

          if (isBadPosture.current) {
            if (badRatio < POSTURE_TRIGGER_OFF_RATIO)
              isBadPosture.current = false;
          } else if (badRatio >= POSTURE_TRIGGER_ON_RATIO) {
            isBadPosture.current = true;
          }

          // Rising edge of bad posture → a discrete posture event.
          if (isBadPosture.current && !wasBadPosture.current) {
            recorderRef.current?.addPosture(
              timestamp,
              lastBadReasonRef.current ?? "slouch"
            );
          }
          wasBadPosture.current = isBadPosture.current;

          const next: PostureStatus = isBadPosture.current
            ? lastBadReasonRef.current ?? "slouch"
            : "good";
          setPostureStatus((prev) => (prev === next ? prev : next));
        }
      }
    },
    []
  );

  const processFrame = useCallback(
    (timestamp: number) => {
      const video = webcamRef.current?.video;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (video.readyState !== 4) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Throttle the expensive model runs; the preview below stays at full rAF.
      if (timestamp - lastInferenceAt.current >= INFERENCE_INTERVAL_MS) {
        lastInferenceAt.current = timestamp;
        runInference(video, timestamp);
      }

      // Resizing the canvas clears and reallocates its backing buffer, so only
      // do it when the source dimensions actually change.
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Ease the displayed markers toward the latest inference so they glide at
      // full frame rate instead of stepping at the ~15 Hz inference cadence.
      const SMOOTH = 0.35;
      const next = target.current;
      const prev = display.current;
      const mouth =
        next.mouth && prev.mouth
          ? lerpPoint(prev.mouth, next.mouth, SMOOTH)
          : next.mouth;
      const fingers: FingerScore[] = next.fingers.map((tf) => {
        const pf = prev.fingers.find((p) => p.name === tf.name);
        const tip = pf ? lerpPoint(pf.tip, tf.tip, SMOOTH) : tf.tip;
        const score = pf
          ? pf.score + (tf.score - pf.score) * SMOOTH
          : tf.score;
        return { name: tf.name, tip, score };
      });
      display.current = { mouth, fingers };

      const eyes = eyesRef.current;
      const markerScale =
        eyes.left && eyes.right ? distance(eyes.left, eyes.right) : 0.08;

      drawOverlay(
        ctx,
        {
          mouth,
          fingers,
          score: scoreRef.current,
          alerting: isAlerting.current,
        },
        markerScale
      );
    },
    [runInference]
  );

  useEffect(() => {
    if (!isModelReady || !isWebcamReady) return;

    let rafId = 0;
    let stopped = false;

    // Start a recording session in the same monotonic clock the rAF loop uses,
    // so sample timestamps line up exactly.
    const start = performance.now();
    recorderRef.current = new SessionRecorder(start);
    wasAlerting.current = false;
    setIsBiting(false);

    // Mirror a low-frequency snapshot of the recorder into React state for the
    // live UI, decoupled from the per-frame hot path.
    const snapshotId = window.setInterval(() => {
      const recorder = recorderRef.current;
      if (!recorder) return;
      setSummary(recorder.summary(performance.now()));
    }, 500);

    const loop = (timestamp: number) => {
      if (stopped) return;
      processFrame(timestamp);
      if (!stopped) rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(rafId);
      window.clearInterval(snapshotId);
    };
  }, [isModelReady, isWebcamReady, processFrame]);

  const handleWebcamReady = useCallback(() => setIsWebcamReady(true), []);

  const handleWebcamError = useCallback(
    (cause: string | DOMException) => {
      console.error("Webcam error:", cause);
      const denied =
        typeof cause !== "string" &&
        (cause.name === "NotAllowedError" ||
          cause.name === "PermissionDeniedError");
      setError({
        kind: "camera",
        message: denied
          ? "Camera access was blocked. Allow camera permissions in your browser and reload the page."
          : "We couldn’t start your camera. Make sure no other app is using it and try again.",
      });
    },
    []
  );

  // Snapshot the user's current pose as the "good posture" baseline. Returns
  // false if no reliable pose is available yet (e.g. user out of frame).
  const calibratePosture = useCallback(() => {
    const metrics = computeMetrics(lastPoseRef.current);
    if (!metrics) {
      setCalibrationError(true);
      return false;
    }
    baselineRef.current = metrics;
    postureResults.current.fill(false);
    isBadPosture.current = false;
    lastBadReasonRef.current = undefined;
    setCalibrationError(false);
    setIsCalibrated(true);
    setPostureStatus("good");
    return true;
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      soundOnRef.current = next;
      return next;
    });
  }, []);

  // Must be called from a user gesture (browser requirement). Updates the
  // exposed permission state so the UI can reflect the result.
  const requestNotifications = useCallback(async () => {
    const result = await requestPermission();
    setNotificationPermission(result);
    // Fire a confirmation right from the user gesture so they immediately see
    // (or notice the absence of) a banner — the clearest signal that alerts
    // are actually wired up.
    if (result === "granted") notifier.current.confirm();
    return result;
  }, []);

  // Mute/unmute desktop alerts after permission is granted, without touching
  // browser settings. Keeps the Alerts button a live toggle, not a dead end.
  const toggleNotifications = useCallback(() => {
    setNotifyMuted((muted) => {
      const next = !muted;
      notifyMutedRef.current = next;
      return next;
    });
  }, []);

  // Serialize the current session. Returned as strings so the UI can wrap them
  // in a Blob and trigger a download without the hook touching the DOM.
  const exportCSV = useCallback(() => recorderRef.current?.toCSV() ?? "", []);
  const exportJSON = useCallback(
    () =>
      recorderRef.current
        ? JSON.stringify(recorderRef.current.toJSON(performance.now()), null, 2)
        : "",
    []
  );

  return {
    webcamRef,
    canvasRef,
    isReady: isModelReady && isWebcamReady,
    error,
    handleWebcamReady,
    handleWebcamError,
    postureStatus,
    isCalibrated,
    calibrationError,
    calibratePosture,
    // Live nail-biting state, surfaced so the UI can show a "biting now" badge
    // rather than relying solely on the video overlay.
    isBiting,
    soundOn,
    toggleSound,
    notificationPermission,
    requestNotifications,
    notifyMuted,
    toggleNotifications,
    summary,
    // Posture only contributes events once calibrated.
    postureActive: isCalibrated,
    exportCSV,
    exportJSON,
  };
}
