# Rule Compiler v1 — 2026-08-23

## Purpose
Introduce natural-language Super Rules into the deterministic timetable pipeline without
hard-coding this year's rule list.

Pipeline:
natural-language rule
-> LLM Rule Compiler
-> formal IR
-> deterministic evaluator when supported
-> rule violation report
-> later: Planner/Python Solver

## Separation of concerns
`formalizationStatus` and `evaluatorKey` are deliberately separate.

A rule may be:
- `formalized`: represented without material loss in the IR;
- but `evaluatorKey=unsupported`: no deterministic evaluator exists yet.

This lets the IR grow from real rules without pretending every compiled rule is already enforced.

## Rule IR v1
formalRule:
{
  version: 1,
  scope,
  constraint,
  targets: {
    teacherIds: [],
    classNames: [],
    grades: [],
    constraintGroupIds: []
  },
  params: {
    days: [],
    hours: [],
    min: null,
    max: null,
    exact: null,
    count: null,
    value: null
  },
  logic: "all" | "any",
  severity: "critical" | "known_constraint" | "recommended" | "unspecified"
}

The compiler also preserves:
- originalText (on the app Rule object)
- interpretation
- resolvedEntities
- clarificationQuestion
- compilerExplanation
- compilerVersion / compiledAt

## Entity grounding
The compiler receives a compact index of teachers, classes and constraint groups from
schoolData. It is forbidden to invent IDs. Ambiguous/unresolved entities must cause
`needs_clarification`.

## Deterministic evaluator support in v1
- teacher_no_internal_gaps
- class_no_internal_gaps
- grade_same_end_hour
- teacher_allowed_days
- teacher_blocked_hours

Recognized but not yet deterministic:
- exact_slot
- unique_simultaneous_group_type
- other formally representable rules

## UI
The existing Super Rules panel now has:
`Rule Compiler v1 — קמפל חוקים`

After compilation each rule displays:
- status
- category
- interpretation
- evaluator key
- formal JSON
- clarification request if needed

Supported rules are immediately evaluated against the current working/base schedule and
their checkStatus is updated.

## Acceptance test
Add rules such as:
1. `כל כיתות ד' חייבות לסיים בכל יום באותה שעה`
2. `למורה גימני ליאור אסור שיהיו חלונות במערכת`
3. `אסור שלכיתה יהיה חור באמצע או בתחילת יום הלימודים`

Run Rule Compiler v1.

Expected:
- all three should formalize;
- entity names must resolve to real IDs where applicable;
- evaluator keys should be grade_same_end_hour / teacher_no_internal_gaps /
  class_no_internal_gaps;
- deterministic results should appear immediately.

This is Rule Compiler v1, not yet the complete Super Rule language.
