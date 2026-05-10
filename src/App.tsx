import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/global.css";

import { BrowserRouter, Route, Routes } from "react-router-dom";

import DetectionComponent from "./components/Detection/DetectionComponent";
import Footer from "./components/Footer/Footer";
import Home from "./components/Home/Home";
import NavBar from "./components/NavBar/NavBar";

const App: React.FC = () => {
  return (
    <div className="page-container">
      <BrowserRouter>
        <NavBar />
        <main className="content-wrap">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/detection" element={<DetectionComponent />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </div>
  );
};

export default App;
