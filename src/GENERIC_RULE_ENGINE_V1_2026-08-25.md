# Generic Rule Engine v1 / Rule Compiler v4

## Architectural change
Previous versions compiled natural-language rules to a registry of named evaluators.
That meant a new logical pattern could require a software upgrade.

v4 instead compiles rules to a small declarative DSL and runs them through one
deterministic generic engine.

## DSL primitives
Sources:
- placements
- student_classes
- teachers

Filters / exclusions:
- eq, neq, lt, lte, gt, gte, in, not_in
- day, hour, className, grade, teacherId, constraintGroupId, subject, unitType

Expressions:
- every_placement
- aggregate
- class_end_hour
- required_slots
- and

Metrics:
- count
- count_distinct
- min / max
- start_hour / end_hour
- distinct_hours
- max_consecutive_hours
- gap_count

## Backward compatibility
The existing v1/v2 named evaluators remain in ruleEvaluator.js.
Previously compiled rules therefore continue to work.
Newly compiled rules use Formal Rule version 4 + evaluatorKey=generic.

## Immediate target
Recompile rules 1–17. In particular, rules 14–17 should now compile generically:
14 Parashat Shavua -> every_placement day in ג
15 Monday end hour 5 except א3/ב3 -> class_end_hour
16 grade ו homeroom Monday hour 5 -> required_slots
17 library max hour 6 -> every_placement hour <= 6

## Important limitation
This is a general rule language, not an unrestricted programming language.
A future rule only requires code changes if it needs a genuinely new primitive/metric,
not merely a new combination of known selectors, filters, aggregations and assertions.
