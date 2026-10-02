# V6 deployment verification

Build marker: `2026-10-source-validation-v6`

After deployment, View Source must contain that exact marker. If it does not, the deployed site is not this source tree.

V6 uses fresh localStorage keys:
- `qbank_source_v6_lesson`
- `qbank_source_v6_regulation`

Legacy `qbank_lesson` and `qbank_regulation_source` are migrated only when their contents pass validation, then removed. Invalid legacy values are discarded.

The Mục 2 badge is fail-closed: it is green only when the sanitized displayed value is non-empty and passes `isValidSourceText`. The textarea renders the exact same sanitized value used for the badge.
