import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "packages/main-app", // Point to this folder
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
});
