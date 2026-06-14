import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker so notifications can be shown while the page is
// backgrounded (see public/sw.js). Best-effort: the app degrades to the
// foreground-only constructor path if registration fails or is unsupported.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((cause) => {
      console.warn("[BiteAlert] Service worker registration failed:", cause);
    });
  });
}
