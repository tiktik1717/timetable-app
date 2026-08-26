# Generic Rule Engine v1.2 / Rule Compiler v4.2

Regression fixes based on the 17-rule run:

- Summary metrics now work on class_days / teacher_days: start_hour, end_hour, gap_count, distinct_hours, max_consecutive_hours.
- all_equal returns a real boolean.
- Added generic value metric for pre-aggregated fields.
- isHomeroomForClass is explicitly part of the compiler DSL, enabling generic non-homeroom rules from ENTITIES.homerooms.
- Compiler must not ask for homeroom mapping when ENTITIES.homerooms already provides it.
- Hebrew phrase "בשעתיים הראשונות לפחות" is explicitly compiled as required hour 1 AND hour 2 in the homeroom context.

No rule-specific evaluator was added. The changes extend/fix generic primitives only.
