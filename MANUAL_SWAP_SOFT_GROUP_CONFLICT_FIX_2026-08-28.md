# Manual Move/Swap Soft Group Conflict Fix

## Bug
Manual movement/swap inside the timetable was validated through
`getPlacementProblemForUnitInSchedule()`.

That function treated `violatesConstraintRulesInSchedule()` as a hard placement
failure. As a result, a group rule such as `notSameTime` ("אסור באותו טור")
prevented the user from completing a manual move/swap.

This contradicted the timetable UI contract:
- hard blocked time -> reject the move;
- teacher/group relationship conflict -> allow the move and display red conflict.

## Fix
`getPlacementProblemForUnitInSchedule()` now rejects only hard placement blocks:
- target class/hour does not exist;
- locked cell;
- teacher free day;
- teacher blocked hour;
- explicit constraint-group blocked time.

It no longer rejects `notSameTime` or `notSameDaySameClass`.

The existing warning/rendering path remains unchanged:
`hasNotSameTimeConflict()` and `hasNotSameDaySameClassConflict()` still detect
the conflict after placement, so the affected cells are marked as conflicts/red.

## Scope
The change affects the validation path used by manual table move/swap and the
bundle validation used for manual group/column movement. No hard-block semantics
were weakened.
