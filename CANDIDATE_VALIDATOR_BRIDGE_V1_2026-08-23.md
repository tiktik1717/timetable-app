# Candidate → Validator bridge v1 — 2026-08-23

## What was added
- New Netlify endpoint: `/.netlify/functions/candidate-validator-bridge`.
- New Agent UI panel/button: `בדוק Candidate → Validator`.
- Python Code Interpreter receives a real `metadata.json` containing `schoolData` and `baseSchedule`.
- Python must create a new `/mnt/data/candidate-schedule.json` file.
- The backend retrieves the actual generated container file rather than asking the model to print the whole timetable as text.
- The backend parses that file and runs the existing `src/scheduling/scheduleValidator.js` on it.
- Existing supported formal rules are also evaluated through `evaluateFormalRules()`.
- Python code/logs, file size, validator statistics, and token telemetry are returned to the UI.

## Why the v1 test copies the current schedule
This milestone tests transport and validation, not solving. By copying a known valid schedule, any failure can be attributed to the bridge rather than solver logic.

Expected result for the current reference timetable:
- 775/775 hours
- 0 Core errors
- 0 warnings
- `success: true`

## Generated-file transport
Code Interpreter generated files are returned by the Responses API through file/container annotations. The backend extracts that reference and retrieves the generated file bytes from the container before validation. This avoids serializing a full timetable into model output tokens.

## Additional regression fix
The uploaded `timetable-app-230826.zip` had `validate:schedule` in `package.json` but did not contain `scripts/validate-schedule.mjs`. The script was restored from the prior validated project version and smoke-tested again.

## Local smoke test performed
The restored CLI was run against the approved reference schedule and successfully wrote a validation report with 775/775 and zero Core errors/warnings.

## Next step after a successful real API test
Candidate mutation test: Python deliberately makes one controlled invalid change and the bridge must return the expected Validator error. After that, create a Generation Workspace that begins from an empty schedule.
