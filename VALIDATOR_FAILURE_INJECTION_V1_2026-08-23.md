# Validator Failure Injection v1 — 2026-08-23

Adds a controlled negative test after Candidate -> Validator bridge v1.

A new Netlify function `candidate-validator-failure-test.js` instructs Code Interpreter to remove exactly one ordinary teaching-unit reference from the current schedule and create a new `candidate-schedule.json`.

The generated file is retrieved from the Code Interpreter container and validated by the application's existing `scheduleValidator.js`.

Success criteria are deliberately inverted from a normal candidate test: the test passes only when Python actually ran, exactly one scheduled unit reference disappeared, and the Validator detected the resulting missing-hour defect.

The Scheduling Agent UI includes a new panel: `Validator failure-injection test v1` and displays before/after scheduled hours, missing hours, warnings/errors, the injected unit/class/day/hour, and the generated Python/logs.
