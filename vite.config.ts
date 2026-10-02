import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => ({
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  plugins: [react()],
  publicDir: false,
  build: {
    // Vercel serves the root public/ directory alongside the Express function.
    // Express itself does not serve static files on Vercel.
    outDir: "public",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
}));
