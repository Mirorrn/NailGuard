import "./styles/global.css";

import { Suspense, lazy, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { AiFillGithub } from "react-icons/ai";
import { CiPlay1 } from "react-icons/ci";
import { FaLinkedinIn } from "react-icons/fa";

import NibbleMark from "./components/NibbleMark";
import styles from "./App.module.css";

const DetectionComponent = lazy(
  () => import("./components/Detection/DetectionComponent")
);

const STEPS = [
  {
    title: "Private by design",
    body: "Everything runs in your browser. No images or data ever leave your device.",
  },
  {
    title: "How it works",
    body: "AI tracks your fingertips and mouth in real time and plays a soft chime when you start biting.",
  },
  {
    title: "Records your session",
    body: "Runs quietly in the background and logs every reading, so you can review and export your own data.",
  },
];

function App() {
  const [started, setStarted] = useState(false);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <NibbleMark size={56} className={styles.logo} />
        <h1 className={styles.title}>Nibble</h1>
        <p className={styles.tagline}>
          A free AI companion that detects nail biting through your webcam and
          helps you break the habit — right in your browser, with nothing ever
          leaving your device.
        </p>
      </header>

      <main className={styles.detector}>
        {started ? (
          <Suspense
            fallback={<div className={styles.placeholder}>Loading camera…</div>}
          >
            <DetectionComponent />
          </Suspense>
        ) : (
          <button
            type="button"
            className={styles.startButton}
            onClick={() => setStarted(true)}
          >
            <CiPlay1 className={styles.startIcon} />
            Start camera
          </button>
        )}
      </main>

      <section className={styles.steps}>
        {STEPS.map((step) => (
          <div key={step.title} className={styles.step}>
            <h2 className={styles.stepTitle}>{step.title}</h2>
            <p className={styles.stepBody}>{step.body}</p>
          </div>
        ))}
      </section>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Nibble · Martin Moder</span>
        <span className={styles.social}>
          <a
            href="https://github.com/Mirorrn/BiteAlert"
            aria-label="GitHub"
            target="_blank"
            rel="noopener noreferrer"
          >
            <AiFillGithub />
          </a>
          <a
            href="https://www.linkedin.com/in/martin-moder-5ab290108/"
            aria-label="LinkedIn"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaLinkedinIn />
          </a>
        </span>
      </footer>

      <Analytics />
    </div>
  );
}

export default App;
