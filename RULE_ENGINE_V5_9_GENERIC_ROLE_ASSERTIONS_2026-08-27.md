# v5.9 — Generic role metadata + filter/assertion discipline

## Design principle
Prefer reusable semantic primitives over one-off fixes for a single natural-language rule.

## Generic teacher-role metadata
Every placement now exposes:
- `isHomeroomTeacher`
- `homeroomClassName`
- `isHomeroomForClass`

These are independent of any specific rule and can support future rules about homeroom teachers.

## Generic filter/assertion discipline
For `every_placement`:
- `filters` select the population of placements to inspect.
- `assertions` / `predicate` define what must be true of those selected placements.

This prevents tautological rules such as filtering `isHomeroomForClass=true` and then
claiming the homeroom condition was validated.

A vacuous `every_placement` with no assertions and no predicate is now rejected by the
engine as unsupported instead of silently passing.

## Generic negative constraints
Absence rules that can be expressed as forbidden values use inverse assertions:
- teacher X cannot teach hour 1 -> filter teacherId=X, assert hour != 1
- teacher X may teach only Tue/Thu -> filter teacherId=X, assert day in [Tue,Thu]

This avoids creating special "count zero" primitives for simple forbidden values.

## Rule 22
The deterministic part should compile as:
- filter `isHomeroomTeacher=true`
- filter `isTeacherFirstTeachingSlot=true`
- assert `isHomeroomForClass=true`

The special higher priority for teacher 33 remains semantic until weighted preferences
are introduced.

## Rule 6
The teacher-21 rule should be fully formalizable as an AND of:
1. all placements have day in [ג,ה]
2. all placements have hour != 1

## Regression coverage
Automated tests verify:
1. an incorrect first placement for a homeroom teacher is detected;
2. allowed-days + blocked-hour negative assertions work;
3. vacuous every_placement is rejected.
