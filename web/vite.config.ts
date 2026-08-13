import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        globIgnores: ["**/excel-*.js", "**/charts-*.js", "**/assets/TasksPage-*.js"],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          state: ["zustand"],
          pb: ["pocketbase"],
          icons: ["lucide-react"],
          charts: ["recharts"],
          excel: ["xlsx"],
          dates: ["date-fns"],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: process.env.VITE_PB_UPSTREAM || "http://localhost:8090",
        changeOrigin: true,
        // forward X-Forwarded-For so PocketBase (with PB_TRUST_PROXY=true) can resolve
        // the real client IP — used by the attendance check-in IP verification
        xfwd: true,
      },
    },
    watch: {
      usePolling: process.env.VITE_USE_POLLING === "true",
      interval: process.env.VITE_USE_POLLING === "true" ? 500 : undefined,
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
