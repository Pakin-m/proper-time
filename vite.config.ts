import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  test: { include: ["src/**/*.test.ts"] },
  // Three.js renderer budget; application and React remain separate chunks.
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          renderer: ["@react-three/fiber"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
