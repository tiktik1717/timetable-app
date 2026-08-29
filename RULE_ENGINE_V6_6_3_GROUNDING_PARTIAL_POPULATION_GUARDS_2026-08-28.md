# Rule Engine v6.6.3 — Grounding, Partial Preservation & Population Guards

## Goal
Strengthen the generic Semantic Contract layer without adding rule-specific hacks.

## New generic guards

### 1. Temporal Grounding Guard
If the user's text leaves the day unspecified, a Formal Rule may not invent a
concrete day in `required_slots`.

Safe deterministic repair:
- `required_slots` with an invented day
- becomes `exists`
- teacher/class/group/hour remain grounded
- day remains free for the solver.

This addresses the generic class of "hallucinated temporal coordinates".

### 2. Partial Preservation Guard
If a new compiler run returns `needs_clarification` only because part of a rule
is ambiguous, but the previous version already contains a validated
`partially_formalized` deterministic subset, that subset is preserved after
re-validation against the current semantic contract.

The ambiguous remainder still remains semantic/clarification guidance.

### 3. Objective / Coverage Population Guard
For `coverage` expressions, temporal-position selectors such as
`isTeacherFirstTeachingSlot` describe the measured population when the natural
language is about starting/ending/first/last lesson.

They are moved from `match` to `filters`, so all other lessons in the day are
not incorrectly counted as failures.

Example:
- Wrong population: all lessons of the homeroom teacher; numerator = first
  lesson in homeroom class.
- Correct population: first teaching lesson only; match = homeroom class.

## Preserved previous fixes
- v6.6.2 Semantic Contract Validator
- structural constraint-group grounding
- exclusivity repair for "רק/בלבד"
- missing-day `exists` capability repair
- hardened last-known-good fallback
- manual timetable move/swap: `notSameTime` ("אסור באותו טור") remains a soft
  conflict, not a hard block. The move is allowed and conflict coloring remains.

## Version
- compilerVersion:
  `rule-compiler-v6.6.3-grounding-partial-population-guards`
- exportVersion: 18

## Regression tests
`agent-development/experiments/semantic-contract-v6.6.3-regression.mjs`

Passed:
1. invented day -> `exists` without day
2. first-slot coverage condition -> population filter
3. safe partial formalization preservation

## Build note
Node syntax checks for the modified non-JSX files passed. A full Vite build was
not run in the artifact environment because dependencies/node_modules are not
installed there (`vite: not found`).
