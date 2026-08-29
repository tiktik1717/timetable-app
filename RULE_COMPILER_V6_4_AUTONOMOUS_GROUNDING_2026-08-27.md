# Rule Compiler v6.4 — Autonomous Grounding Policy

## Goal
Reduce unnecessary clarification without adding one-off rule handlers. The compiler now treats the supplied ENTITIES as a closed world for compilation.

## Closed-world grounding
- Do not speculate about entities that are not present in ENTITIES.
- If a natural-language reference maps uniquely to existing entities, use that mapping.
- Clarification is reserved for real ambiguity: two or more plausible mappings that actually exist in the supplied data and would produce different formal rules.

## Domain defaults
- No day restriction => all canonicalDays.
- No explicit exception => no exception.
- A uniquely matched subject/group population in the requested grades/layers => use those entities; do not ask whether hypothetical additional entities exist.
- Record inferred defaults in notes rather than asking for confirmation.

## DSL-first clarification policy
Before returning needs_clarification, attempt composition with all existing generic primitives: and, aggregate, aggregate_pipeline, conditional, coverage, objective.

## Weekly distribution pattern
The existing aggregate_pipeline is sufficient for patterns such as “for each target group: one day with two consecutive lessons and two days with one lesson”. Stage 1 derives per-day properties (hour count and maximum run); stage 2 counts day types per group. No special-purpose evaluator was added.

## Backward cleanup
Prompt guidance now consistently prefers explicit teaching/activity universes over ambiguous legacy teacher_days/class_days wording.

## Regression
PASS: aggregate_pipeline represents a generic weekly 2+1+1 distribution with the double lesson consecutive.
PASS: JavaScript syntax checks for src and Netlify functions.
