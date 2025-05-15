// src/main.jsx
import "./render-tracker.js"; // Load tracking script first
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

console.log("main.jsx: Rendering app");
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
