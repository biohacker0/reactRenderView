import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "packages/gods-view", // Point to this folder
  plugins: [react()],
  server: {
    port: 3001,
    open: false, // We'll open this manually
  },
});
