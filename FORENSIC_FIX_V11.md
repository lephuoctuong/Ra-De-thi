# V11 — Deployment and Gemini REST hardening

## Root cause confirmed from Vercel logs
The deployed project was still running an older source tree whose Vercel function imported `backend.ts`. Vercel reported `ERR_MODULE_NOT_FOUND` for `/var/task/backend...` on `/api/health` and `/api/extract-text`. That means the failure occurred while loading the function, before any Gemini request.

## V11 changes
- One Vercel entrypoint only: root `server.ts` with `export default app`.
- Removed the obsolete `dev.ts` that referenced a non-existent `backend.ts`.
- No `api/[...path].ts` wrapper.
- `/api/health` is independent of Gemini.
- Gemini API key remains server-side only and is sent with `x-goog-api-key`.
- REST payload uses `system_instruction`, `generation_config`, `response_mime_type`, `response_schema`, `thinking_config`, `thinking_level`, and `inline_data.mime_type`.
- Build marker: `2026-10-source-validation-v11`.
