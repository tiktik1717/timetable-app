# Candidate → Validator bridge v1

Date: 2026-08-23

Purpose: prove that a candidate timetable can be created as a real file by Python inside the Code Interpreter sandbox, retrieved by the backend, and validated by the application's existing scheduleValidator.js.

Expected smoke-test flow:
1. metadata.json contains schoolData + the current valid baseSchedule.
2. Python reads metadata.json.
3. Python writes candidate-schedule.json containing the same schedule (no solving yet).
4. Backend retrieves the generated container file bytes.
5. Backend runs validateSchedule() on those bytes.

Expected reference result:
- 775 / 775 hours
- 0 errors
- 0 warnings
- bridge success=true

The Python code from the first successful real API run should be saved here later as attempt-001.py together with its logs/telemetry.
