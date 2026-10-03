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
        // Keep the precache to what a first visit actually needs. The export and
        // chart libraries are ~690 kB together and are only reached from a
        // user-initiated export; precaching them made every first load download
        // tooling most users never open. They are still cached at runtime once
        // used, so repeat exports work offline.
        globIgnores: [
          "**/excel-*.js",
          "**/charts-*.js",
          "**/jspdf*.js",
          "**/html2canvas*.js",
          "**/exportTaskReport-*.js",
        ],
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
    // Cho phép dev server + vitest đọc module dùng chung ngoài project root
    // (backend/pb_hooks/_kpi-formula.cjs — nguồn duy nhất của công thức KPI).
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
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
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // The KPI formula is loaded through a sandbox at runtime; instrumenting it
      // produces noise rather than signal.
      exclude: ["src/test/**", "**/*.d.ts", "src/main.tsx"],
      // Floors sit just under the measured coverage (37% statements) so CI fails
      // on a regression instead of on a ratchet. Raise them as tests are added.
      thresholds: {
        statements: 35,
        branches: 25,
        functions: 28,
        lines: 38,
      },
    },
  },
});
