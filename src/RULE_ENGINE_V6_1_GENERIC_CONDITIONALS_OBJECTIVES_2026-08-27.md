# v6.1 — Generic conditionals, objectives, and explicit activity universes

This iteration extends the generic DSL rather than adding one-off rules.

## Explicit day universes
- teacher_activity_days / class_activity_days: all scheduled activities.
- teacher_teaching_days / class_teaching_days: instructional placements only.
- legacy teacher_days remains activity-based for backward compatibility.

All expose the same summary vocabulary: count, startHour, endHour, gapCount,
maxConsecutiveHours, maxConsecutiveGapHours.

## Conditional expression
Generic `conditional` supports WHEN/IF a summary condition is true, THEN evaluate
another expression with selected fields bound into it. This covers families such as
"if a teacher teaches more than N hours in a class/day, then ...".

## Coverage expression
Generic `coverage` measures a count or ratio of matching rows within a selected
population. It supports "all day", "most", "as many as possible", and similar measurable
coverage goals without adding a special evaluator for each wording.

## Partial formalization policy
The compiler is instructed to formalize every safe measurable portion of a compound
rule and leave only the unsupported/ambiguous remainder as semantic guidance.

## Logical-direction regression
A dedicated test protects the filter/assertion distinction:
target populations (e.g. English groups) belong in filters; the desired/forbidden
property (e.g. hour not in [1,6]) belongs in assertions.

## Regression tests
PASS:
- rule-20 logical direction
- activity-day vs teaching-day summaries
- conditional IF/THEN
- coverage ratio
