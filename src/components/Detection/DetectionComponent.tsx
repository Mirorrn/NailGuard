import Webcam from "react-webcam";

import styles from "./Detection.module.css";
import { useNailBitingDetector } from "./useNailBitingDetector";

const DetectionComponent: React.FC = () => {
  const { webcamRef, canvasRef, isReady, handleWebcamReady } =
    useNailBitingDetector();

  return (
    <div className={styles.container}>
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
        />
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    </div>
  );
};

export default DetectionComponent;
