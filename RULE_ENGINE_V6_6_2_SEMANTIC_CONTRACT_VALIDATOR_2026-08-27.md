# v6.6.2 — Semantic Contract Validator

## Goal
Add a deterministic contract between:
- originalText
- resolvedEntities
- capabilityPlan
- Formal Rule

The compiler is no longer trusted solely because its explanation sounds correct.

## 1. Stable grounding consistency
When the compiler resolves structural constraint groups but a generated/LKG Formal Rule
uses only a weaker `subject` filter, the client-side semantic contract layer repairs the
expression to `constraintGroupId eq/in resolved IDs`.

This applies to Last Known Good as well. A stale LKG rule is never restored blindly.

## 2. Capability contradiction -> exists
If a semantic-only result explicitly says that the only obstacle is a missing day and
also identifies `exists` as the correct representation, the deterministic repair layer
can construct an `exists` rule from uniquely resolved teacher/class/group entities and
the specified hour.

The unspecified day remains free for the solver.

## 3. Exclusive language
`required_slots` by itself is rejected for natural-language rules containing exclusive
scope such as "רק", "בלבד", or "אך ורק".

When a structural `constraintGroupId` makes the scope unambiguous, v6.6.2 repairs:

required_slots
+
every_placement(day/hour assertions)

This preserves both existence and exclusivity.

## 4. Last Known Good hardening
Malformed compiler JSON may still use LKG, but only after:
1. repairing it against current resolvedEntities,
2. checking exclusivity semantics,
3. validating the semantic contract.

A stale LKG that conflicts with the new grounding is not silently accepted.

## Regression tests
PASS:
- stale subject-based LKG -> current resolved constraint-group grounding
- semantic-only missing-day contradiction -> `exists`
- "only" required-slot -> existence + every-placement exclusivity

## Safety
Auto-repair of exclusivity is intentionally conservative: it is performed automatically
only when `constraintGroupId` gives an unambiguous structural scope. Otherwise the rule
is rejected instead of broadening a teacher/class restriction unsafely.
