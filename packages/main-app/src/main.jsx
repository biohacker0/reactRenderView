import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./render-tracker.js";

console.log("main.jsx: Rendering app");
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Open God's View window
let godsViewWindow = null;
setTimeout(() => {
  godsViewWindow = window.open("http://localhost:3001", "GodsView", "width=800,height=600");
  if (godsViewWindow) {
    console.log("main.jsx: Opened God's View window");
    // Send render data periodically
    const intervalId = setInterval(() => {
      if (godsViewWindow.closed) {
        clearInterval(intervalId);
        console.log("main.jsx: God's View window closed");
        return;
      }
      const data = window.getRenderData?.() || { renderData: [], componentTree: {} };
      godsViewWindow.postMessage({ type: "RENDER_DATA", payload: data }, "http://localhost:3001");
    }, 1000); // Update every second
  } else {
    console.error("main.jsx: Failed to open God's View window (check popup blocker)");
  }
}, 2000); // Delay to ensure God's View server is ready
