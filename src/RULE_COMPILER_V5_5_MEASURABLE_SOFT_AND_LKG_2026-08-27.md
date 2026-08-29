# v5.5 — measurable soft preferences + last-known-good fallback

## Why
v5.4 correctly stopped translating pure minimization into invented hard thresholds,
but it became too conservative and converted several measurable recommended rules into
semantic-only guidance. It also exposed a stochastic JSON-format regression on Rule 8.

## Changes

### 1. `teacher_days.count` remains the canonical daily-hour count
`teacher_days.count` already contains distinct timetable hour slots. The compiler is
explicitly instructed to use it directly for rules such as:
- six hours on Monday,
- one 6-hour day + two 5-hour days,
- start at hour 1,
- no internal gaps.

`count_distinct(hour)` is for raw `placements`, not `teacher_days`.

### 2. Recommended can still be formalized
A soft preference may have a deterministic measurable target. Formalization is useful
because its violations can be counted as a penalty without making the timetable invalid.

Examples:
- avoid English in hours 1 or 6,
- avoid teacher 18 on Thursday,
- prefer at most two distinct sixth-hour days per teacher (except teacher 25).

These may use Formal Rule JSON with `severity: recommended`.

### 3. Pure minimization without an explicit threshold stays semantic
"Minimize sixth hours for teachers 5 and 41" must NOT become `<=0`. It remains a
semantic/comparison objective unless a numeric threshold is supplied.

### 4. Last-known-good Formal Rule
If the compiler understands a rule but a single run produces malformed inner JSON, and
the same rule already has a previously valid Formal Rule, the UI preserves that
last-known-good representation rather than erasing deterministic support.

The fallback is only triggered by the explicit compiler JSON-format guard and is recorded
as `compilerFallbackUsed: true` in the exported diagnostic JSON.

## Expected regression targets
- Rule 8: formalized/evaluator-supported again (or safely preserved from last-known-good).
- Rule 20: measurable recommended preference can be formalized.
- Rule 23: measurable recommended preference can be formalized.
- Rule 24: uses placements `hour=6` + `count_distinct(day)` and can be formalized as recommended.
- Rule 25: remains semantic-only because it asks for pure minimization with no threshold.
- Rule 10: remains `count_distinct(hour)`.
