# Python Sandbox v1 — 2026-08-23

## Goal
Prove the first Generation-Agent execution pipe before building a timetable solver:

Agent/OpenAI -> isolated Python -> read metadata file -> write result.json -> logs/result -> UI.

## Architecture choice
V1 uses the OpenAI Responses API `code_interpreter` tool rather than trying to spawn `python3` inside a Netlify JavaScript Function.

Reasons:
- isolated Python container;
- input files can be attached to the container;
- Python code and logs are returned in the API response;
- compatible with the existing OpenAI API/Netlify architecture;
- no arbitrary OS shell access is exposed from the timetable application.

## New server endpoint
`netlify/functions/python-sandbox-test.js`

The endpoint:
1. Receives `schoolData` from the current Agent Context.
2. Creates temporary `metadata.json`.
3. Uploads it to the OpenAI Files API as `user_data`, with a 1-hour expiry.
4. Starts a Responses API request with `code_interpreter` and that file attached.
5. Requires the model to execute Python that:
   - reads metadata.json;
   - counts teachers, classes and teachingUnits;
   - writes `/mnt/data/result.json`;
   - reads the generated result back;
   - prints `SANDBOX_RESULT=<json>`.
6. Extracts every `code_interpreter_call`, including code, logs and container ID.
7. Marks the test successful only if Python code actually ran and the expected log exists.
8. Deletes the temporary uploaded input file in `finally`.

## UI
`SchedulingAgentView.jsx` now contains a `Python Sandbox v1` panel and button:

`בדוק Python Sandbox`

On success it displays:
- teacher count;
- class count;
- teaching-unit count;
- number of Python runs;
- input file byte count;
- expandable Python source and logs.

The Code Interpreter LLM tokens are also added to the existing session token telemetry.

## What v1 intentionally does NOT do
- no timetable generation yet;
- no solver.py persistence yet;
- no OR-Tools model yet;
- no Candidate Schedule generation yet;
- no automatic Validator call on a generated candidate yet;
- no multi-attempt Generation Workspace yet.

Those are the next milestones after this execution pipe passes its real API test.

## Acceptance test
Open the Scheduling Agent and press `בדוק Python Sandbox`.

Expected successful result:
- green success panel;
- non-zero teacher/class/teachingUnit counts;
- Python runs >= 1;
- expandable code block;
- logs containing `SANDBOX_RESULT=`;
- session token telemetry increases.

If the endpoint fails, capture the exact red error text and Netlify Function log for `python-sandbox-test`.

## Important implementation note
The project ZIP does not contain node_modules, so the sandbox endpoint could not be executed against the real OpenAI API in the artifact environment. JavaScript syntax checks passed. The real integration test requires the project's `SCHEDULING_OPENAI_API_KEY` in the deployed/local Netlify environment.
