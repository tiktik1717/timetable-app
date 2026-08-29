# v5.7 — inference refinements

This release keeps the v5.6 DSL and evaluator behavior unchanged and improves how the
Rule Compiler decides what can already be represented.

## 1. Explicit entity lists define scope

When the user's rule explicitly enumerates the affected classes/teachers/groups, that
enumeration is the source of truth. The compiler must not invent an omitted entity just
because the introductory wording mentions a grade or category.

Example:
"On Monday hour 5, in grade ו, the homeroom teachers are: ו1..., ו2..., ו4..., ו5..."

If those four classes are explicitly listed, covering those four is complete coverage.
The compiler must not create a semantic remainder merely because ו3 is absent from the
dataset or list.

Expected effect: Rule 15 returns to `formalized`.

## 2. Conditional gap preference is measurable

"If a teacher has gaps, prefer them on days where the teacher teaches only through hour 6"
can be measured on `teacher_days`:

- filters: `count > 0`, `gapCount > 0`
- groupBy: `teacherId`, `day`
- metric: `field_value(endHour)`
- assert: `endHour <= 6`
- severity: `recommended`

Each gap-day ending after hour 6 is a soft violation/penalty.

Expected effect: Rule 26 becomes a formalized soft preference.

## 3. Homeroom starts + special weighting is partially formalizable

"Prefer the homeroom teacher to start the day in their class; give special priority to
teacher 33."

The general portion can be represented as recommended `required_slots` at hour 1 using
`ENTITIES.homerooms`. The extra weighting for teacher 33 remains semantic because the
current DSL has no per-requirement weight.

Expected effect: Rule 22 becomes `partially_formalized`, with:
- deterministic coverage: homeroom teacher in class at hour 1;
- semantic remainder: teacher 33 has higher priority.

No new evaluator primitive is introduced in v5.7.
