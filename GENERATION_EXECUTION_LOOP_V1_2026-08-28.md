# Generation Execution Loop v1 — 2026-08-28

## Goal
Run the first autonomous Empty → Full timetable-generation experiment inside the isolated Generation Workspace, preserving the agent's Python/search trace and independently validating every returned candidate.

## Architecture
1. UI sends current Generation Workspace candidate + schoolData + compiled rules.
2. `generation-async-start` recomputes the current Core Validator and formal-rule evaluations, uploads one self-contained input file, and starts an OpenAI background Response with Code Interpreter.
3. The model must write and execute its own Python scheduling/search procedure and emit `generated-candidate.json`.
4. UI polls `generation-async-poll` without holding a Netlify function open.
5. `generation-async-collect` retrieves the generated candidate and independently runs the Core Validator and Generic Rule Evaluator server-side.
6. Only that server-validated candidate becomes the Generation Workspace `workingSchedule`.
7. Python code/logs, strategy summary, validator output, formal evaluations and telemetry are retained in workspace attempts/trace and can be exported.

## Experimental principle
This v1 intentionally does NOT provide a large fixed solver action library. The agent is asked to construct its own finite search logic in Python. Repeated successful patterns observed in traces will later be candidates for generic solver primitives.

## Safety / isolation
- The real timetable is not modified.
- Generation works only on the isolated workspace schedule.
- Candidate output is never trusted without independent server-side validation.
- Existing v6.6.3 Rule Compiler and manual soft-conflict fix are preserved.

## UI
In an active Generation Workspace, use `הרץ Generation Attempt`. While the background response runs, status is polled. On completion the dashboard immediately reflects the validated candidate. Expand `Generation trace / Python` to inspect code and logs, or export the full trace.

## Validation performed here
- `node --check` passed for all three new Netlify functions.
- Static integration checks confirm the UI runner and App candidate-application bridge are present.
- A full Vite build was not claimed in this artifact environment because dependencies are not installed.
