# Auto-Repair Loop v1.6 — Exact File Contract + Batched Python

## Why v1.5 did not reduce Python runs
v1.5 still used an inaccurate guide:
- it treated the wrapper object loaded from `school-metadata.json` as if it were schoolData;
- it suggested a `classes_by_name` mapping even though `classes` may contain strings;
- the model therefore spent multiple runs correcting our guide before beginning diagnosis.

Observed v1.5:
- Attempt 0: 2 Python runs
- Attempt 1: 17 Python runs
- Correctness: PASS (775/775, 0 errors, 0 warnings)

## v1.6
The prompt now states the exact files produced by our own backend:
- `broken-candidate.json` -> top-level `schedule`
- `school-metadata.json` -> top-level wrapper containing `schoolData`

It gives exact stable fields for teachingUnits/teachers, removes `classes_by_name`,
and describes `dailyHoursByClass`, freeDays, blockedHours and teacher-conflict checks.

## Batched execution discipline
The model is explicitly instructed that the first Python run should load, diagnose,
enumerate legal candidates and print one compact diagnostic object. If a one-insertion
repair is found, the next run should apply it and write `repaired-candidate.json`.

Target: normally 2 Python runs, but correctness remains more important than the target.

## Attempt 0
The log-line format is now supplied as exact Python using `json.dumps`, and the model is
asked to complete failure injection in one run.

## Benchmark
- historical Attempt 1 baseline: 16 runs
- v1.5: 17 runs
- v1.6: measure after deployment
- acceptance remains 775/775 and a clean Validator
