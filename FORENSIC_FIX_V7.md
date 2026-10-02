# V7 — Fix 404 on Gemini Step 1 / Vercel API

## Root cause
The previous V6 deployment used `api/[...path].ts` as a catch-all serverless wrapper while the project also contains a root `server.ts`. The Vercel deployment could serve the Vite frontend but the `/api/*` requests were not reaching the Express application, producing HTTP 404.

## Fix
- Vercel now uses the root `server.ts` as the Express entrypoint, following Vercel's current zero-configuration Express deployment model.
- `server.ts` now has `export default app`.
- Removed the old `api/[...path].ts` wrapper to avoid competing entrypoints.
- Kept `npm run build:web` + `dist` so the existing React/Vite UI is built without redesigning it.
- Added `GET /api/health` returning the V7 build marker without calling Gemini.
- Raised Node engine to `>=22` because Vercel deprecated Node 20 for new deployments from Oct 1, 2026.

## Verification
The expected diagnostic after deployment is:
`GET /api/health` → HTTP 200 JSON containing `build: 2026-10-source-validation-v7`.

Step 1 should then call `/api/generate/step1` through the same Express application.
