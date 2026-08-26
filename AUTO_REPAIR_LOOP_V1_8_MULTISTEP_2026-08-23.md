# Auto-Repair Loop v1.8 — Multi-Step Repair Benchmark

## Purpose
This is the final Repair benchmark before moving to Super Rules / Rule Compiler work.

Attempt 0 must create a candidate that:
- is short by exactly one required teaching hour;
- has the missing unit's original slot occupied by another unit;
- has NO clean direct-insertion repair;
- has NO clean repair involving only one displaced existing unit.

The backend verifies the last two conditions by brute-force candidate generation and the
same production `scheduleValidator.js`. Therefore the test cannot accidentally degrade
into the simpler v1.6/v1.7 benchmark.

## Intended mutation
In one class:
Pristine: A=U, B=V, C=W
Broken:   A=V, B=W, C=empty, U missing

A natural repair is:
W: B->C
V: A->B
U: ->A

That requires two existing-unit displacements plus the missing-unit insertion.

## Attempt 1
Attempt 1 receives no pristine schedule. It gets only:
- broken candidate;
- school metadata;
- Validator report.

The prompt directs it to breadth-first search by edit distance:
depth 0 direct insertion;
depth 1 one displacement + insertion;
depth 2 two displacements + insertion;
and deeper only if required.

## Acceptance
Attempt 0:
- controlledDefectDetected=true
- directRepairExists=false
- oneDisplacementRepairExists=false
- requiresAtLeastTwoDisplacements=true

Attempt 1:
- 775/775
- 0 errors
- 0 warnings
- 0 missing
- 0 extra

After this benchmark, project work proceeds to Rule Compiler v1 / Super Rules.
