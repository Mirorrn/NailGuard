import { useEffect, useRef, useState } from "react";
import Container from "react-bootstrap/Container";
import { CiPause1, CiPlay1 } from "react-icons/ci";
import { useNavigate } from "react-router-dom";

import heroVideo from "../../assets/hero.webm";
import styles from "./Hero.module.css";

const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const TAGS = ["AI", "On Device", "Secure"];

const HeroSection = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTimeUpdate = () => {
      if (!el.duration) return;
      setProgress((el.currentTime / el.duration) * 100);
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    return () => el.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  const togglePlayback = () => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) el.pause();
    else void el.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className={styles.section}>
      <Container className={styles.card}>
        <div className="row w-100">
          <div className={`col-md-6 ${styles.textContainer}`}>
            <h1 className="display-4 font-weight-bold">
              Let’s Fight Together Against the Nail Biting Habit!
            </h1>
            <p className="lead">
              We are not weak, we care about stuff! This AI-based app can help
              us detect and alert if we are biting our nails.
            </p>
            <div className={styles.tags}>
              {TAGS.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
            <button
              className={`btn btn-primary ${styles.cta}`}
              onClick={() => navigate("/detection")}
            >
              <CiPlay1 className={styles.ctaIcon} /> Get Started
            </button>
          </div>
          <div className={`col-md-6 ${styles.videoContainer}`}>
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              className={styles.video}
            >
              <source src={heroVideo} type="video/webm" />
              Your browser does not support the video tag.
            </video>
            <div className={styles.videoControls}>
              <button
                className={styles.transparentButton}
                onClick={togglePlayback}
                aria-label={isPlaying ? "Pause video" : "Play video"}
              >
                <div className={styles.progressRingContainer}>
                  <svg className={styles.progressRing} width="70" height="70">
                    <circle
                      className={styles.progressRingCircle}
                      stroke="white"
                      strokeWidth="4"
                      fill="transparent"
                      r={RING_RADIUS}
                      cx="35"
                      cy="35"
                      style={{
                        strokeDasharray: RING_CIRCUMFERENCE,
                        strokeDashoffset:
                          RING_CIRCUMFERENCE -
                          (progress / 100) * RING_CIRCUMFERENCE,
                      }}
                    />
                  </svg>
                  <div className={styles.playPauseIcon}>
                    {isPlaying ? <CiPause1 size={30} /> : <CiPlay1 size={30} />}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default HeroSection;
