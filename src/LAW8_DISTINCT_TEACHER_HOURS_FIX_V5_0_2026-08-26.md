# Law 8 / distinct teacher-hour fix — v5.0

## Root cause
`teacher_days.count` used `rs.length`, i.e. raw placement records.
A split/group can generate multiple records for the same teacher in the same timetable
hour. This caused six actual working periods to be counted as seven.

## Fix
`teacher_days.count` now equals the number of distinct timetable hour slots (`hs.length`).

The row now contains:
- `count`: distinct timetable hours
- `distinctHours`: same distinct-hour count
- `rawPlacementCount`: raw structural placement count, diagnostics only
- `startHour`, `endHour`, `gapCount`, `maxConsecutiveHours`: all based on the same
  distinct set of hours

## Validation
1. Synthetic regression: 7 placement records over 6 distinct periods -> Law 8 passes.
2. Real uploaded project `school-timetable-2026-08-26 (4).json` -> Law 8 passes:
   - Monday count = 6
   - Monday startHour = 1
   - among Tue/Wed/Thu: exactly one 6-hour day and two 5-hour days
   - all relevant days start at hour 1
   - no internal teacher gaps

No Rule 8 recompilation is required; its existing Formal Rule JSON evaluates correctly
once `teacher_days.count` has the correct semantics.
