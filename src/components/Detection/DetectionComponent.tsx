import { useCallback } from "react";
import Webcam from "react-webcam";

import styles from "./Detection.module.css";
import { formatDuration } from "./recorder";
import { useNailBitingDetector } from "./useNailBitingDetector";

/** Trigger a client-side download of `content` as `filename`. */
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DetectionComponent() {
  const {
    webcamRef,
    canvasRef,
    isReady,
    error,
    handleWebcamReady,
    handleWebcamError,
    postureStatus,
    isCalibrated,
    calibrationError,
    calibratePosture,
    isBiting,
    soundOn,
    toggleSound,
    notificationPermission,
    requestNotifications,
    notifyMuted,
    toggleNotifications,
    summary,
    postureActive,
    exportCSV,
    exportJSON,
  } = useNailBitingDetector();

  const handleExportCSV = useCallback(() => {
    downloadFile(exportCSV(), "bitealert-session.csv", "text/csv");
  }, [exportCSV]);

  const handleExportJSON = useCallback(() => {
    downloadFile(
      exportJSON(),
      "bitealert-session.json",
      "application/json"
    );
  }, [exportJSON]);

  return (
    <div className={styles.container}>
      {error ? (
        <div className={styles.errorPanel} role="alert">
          <h2>{error.kind === "camera" ? "Camera unavailable" : "Detection unavailable"}</h2>
          <p>{error.message}</p>
        </div>
      ) : (
        <>
          {!isReady && (
            <div className={styles.loaderOverlay}>
              <div className={styles.loader}>
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
              <span className={styles.loaderLabel}>Loading…</span>
            </div>
          )}
          <div className={styles.videoWrapper}>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                width: 1280,
                height: 720,
                facingMode: "user",
              }}
              className={styles.webcam}
              onUserMedia={handleWebcamReady}
              onUserMediaError={handleWebcamError}
            />
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>
          {isReady && (
            <>
              <BitingCard
                isBiting={isBiting}
                summary={summary}
                soundOn={soundOn}
                onToggleSound={toggleSound}
                notificationPermission={notificationPermission}
                onRequestNotifications={requestNotifications}
                notifyMuted={notifyMuted}
                onToggleNotifications={toggleNotifications}
              />
              <PostureCard
                postureStatus={postureStatus}
                isCalibrated={isCalibrated}
                calibrationError={calibrationError}
                onCalibrate={calibratePosture}
                postureCount={postureActive ? summary?.postureCount ?? 0 : null}
              />
              <ExportBar
                hasData={summary !== null && summary.sampleCount > 0}
                onExportCSV={handleExportCSV}
                onExportJSON={handleExportJSON}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

type Summary = ReturnType<typeof useNailBitingDetector>["summary"];
type NotificationPermission = ReturnType<
  typeof useNailBitingDetector
>["notificationPermission"];

type BitingCardProps = {
  isBiting: boolean;
  summary: Summary;
  soundOn: boolean;
  onToggleSound: () => void;
  notificationPermission: NotificationPermission;
  onRequestNotifications: () => Promise<unknown>;
  notifyMuted: boolean;
  onToggleNotifications: () => void;
};

/**
 * The nail-biting feature: its live "watching / biting now" status, the
 * controls that govern its alerts (sound + desktop notifications), and the
 * bite-specific stats. Self-contained so it reads as one feature.
 */
function BitingCard({
  isBiting,
  summary,
  soundOn,
  onToggleSound,
  notificationPermission,
  onRequestNotifications,
  notifyMuted,
  onToggleNotifications,
}: BitingCardProps) {
  // The Alerts button has three live behaviors so it's never a dead control:
  //  • "default"  → request permission
  //  • "granted"  → toggle mute/unmute (no settings round-trip needed)
  //  • "denied"   → explain how to unblock (the browser blocks a re-prompt)
  const alertsLabel =
    notificationPermission === "granted"
      ? notifyMuted
        ? "Alerts muted"
        : "Alerts on"
      : notificationPermission === "denied"
        ? "Alerts blocked — how to fix"
        : "Enable alerts";

  const handleAlertsClick = useCallback(() => {
    if (notificationPermission === "granted") {
      onToggleNotifications();
      return;
    }
    if (notificationPermission === "denied") {
      window.alert(
        "Notifications are blocked for this site.\n\n" +
          "To turn them on, click the lock/settings icon in your browser's " +
          "address bar, set Notifications to “Allow”, then reload the page."
      );
      return;
    }
    void onRequestNotifications();
  }, [notificationPermission, onToggleNotifications, onRequestNotifications]);

  // Alerts are actively delivering only when granted and not muted.
  const alertsActive = notificationPermission === "granted" && !notifyMuted;

  return (
    <section className={styles.card} aria-label="Nail-biting detection">
      <header className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          <span className={styles.recDot} /> Nail-biting
        </span>
        <span
          className={styles.liveStatus}
          data-state={isBiting ? "biting" : "watching"}
        >
          {isBiting ? "Biting detected!" : "Watching…"}
        </span>
      </header>

      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.ghostButton}
          onClick={onToggleSound}
          aria-pressed={soundOn}
        >
          {soundOn ? "Sound on" : "Sound off"}
        </button>
        {notificationPermission !== "unsupported" && (
          <button
            type="button"
            className={styles.ghostButton}
            onClick={handleAlertsClick}
            aria-pressed={alertsActive}
            title="Get a desktop popup when biting is detected, even if this window is in the background or sound is off"
          >
            {alertsLabel}
          </button>
        )}
      </div>

      {alertsActive && (
        <p className={styles.alertsHint}>
          Desktop alerts only appear when this window is in the background —
          macOS hides them while you’re looking at this tab.
        </p>
      )}

      <div className={styles.stats}>
        <Stat label="Time" value={summary ? formatDuration(summary.durationMs) : "0:00"} />
        <Stat label="Bites" value={summary ? String(summary.biteCount) : "0"} />
        <Stat
          label="Bites/min"
          value={summary ? summary.bitesPerMinute.toFixed(1) : "0.0"}
        />
      </div>
    </section>
  );
}

type PostureCardProps = {
  postureStatus: ReturnType<typeof useNailBitingDetector>["postureStatus"];
  isCalibrated: boolean;
  calibrationError: boolean;
  onCalibrate: () => void;
  /** Number of bad-posture events this session, or null when not calibrated. */
  postureCount: number | null;
};

/**
 * The posture feature. Before calibration it's an explainer + a single primary
 * action, since posture detection does nothing until it has learned the user's
 * upright baseline. After calibration it shows the live posture status, a
 * recalibrate option, and the count of bad-posture events.
 */
function PostureCard({
  postureStatus,
  isCalibrated,
  calibrationError,
  onCalibrate,
  postureCount,
}: PostureCardProps) {
  const postureLabel =
    postureStatus === "good"
      ? "Looking good"
      : postureStatus === "slouch"
        ? "Sit up — you're slouching"
        : postureStatus === "tilt"
          ? "Level out — you're leaning"
          : "Waiting for a clear view…";

  return (
    <section className={styles.card} aria-label="Posture detection">
      <header className={styles.cardHeader}>
        <span className={styles.cardTitle}>Posture</span>
        {isCalibrated && (
          <span className={styles.liveStatus} data-status={postureStatus}>
            {postureLabel}
          </span>
        )}
      </header>

      {isCalibrated ? (
        <>
          <div className={styles.cardActions}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={onCalibrate}
            >
              Recalibrate
            </button>
          </div>
          <div className={styles.stats}>
            <Stat label="Slips" value={String(postureCount ?? 0)} />
          </div>
        </>
      ) : (
        <div className={styles.calibratePrompt}>
          <p className={styles.calibrateHint}>
            Posture tracking is off until you calibrate. Sit up straight in
            full view of the camera, then press calibrate so Nibble learns your
            upright posture.
          </p>
          {calibrationError && (
            <p className={styles.calibrateError} role="alert">
              Couldn’t see you clearly — make sure your head and shoulders are
              in frame, then try again.
            </p>
          )}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onCalibrate}
          >
            Calibrate posture
          </button>
        </div>
      )}
    </section>
  );
}

type ExportBarProps = {
  hasData: boolean;
  onExportCSV: () => void;
  onExportJSON: () => void;
};

/** Session-wide data export — belongs to neither feature, so it stands alone. */
function ExportBar({ hasData, onExportCSV, onExportJSON }: ExportBarProps) {
  return (
    <div className={styles.exportBar}>
      <span className={styles.exportLabel}>Export session</span>
      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.ghostButton}
          onClick={onExportCSV}
          disabled={!hasData}
        >
          CSV
        </button>
        <button
          type="button"
          className={styles.ghostButton}
          onClick={onExportJSON}
          disabled={!hasData}
        >
          JSON
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

export default DetectionComponent;
