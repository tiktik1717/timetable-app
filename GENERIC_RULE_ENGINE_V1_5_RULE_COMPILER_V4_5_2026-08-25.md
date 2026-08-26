# Generic Rule Engine v1.5 / Rule Compiler v4.5

Changes based on the 17-rule regression run:

1. Added row-level boolean predicates (`condition`, `and`, `or`, `not`) to `every_placement`, while retaining backwards-compatible `assertions`.
2. Compiler guidance now preserves conditional prohibitions correctly. Example: “teacher 25 may not teach Tuesday hours 1–2” is scoped to Tuesday, rather than independently banning Tuesday and hours 1–2.
3. “No gap at the start of a class day” is compiled as `class_days` with `count > 0` and `startHour == 1`; empty days are ignored rather than encoded as `startHour in [0,1]`.
4. Added semantic resolution guidance for conceptual constraint-group categories such as “staff meetings”. The compiler resolves matching existing group IDs from `ENTITIES.constraintGroups` and uses them as exclusions; clarification is reserved for genuinely ambiguous group names.
5. Explicit recipe for “no 7 consecutive classroom-teaching hours, excluding staff meetings”: aggregate placements by teacher/day after excluding semantically resolved staff-meeting groups, then assert `max_consecutive_hours <= 6`.

Regression intent: all 17 rules should be formalizable/generic; a rule may still legitimately evaluate as violated by the current timetable.
