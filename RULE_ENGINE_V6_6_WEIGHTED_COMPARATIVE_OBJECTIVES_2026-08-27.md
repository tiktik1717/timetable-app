# v6.6 — Weighted & Comparative Objectives

## Weighted objective
`weighted_objective` composes child expressions and minimizes a weighted cost.
For ordinary rule expressions, cost is the violation count. For child objectives, cost
is their `objectiveValue`.

When natural language says only "special/higher priority" without a numeric ratio, the
compiler uses a relative convention:
- normal component: weight 1
- special component: weight 2

This represents ordering, not a claim that the user specified an exact numeric ratio.

## Comparative objective
`comparative_objective` receives both candidate and baseline schedules.

Modes:
- `changed_cells`: number of class/day/hour cells whose normalized unit-id sets differ.
- `nonincrease_per_group`: measures a grouped metric in candidate and baseline and sums
  only positive deltas.
- `measure_delta`: sums absolute grouped metric changes.

Examples:
- minimum changes from current timetable -> changed_cells / minimize.
- do not add sixth-hour teaching days to any teacher -> instructional hour=6,
  group by teacherId, count distinct day, nonincrease_per_group.

## Evaluation plumbing
`baselineSchedule` is now propagated through:
- SchedulingAgentView deterministic checks
- ruleEvaluator
- Generic Rule Engine
- Candidate Validator Bridge

Thus candidate validation can score comparative objectives against the true base schedule.

## Regression tests
PASS:
- weighted relative preference scoring
- changed-cell baseline objective
- per-teacher nonincrease objective
- comparative objective rejects missing baseline
