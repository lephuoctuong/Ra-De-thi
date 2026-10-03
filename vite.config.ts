import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
    host: "0.0.0.0",
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