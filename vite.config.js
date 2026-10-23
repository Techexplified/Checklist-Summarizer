import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Multi-page entrypoints required by Trello Power-Up iframes
export default defineConfig({
  plugins: [react()],
  base: "./",
  esbuild: {
    drop: ["console", "debugger"],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        powerup: resolve(__dirname, "powerup.html"),
        auth: resolve(__dirname, "auth.html"),
        settings: resolve(__dirname, "settings.html"),
        summarizer: resolve(__dirname, "summarizer.html"),
      },
    },
  },
  server: {
    port: 5174,
    cors: true,
  },
});
