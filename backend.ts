// Compatibility entrypoint kept for legacy local tooling/imports.
// The canonical Express application lives in server.ts so API routes,
// Gemini configuration, validation and Vercel behavior cannot drift between two backends.
export { app } from "./server";
export { default } from "./server";
