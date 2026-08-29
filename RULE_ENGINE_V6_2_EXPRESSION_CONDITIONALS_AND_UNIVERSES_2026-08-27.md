# v6.2 — Expression conditionals + explicit teaching/activity universes

## 1. Conditional WHEN is now a real expression

`conditional.when` must contain a typed DSL expression.

For quantitative conditions, use an aggregate:

```json
{
  "type": "conditional",
  "when": {
    "type": "aggregate",
    "source": "placements",
    "filters": [
      {"field":"isInstructionalPlacement","op":"eq","value":true},
      {"field":"isHomeroomForClass","op":"eq","value":false}
    ],
    "groupBy": ["teacherId","className","day"],
    "metric": {"type":"count_distinct","field":"hour"},
    "assert": {"op":"gt","value":2}
  },
  "bind": ["teacherId","className","day"],
  "then": {
    "type": "aggregate",
    "source": "placements",
    "filters": [
      {"field":"isInstructionalPlacement","op":"eq","value":true},
      {"field":"isHomeroomForClass","op":"eq","value":false}
    ],
    "groupBy": ["teacherId","className","day"],
    "metric": {"type":"max_consecutive_hours","field":"hour"},
    "assert": {"op":"lte","value":2}
  }
}
```

The aggregate groups that satisfy WHEN become triggers. Their bound group keys are injected
into THEN, so THEN evaluates the same teacher/class/day group.

The old v6.1 shape `when:{source,filters,assertions}` without `type` is rejected. It can
no longer silently return zero triggers and make a rule appear satisfied.

## 2. Generic universe discipline

Rules about teaching should use:
- `isInstructionalPlacement=true`
- `teacher_teaching_days`
- `class_teaching_days`

Rules about all scheduled work/activities should use:
- `teacher_activity_days`
- `class_activity_days`

The compiler is instructed not to enumerate meeting IDs when the semantic universe can be
represented directly.

Examples:
- "7 consecutive teaching hours; meetings do not count" ->
  instructional placements only.
- "sixth teaching hour" -> instructional placement + `hour=6`.
- "gaps between lessons" -> `teacher_teaching_days`.
- "dead time between any school activities" -> `teacher_activity_days`.

## 3. Conditional safety

The evaluator rejects an untyped conditional WHEN. This converts a compiler construction
error into `unsupported` instead of a false `satisfied`.

## Regression tests

PASS:
- aggregate expression used as WHEN
- aggregate group bindings passed into THEN
- legacy raw WHEN rejected
- meeting exclusion through instructional universe
- non-instructional hour-6 activity not counted as a sixth teaching hour
