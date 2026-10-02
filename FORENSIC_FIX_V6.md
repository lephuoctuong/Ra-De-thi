# Forensic fix V6 — source state isolation

## Diagnosis
The screenshots showing a green "Đã có văn bản quy định" badge while the textarea contains an extraction/upload fallback cannot be produced by the V5 `SourceSetup.tsx` in this archive: V5 renders the textarea from `safeRegulationSource` and computes the badge from the same sanitized value. The shown fallback is rejected by `utils/sourceValidation.ts`.

This means the running page is using a different/older compiled source, stale browser state, or a different Vercel root/deployment. V6 therefore isolates source storage under new keys and removes the legacy keys at boot.

## V6 guarantees
- Legacy `qbank_lesson` and `qbank_regulation_source` are read only for one-time migration.
- Only values that pass `sanitizeSourceText()` are migrated.
- Legacy keys are deleted immediately after migration.
- New keys are `qbank_source_v6_lesson` and `qbank_source_v6_regulation`.
- Mục 2 badge is green only if the sanitized displayed value is non-empty and valid.
- The textarea and badge consume the same sanitized value.
- Invalid regulation source clears dependent Step 1/2/3/5 results.
- Build marker: `2026-10-source-validation-v6`.

## Deployment proof
After deployment, browser View Source must contain:
`2026-10-source-validation-v6`

If it does not, that URL is not running V6.
