# FORENSIC FIX V9 — deterministic Vercel API routing

## Root cause found in the deployed repository

The GitHub repository still contained **both**:

- a root `server.ts` recognized by Vercel as an Express entrypoint, and
- `api/[...path].ts` importing that same `server.ts`.

That creates competing function entrypoints. The live repository also had a stale `package-lock.json` that still declared `@google/genai` even though the current `package.json` no longer did.

The production symptom was:

`500 FUNCTION_INVOCATION_FAILED` on `/api/health`.

Because `/api/health` does not call Gemini, this proves the failure is in Vercel function initialization/routing, not Gemini API authentication.

## V9 architecture

The project now has one deterministic Vercel API entrypoint:

`api/[...path].ts` → imports Express `app` from `backend.ts`.

The old root `server.ts` entrypoint is removed, so Vercel cannot create a second competing function from it.

The Vite frontend remains a normal static build in `dist`.

`vercel.json` explicitly configures:

- Build Command: `npm run build:web`
- Output Directory: `dist`
- Function: `api/[...path].ts`
- Max Duration: 60 seconds

## Local development

`dev.ts` imports the same Express app and listens on port 3000.

## Gemini security

Gemini remains server-side only. `GEMINI_API_KEY` is read from `process.env.GEMINI_API_KEY` and is never returned to the browser.

No Gemini 2.0 configuration is present.

## Required verification

After pushing the complete V9 tree to GitHub and redeploying Vercel:

`GET /api/health`

must return HTTP 200 JSON with:

- `ok: true`
- `build: 2026-10-source-validation-v9`
- `runtime: "vercel"`

The endpoint does not call Gemini, so it is the first deployment gate.
