import { ReactNode } from "react";
import { Col, Container, Row } from "react-bootstrap";

import howImage from "../../assets/how_is_it.svg";
import HeroSection from "./Hero";
import styles from "./Home.module.css";

type Section = {
  title: string;
  body: ReactNode;
  illustration?: { src: string; alt: string };
  extra?: ReactNode;
};

const SECTIONS: Section[] = [
  {
    title: "What is NailGuard?",
    body: (
      <p>
        Welcome! This <b>NailGuard</b> App can support you in overcoming the
        habit of nail-biting. The detection system uses deep learning technology
        to identify based on camera images when you are biting your nails and
        provides gentle reminders to help you break the habit.{" "}
        <b>Everything is calculated on your device; no data is sent to a server!</b>{" "}
        Whether you're looking to improve your nail health, identify stress, or
        simply stop this behavior, <b>NailGuard</b> is here to assist you. Start
        your journey towards healthier nails today!
      </p>
    ),
  },
  {
    title: "How is it working?",
    body: (
      <p>
        <b>NailGuard</b> employs a detector that continuously analyzes the input
        from your camera, searching for the positions of your mouth and
        fingertips. By tracking these key points, it can determine if your
        fingers are near or in contact with your mouth, indicating nail-biting
        behavior. When such behavior is detected, you will receive a gentle
        reminder to help you break the habit. This process ensures that all
        calculations are done locally on your device, maintaining your privacy
        and security.
      </p>
    ),
    illustration: { src: howImage, alt: "How NailGuard works" },
    extra: (
      <p>
        The key to this system's accuracy is a human keypoint extractor based on
        deep learning. This technology uses advanced neural networks to generate
        maps that highlight the most likely positions of fingers, palms, and
        facial features like lips. Trained on numerous labeled images, the
        system learns to recognize these key points with high precision. When an
        image is input, the model processes it and pinpoints the exact locations
        of hand and mouth features. This deep learning approach is particularly
        effective for applications such as gesture recognition, sign language
        translation, and enhancing facial expressions in augmented reality.
      </p>
    ),
  },
  {
    title: "About the author",
    body: (
      <>
        <p>
          As a software developer with a specialized interest in data-driven
          decision making, I have gained extensive experience in both research
          and practice. My focus is on the use of artificial intelligence for
          analyzing human behavior and creating predictive models.
        </p>
        <p>
          While working on the computer, I often bite my fingernails or the skin
          around them. I often don't notice when exactly it happens, but it
          does. I have used various methods like gloves or smoothing the
          skin/nails, unfortunately without success so far. This inspired me to
          develop the NailGuard app.
        </p>
        <p>I hope the app helps you as much as it has helped me.</p>
      </>
    ),
  },
];

function HomeSection({ title, body, illustration, extra }: Section) {
  return (
    <div className={styles.section}>
      <Row>
        <Col md={4} className={styles.headingCol}>
          <div className={styles.text}>
            <h1 className={styles.heading}>{title}</h1>
          </div>
        </Col>
        <Col md={8}>
          <div className={styles.text}>{body}</div>
        </Col>
      </Row>
      {illustration && (
        <Row>
          <Col className={styles.illustration}>
            <img
              src={illustration.src}
              alt={illustration.alt}
              className={styles.illustrationImage}
            />
          </Col>
        </Row>
      )}
      {extra && (
        <Row>
          <Col md={12}>
            <div className={styles.text}>{extra}</div>
          </Col>
        </Row>
      )}
    </div>
  );
}

function Home() {
  return (
    <>
      <HeroSection />
      <Container className={styles.content}>
        {SECTIONS.map((section) => (
          <HomeSection key={section.title} {...section} />
        ))}
      </Container>
    </>
  );
}

export default Home;
