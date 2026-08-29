# v6.0 — Generic activity semantics

Adds a general distinction between scheduled activities and instructional lessons.

Each placement now exposes `activityKind` (`instructional`, `meeting`, `duty`, `support`, `other`) and `isInstructionalPlacement`. Explicit `unit.activityKind` / `group.activityKind` wins; existing structural metadata such as `groupKind=meeting` and `type=teamMeeting` is used as fallback; old ordinary units remain instructional by default. Classification deliberately does not guess from subject-name text.

Two time-position families are now available. `teacherActivity...` / `classActivity...` fields include every scheduled activity. Existing `teacherTeaching...` / `classTeaching...` fields now include instructional placements only. Therefore a meeting at hour 1 followed by a lesson at hour 2 is the first activity at hour 1 but the first teaching slot at hour 2.

The compiler is instructed to choose TeachingSlot for natural-language rules about lessons/teaching, and ActivitySlot for rules about activities/scheduled placements. This is intended to support future meetings, duties, support sessions and other activity types without one-off evaluator primitives.
