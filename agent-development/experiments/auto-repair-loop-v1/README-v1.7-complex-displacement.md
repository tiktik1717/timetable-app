# Auto-Repair Loop v1.7 — Complex Displacement Benchmark

## Goal
Move beyond the trivial missing-hour benchmark. Attempt 0 now creates a defect where
the missing unit cannot simply be returned to its original slot.

## Controlled defect
Choose ordinary units U and V in the same class:
- U originally occupies A.
- V originally occupies B.
- U's teacher is busy elsewhere at B.
- V's teacher is free at A.

Mutation:
- remove U from A;
- move V from B to A;
- B becomes empty.

The schedule is therefore short by one required hour, but A is occupied. Restoring U
requires at least moving V back/out before U can occupy A; U cannot simply use B because
its teacher is busy there.

## Validation of injection
collect-0 now requires:
- exactly one scheduled hour lost;
- at least one missing hour reported;
- the missing unit's original slot is occupied by another unit.

## Repair strategy
Attempt 1 still receives no pristine schedule and is not told the mutation strategy.
It receives only the broken candidate, metadata and Validator report.

The prompt now asks it to search in increasing edit distance:
1. direct insertion;
2. one displacement + insertion;
3. longer displacement chain if necessary.

The first Python run should diagnose and find the smallest repair plan; the second
should apply it and write repaired-candidate.json.

## Acceptance
Primary:
- 775/775
- 0 errors
- 0 warnings
- 0 missing
- 0 extra

Secondary:
- observe Python-run count;
- inspect whether the agent discovers a genuine displacement repair rather than relying
  on the pristine timetable (which is never supplied to Attempt 1).
