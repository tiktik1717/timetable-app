# Auto-Repair Loop v1.8.1 — schedule orientation fix

v1.8 failed before producing candidate-schedule.json.

Root cause:
The Attempt-0 generated Python drifted from the established Data Contract and implemented
helpers as if schedule were `schedule[className][day][hour]`.

Actual application contract:
`schedule[day][className][hour] = [unitId, ...]`.

v1.8.1 makes the orientation explicit repeatedly and supplies exact helper semantics:
- get_cell(schedule, day, className, hour)
- set_cell(schedule, day, className, hour, ids)
- iteration order day -> class -> hour

The complexity requirement is unchanged:
- no direct clean repair;
- no one-displacement clean repair;
- server-side verification with production Validator;
- Attempt 1 must solve a repair requiring at least two displaced existing placements.
