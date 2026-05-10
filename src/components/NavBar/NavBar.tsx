import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { AiOutlineHome } from "react-icons/ai";
import { CiPlay1 } from "react-icons/ci";
import { Link } from "react-router-dom";

import logo from "../../assets/logo.png";
import styles from "./NavBar.module.css";

function NavBar() {
  return (
    <Navbar fixed="top" expand="md" className={styles.navbar}>
      <Container>
        <Navbar.Brand as={Link} to="/">
          <img src={logo} alt="NailGuard" className={styles.logo} />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link as={Link} to="/">
              <AiOutlineHome className={styles.navIcon} /> Home
            </Nav.Link>
            <Nav.Link as={Link} to="/detection" className="btn btn-second">
              <CiPlay1 className={styles.navIcon} /> Get Started
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavBar;
