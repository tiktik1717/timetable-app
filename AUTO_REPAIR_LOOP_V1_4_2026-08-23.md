# Auto-Repair Loop v1.4 — Attempt 0 file collection fix

## Problem observed in v1.3
Attempt 0 completed in background but collect-0 returned:
`Attempt 0 did not return candidate-schedule.json`.

v1.3 had resilient container-file lookup only in Attempt 1.

## v1.4 fix
Attempt 0 now uses the same two-stage file retrieval strategy:
1. Look for a file annotation in the completed Responses output.
2. If no annotation is present, obtain the Code Interpreter container ID,
   list files inside that container, locate `candidate-schedule.json`, and
   retrieve it directly.

## Diagnostics
If the file still cannot be found, collect-0 returns HTTP 200 with:
- all Code Interpreter Python runs and logs;
- parsed structured response;
- container ID;
- file annotations;
- output item types;
- explicit checks.

The React UI now preserves and renders this failed Attempt 0 instead of
throwing away the diagnostic payload.

## Unchanged
- Background/polling architecture from v1.2.
- Known JSON schema prompt improvements from v1.3.
- Attempt 1 container-file fallback from v1.3.
- Existing JavaScript Validator remains the final source of truth.
