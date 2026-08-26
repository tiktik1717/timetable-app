# Auto-Repair Loop v1 — 2026-08-23

Purpose: prove a complete feedback loop.

Attempt 0: an LLM-authored Python program removes one ordinary scheduled unit occurrence.
The existing JavaScript Validator checks the generated candidate.

Attempt 1 receives only:
- the broken candidate,
- schoolData metadata,
- the Validator report.

It does NOT receive the pristine schedule and is not told which cell was removed. It must diagnose the report, write/run Python, create repaired-candidate.json, and pass the same Validator.

Acceptance: 775/775, 0 errors, 0 warnings, 0 missing/extra after repair.
