import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    // The API server (dev-server.ts) also uses port 3000.
    // Vite will automatically move to 3001 when 3000 is occupied.
    // Proxy /api/* back to the API so frontend fetch("/api/...") works
    // in local development without CORS or "Failed to fetch".
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  plugins: [react()],

  // Không sử dụng thư mục public/ mặc định của Vite.
  // Vì build sẽ xuất trực tiếp vào root/public.
  publicDir: false,

  build: {
    // Vercel sẽ phục vụ thư mục public/ cùng với Express function.
    // Express không tự phục vụ static files trên Vercel.
    outDir: "public",
    emptyOutDir: true,
  },

  resolve: {
    alias: {
      // Project sử dụng TypeScript ESM nên không dùng __dirname.
      // Cách này tương thích với "type": "module".
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});