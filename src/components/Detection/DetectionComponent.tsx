import Webcam from "react-webcam";

import styles from "./Detection.module.css";
import { useNailBitingDetector } from "./useNailBitingDetector";

function DetectionComponent() {
  const {
    webcamRef,
    canvasRef,
    isReady,
    error,
    handleWebcamReady,
    handleWebcamError,
  } = useNailBitingDetector();

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
              <div className={styles.loader} />
            </div>
          )}
          <div className={styles.videoWrapper}>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              className={styles.webcam}
              onUserMedia={handleWebcamReady}
              onUserMediaError={handleWebcamError}
            />
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>
        </>
      )}
    </div>
  );
}

export default DetectionComponent;
