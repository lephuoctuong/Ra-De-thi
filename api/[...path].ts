/**
 * Explicit Vercel API entrypoint.
 *
 * This project uses Vite for the browser and Express for /api/*.
 * Keeping one explicit catch-all function avoids competing Vercel
 * entrypoints (root server.ts + api/[...path].ts) and makes routing
 * deterministic.
 */
import { app } from "../backend";

export default app;
