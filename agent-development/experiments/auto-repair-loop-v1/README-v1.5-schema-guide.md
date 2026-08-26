# Auto-Repair Loop v1.5 — Schema Guide + Python-run metric

## Baseline from successful v1.4 experiment
- Attempt 0: 774/775, 1 Python run.
- Attempt 1: 775/775, 16 Python runs.
- Final Validator: 0 errors, 0 warnings, 0 missing, 0 extra.
- Both candidate files were recovered through `container-list-http`.

## Hypothesis
Attempt 1 succeeded but spent many Python runs reverse-engineering metadata and
exploring unrelated structures. The model should remain the diagnostician and code
writer, but it should not have to rediscover the application's stable data contract.

## v1.5 change
Attempt 1 now receives a compact permanent Schema / Repair Guide:
- exact schedule shape;
- key schoolData collections;
- indexes to build immediately;
- a deterministic diagnostic workflow for `unscheduledUnitHours`;
- minimal-change priority (one insertion before displacement);
- an efficient expected Python strategy.

The guide does NOT reveal the pristine timetable or the removed slot. The model must
still diagnose the broken candidate from Validator feedback and metadata.

## New benchmark metric
The UI now displays Python runs per attempt alongside Validator results.

Baseline to beat:
- Attempt 0 = 1
- Attempt 1 = 16

Primary acceptance remains correctness:
775/775, 0 errors, 0 warnings, 0 missing, 0 extra.
Efficiency is secondary; we compare Python-run count only after correctness passes.
