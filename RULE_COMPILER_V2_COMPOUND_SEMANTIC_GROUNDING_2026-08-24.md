# Rule Compiler v2 — Compound Rules & Semantic Grounding

## Motivation
The first five real critical rules exposed three structural gaps in v1:
1. one natural-language rule could contain several simultaneous constraints;
2. day names were not normalized to schedule keys;
3. the compiler asked for homeroom information already present in schoolData.

## Compound IR
A natural-language rule remains ONE rule object and can compile to:
{
  version: 2,
  operator: "AND",
  clauses: [...]
}

Each clause carries its own evaluatorKey, targets and params.
The top-level evaluatorKey is `compound`.
The deterministic evaluator evaluates every clause and combines them with AND.

Examples now supported:
- grade same end hour + exact Sunday end hour;
- teacher allowed days + blocked first hour.

## Canonical day normalization
Compiler receives:
ראשון->א, שני->ב, שלישי->ג, רביעי->ד, חמישי->ה, שישי->ו.
IR stores canonical day keys.
Evaluator also normalizes aliases defensively.

## Semantic grounding
Compiler receives a compact homeroom map derived from teachers[].educationClass:
className -> teacherId/name.
It must use this information rather than asking the user to restate it.

## New deterministic evaluators
- grade_exact_end_hour
- homeroom_first_hours
- non_homeroom_max_hours_same_class_day

Existing evaluator support remains:
- grade_same_end_hour
- teacher_no_internal_gaps
- class_no_internal_gaps
- teacher_allowed_days
- teacher_blocked_hours

## Important semantics
`אסור שמורה שאינו מחנך כיתה יהיה משובץ בכיתה כלשהי ארבע שעות ביום אחד`
compiles as max=3 for each teacher x specific class x day, excluding that class's homeroom teacher.

`בימי שישי יש לשבץ את מחנך הכיתה בכיתה שלו בשעתיים הראשונות לפחות`
uses the existing homeroom map and count=2, days=["ו"].

## Category handling
If a Rule object already has a non-unspecified category, the compiler must preserve it.
If unspecified, imperative/prohibition language is inferred as critical and preference
language as recommended.

## Acceptance
The deterministic evaluator test mirrors the five real rules and passes against the
current reference timetable. Core Validator regression remains 775/775 clean.
