import { Col, Container, Row } from "react-bootstrap";
import { AiFillGithub } from "react-icons/ai";
import { FaLinkedinIn } from "react-icons/fa";

import styles from "./Footer.module.css";

const SOCIAL_LINKS = [
  {
    href: "https://github.com/Mirorrn/NailGuard",
    label: "GitHub",
    Icon: AiFillGithub,
  },
  {
    href: "https://www.linkedin.com/in/martin-moder-5ab290108/",
    label: "LinkedIn",
    Icon: FaLinkedinIn,
  },
];

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <Container fluid>
        <Row>
          <Col md="4" className={styles.column}>
            <h3>Designed and Developed by Martin Moder</h3>
          </Col>
          <Col md="4" className={styles.column}>
            <h3>Copyright © {year} NailGuard</h3>
          </Col>
          <Col md="4" className={styles.column}>
            <ul className={styles.icons}>
              {SOCIAL_LINKS.map(({ href, label, Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    aria-label={label}
                    className={styles.iconLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
          </Col>
        </Row>
      </Container>
    </footer>
  );
}

export default Footer;
