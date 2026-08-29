# v6.3 — Generic objectives, explicit universes, stronger compiler contract

## 1. Generic objective DSL

New expression:

```json
{
  "type": "objective",
  "direction": "minimize",
  "source": "placements",
  "filters": [],
  "exclude": [],
  "groupBy": ["teacherId"],
  "metric": {"type":"count_distinct","field":"day"},
  "reduce": "sum"
}
```

Supported directions:
- minimize
- maximize

Supported reductions:
- sum
- avg
- min
- max
- count_groups

An objective is measured rather than treated as a binary constraint. Evaluator results
are surfaced as `objective_measured` with `objectiveValue` and per-group measurements.

Examples:
- maximize number of teaching days on which teacher 11 starts at hour 2;
- minimize total distinct sixth-hour teaching days for teachers 5 and 41.

Baseline-relative objectives such as "minimum changes from the current timetable" remain
semantic comparison objectives until the DSL gains an explicit baseline source.

## 2. Explicit teaching/activity universe policy

`teacher_days` and `class_days` remain only for backward compatibility.

For new rules:
- teaching / lessons / teaching gaps -> `teacher_teaching_days`,
  `class_teaching_days`, or `isInstructionalPlacement=true`.
- presence / working day / all activities -> `teacher_activity_days`,
  `class_activity_days`.

This prevents meetings and non-instructional activities from silently changing rules
about teaching load, sixth hours, or gaps.

## 3. Compiler output stability

The compiler prompt now requires building a valid inner formal-rule object first and
serializing it once at the end.

The collect parser also performs a broader set of conservative repairs before giving up:
- markdown fence removal;
- outer-object extraction;
- trailing comma removal;
- smart-quote normalization;
- Python-style True/False/None normalization;
- conservative single-quoted token repair;
- quoting simple unquoted object keys.

Every repaired candidate must still pass `JSON.parse`; no unvalidated artifact is accepted.
The existing Last Known Good safety net remains in place.

## Regression tests

PASS:
- maximize objective for teaching days starting at hour 2;
- minimize objective for sixth-hour teacher-days;
- objective results surface as `objective_measured`.
