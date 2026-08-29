# v6.5 — DSL Capability Awareness

## Goal
The compiler should discover compositions of existing DSL primitives before declaring
a natural-language requirement unsupported.

## Engine-owned capability catalog
`genericRuleEngine.js` now exports `GENERIC_RULE_DSL_CAPABILITIES`.
The Rule Compiler imports this object directly, so the capability description is tied to
the actual engine rather than maintained only as prose in the prompt.

The catalog describes:
- sources and their teaching/activity universes;
- expression types and composition roles;
- metrics, inputs, outputs and sequence semantics;
- mandatory planning principles.

## Mandatory capability plan
Every compiled rule now includes:

```json
{
  "capabilityPlan": {
    "requirements": [],
    "selectedCapabilities": [],
    "composition": "",
    "unsupportedRequirements": []
  }
}
```

Before selecting `semantic_only`, the compiler must:
1. decompose the rule;
2. ground each requirement;
3. search the catalog for a composition path;
4. try aggregate_pipeline / conditional / coverage / objective as applicable;
5. name the genuinely unsupported remainder.

A DSL-based `semantic_only` with an empty `unsupportedRequirements` list is flagged by
the collector as a planning inconsistency.

## Generic pipeline improvements
`aggregate_pipeline` assertions are now evaluated against every final derived row, not
only the first one. This lets one expression validate the same weekly pattern for many
teachers/classes/groups.

A new explicit `sum` metric is available for derived numeric fields.

Generic `or` composition is also supported by the evaluator.

## Unseen-pattern regression
The regression test uses anonymous target groups, not English-specific names. It composes:
- per-day `count_distinct(hour)`;
- per-day `max_consecutive_hours(hour)`;
- weekly `count_where`;
- weekly `sum`;
- assertions on every final target group.

One target satisfies a `2 consecutive + 1 + 1 = 4` weekly pattern and another deliberately
uses two non-consecutive hours. The evaluator correctly identifies only the second target
as violating the pattern.

This is intended to test capability composition, not a hard-coded Rule 21 handler.
