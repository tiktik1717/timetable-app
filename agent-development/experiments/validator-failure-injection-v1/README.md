# Validator failure-injection test v1

Date: 2026-08-23

## Purpose
Prove the feedback half of the future Generation Loop:

Python -> deliberately defective candidate -> existing JS Validator -> machine-readable defect report.

## Test
The Coding Agent receives metadata.json and must use Python to:
1. deep-copy the current schedule;
2. find the first ordinary teaching-unit reference (`constraintGroupId == null`) whose class matches the scanned class;
3. remove exactly one occurrence;
4. write `/mnt/data/candidate-schedule.json`;
5. report the exact removed unit/class/day/hour.

The Netlify function retrieves that generated file from the Code Interpreter container and runs the existing `scheduleValidator.js` against it.

## Expected result on the current 775-hour reference schedule
- before: 775/775;
- after: 774/775;
- missing hours increase by exactly 1;
- Validator produces at least one new warning/error (normally `unscheduledUnitHours`);
- UI reports the infrastructure TEST as passed even though the candidate is intentionally incomplete.

## Why this matters
This validates the feedback path needed for the next milestone:
LLM writes code -> Python produces candidate -> Validator reports defect -> LLM receives report -> LLM changes code.
