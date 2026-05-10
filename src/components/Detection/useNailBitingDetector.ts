import { useCallback, useEffect, useRef, useState } from "react";
import type Webcam from "react-webcam";
import {
  FaceDetector,
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { drawLandmarks } from "@mediapipe/drawing_utils";

import bitingSound from "../../assets/biting_hit.webm";
import { createCooldownPlayer } from "./audio";
import {
  COOLDOWN_MS,
  FACE_DETECTOR_MODEL_URL,
  FINGER_TIPS_IDS,
  HAND_LANDMARKER_MODEL_URL,
  MAJORITY_THRESHOLD,
  MOUTH_KEYPOINT_INDEX,
  NAIL_BITING_DISTANCE_THRESHOLD,
  SLIDING_WINDOW_SIZE,
  VISION_WASM_URL,
} from "./constants";

type Point = { x: number; y: number };

export type DetectorError = {
  kind: "model" | "camera";
  message: string;
};

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

async function loadModels() {
  const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_LANDMARKER_MODEL_URL,
      delegate: "GPU",
    },
    numHands: 2,
    minHandDetectionConfidence: 0.5,
  });
  const faceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: FACE_DETECTOR_MODEL_URL,
      delegate: "GPU",
    },
  });
  return { handLandmarker, faceDetector };
}

export function useNailBitingDetector() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const faceDetectorRef = useRef<FaceDetector | null>(null);

  const frameResults = useRef<boolean[]>(
    new Array(SLIDING_WINDOW_SIZE).fill(false)
  );
  const writeIndex = useRef(0);
  const player = useRef(createCooldownPlayer(bitingSound, COOLDOWN_MS));

  const [isModelReady, setIsModelReady] = useState(false);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [error, setError] = useState<DetectorError | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadModels()
      .then(({ handLandmarker, faceDetector }) => {
        if (cancelled) {
          handLandmarker.close();
          faceDetector.close();
          return;
        }
        handLandmarkerRef.current = handLandmarker;
        faceDetectorRef.current = faceDetector;
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
      handLandmarkerRef.current = null;
      faceDetectorRef.current = null;
    };
  }, []);

  const processFrame = useCallback(async () => {
    const video = webcamRef.current?.video;
    const canvas = canvasRef.current;
    const handLandmarker = handLandmarkerRef.current;
    const faceDetector = faceDetectorRef.current;

    if (!video || !canvas || !handLandmarker || !faceDetector) return;
    if (video.readyState !== 4) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const [handResult, faceResult] = await Promise.all([
      handLandmarker.detect(video),
      faceDetector.detect(video),
    ]);

    let mouthKeypoint: Point | undefined;
    for (const detection of faceResult.detections) {
      mouthKeypoint = detection.keypoints?.[MOUTH_KEYPOINT_INDEX];
      if (mouthKeypoint) {
        drawLandmarks(ctx, [mouthKeypoint], { color: "#00FF00", lineWidth: 1 });
      }
    }

    const fingerTips: NormalizedLandmark[] = [];
    for (const landmarks of handResult.landmarks) {
      for (const id of FINGER_TIPS_IDS) {
        fingerTips.push(landmarks[id]);
      }
    }
    if (fingerTips.length > 0) {
      drawLandmarks(ctx, fingerTips, { color: "#FF0000", lineWidth: 1 });
    }

    let bitingNow = false;
    if (mouthKeypoint && fingerTips.length > 0) {
      for (const tip of fingerTips) {
        if (distance(tip, mouthKeypoint) <= NAIL_BITING_DISTANCE_THRESHOLD) {
          bitingNow = true;
          break;
        }
      }
    }

    frameResults.current[writeIndex.current] = bitingNow;
    writeIndex.current = (writeIndex.current + 1) % SLIDING_WINDOW_SIZE;

    const trueCount = frameResults.current.reduce(
      (acc, value) => acc + (value ? 1 : 0),
      0
    );
    if (trueCount / SLIDING_WINDOW_SIZE >= MAJORITY_THRESHOLD) {
      player.current.play();
    }
  }, []);

  useEffect(() => {
    if (!isModelReady || !isWebcamReady) return;

    let rafId = 0;
    let stopped = false;

    const loop = async () => {
      if (stopped) return;
      await processFrame();
      if (!stopped) rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(rafId);
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

  return {
    webcamRef,
    canvasRef,
    isReady: isModelReady && isWebcamReady,
    error,
    handleWebcamReady,
    handleWebcamError,
  };
}
