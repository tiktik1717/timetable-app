# Generic Rule Engine v1.3 / Rule Compiler v4.3

Purpose: close the two remaining gaps found by the 17-rule regression run.

## Changes
- Added generic `aggregate_pipeline` for aggregate-of-aggregate rules.
- Added `common_value` metric: returns the shared value of a group, or `null` when values differ.
- Rule 9 pattern is now expressible correctly: derive one common end hour per day for grades ד+ה, then count days at 6 and days at 5.
- Compiler guidance now performs logical simplification for continuity: `startHour=1 + gapCount=0 + count=N` already proves N consecutive hours starting at hour 1. It must not request a conditional primitive for this pattern (Rule 11).
- Added executable regression test `scripts/test-generic-rule-engine-v1.3.mjs` for the nested aggregation shape.

## Regression target
The existing 17 natural-language rules remain the fixed regression suite. Expected compiler target: 17/17 formalized, evaluatorKey generic, zero clarification requests. This is a capability regression suite, not a set of hard-coded evaluators.
