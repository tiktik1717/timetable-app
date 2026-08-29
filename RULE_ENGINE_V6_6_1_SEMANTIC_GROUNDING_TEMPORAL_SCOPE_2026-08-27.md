# v6.6.1 — Semantic Grounding & Temporal Scope Hardening

## Stable structural grounding
The compiler now prefers resolved structural entities such as constraintGroupId,
teacherId and className over weaker free-text subject matching whenever ENTITIES
provides a complete structural match.

For the same originalText + ENTITIES, it is instructed not to replace a stronger
previously-grounded structural representation with a weaker textual one without
data-based reason.

## Mandatory vs exclusive semantics
The compiler explicitly distinguishes:
- "must exist at X" -> required_slots / exists
- "may/must occur only at X" -> every_placement assertions restricting every occurrence
- if both existence and exclusivity are intended -> AND of both

Thus required_slots alone is not allowed to represent the word "only".

## Partial temporal requirements
New generic expression:

```json
{
  "type": "exists",
  "source": "placements",
  "filters": [],
  "exclude": [],
  "minCount": 1,
  "maxCount": null
}
```

This allows rules that fix teacher/class/hour but intentionally leave day unspecified.
The solver keeps the unspecified dimension free instead of the compiler inventing a day
or requesting clarification merely because required_slots needs a full coordinate.

## Weighted objective overlap
When relative weights mean normal=1 and special=2, the preferred compilation is disjoint:
- general component excludes special entity, weight 1
- special component includes only special entity, weight 2

This avoids accidental total cost 3 from overlapping 1+2 components.

## Regression tests
PASS:
- exists leaves an unspecified day free
- "only" is enforced over every matching placement and catches an extra occurrence
- special weighted preference costs exactly 2 rather than 1+2
