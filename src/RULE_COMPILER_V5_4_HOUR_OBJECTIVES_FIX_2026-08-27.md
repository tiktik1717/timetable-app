# Rule Compiler / Generic Rules v5.4

## Fix 1 — exact timetable hour vs. endHour
Rules such as "a teacher should have at most two sixth-hour days per week" must count
distinct days containing a placement at `hour=6`.

Correct generic pattern:

```json
{
  "type": "aggregate",
  "source": "placements",
  "filters": [{"field":"hour","op":"eq","value":6}],
  "groupBy": ["teacherId"],
  "metric": {"type":"count_distinct","field":"day"},
  "assert": {"op":"lte","value":2}
}
```

This correctly counts a day even when the teacher also teaches hour 7, and does not
double-count split/group placement records in the same day.

## Fix 2 — teaching-hour counts
When a rule counts teaching hours from `placements`, compiler guidance now defaults to
`count_distinct(hour)`, not raw placement `count`. This hardens Rule 10-style rules
against structural duplicate placements.

## Fix 3 — optimization language
Words such as "minimize", "reduce", "as few as possible" and Hebrew equivalents are
not converted into an invented target of zero. Without an explicit numeric threshold,
they remain a soft/comparison objective unless there is a genuinely deterministic
sub-condition.

## Fix 4 — partial-formalization safety guard
If the compiler returns `formalized` while `formalCoverage.semanticOnly` contains a
meaningful remainder, the collect guard automatically changes the status to
`partially_formalized`. This prevents the UI from claiming full deterministic coverage
when the compiler itself says some semantics are still untested.

## Expected impact
- Rule 24 should compile using distinct days with an actual hour-6 placement.
- Rule 25 should no longer become an absolute `<= 0` prohibition merely because the
  wording asks to minimize sixth hours.
- Rule 10-style hour counting should use distinct timetable hours.
