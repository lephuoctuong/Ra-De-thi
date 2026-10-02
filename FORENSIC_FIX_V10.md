# V10 — Vercel Express single-entry architecture

V10 removes the competing `api/[...path].ts` wrapper. Vercel's current Express deployment model detects a root `server.ts` that exports the Express app as default and deploys it as a single Function.

The Vite frontend now builds directly to the root `public/` directory. Vercel serves static files from `public/`; Express is used only for `/api/*`. This avoids mixing a Vite `dist` output directory with an Express serverless entrypoint.

The `/api/health` endpoint reports build `2026-10-source-validation-v10` and does not call Gemini.
