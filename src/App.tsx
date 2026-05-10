import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/global.css";

import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Footer from "./components/Footer/Footer";
import Home from "./components/Home/Home";
import NavBar from "./components/NavBar/NavBar";

const DetectionComponent = lazy(
  () => import("./components/Detection/DetectionComponent")
);

function App() {
  return (
    <div className="page-container">
      <BrowserRouter>
        <NavBar />
        <main className="content-wrap">
          <Suspense fallback={<div className="route-fallback">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/detection" element={<DetectionComponent />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </BrowserRouter>
    </div>
  );
}

export default App;
