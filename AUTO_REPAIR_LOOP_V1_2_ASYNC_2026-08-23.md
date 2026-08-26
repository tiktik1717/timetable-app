# Auto-Repair Loop v1.2 — asynchronous background architecture

## Why v1/v1.1 failed locally
`netlify dev` terminates a synchronous Function after 30 seconds. A single Code Interpreter
response could exceed that budget, so splitting the two attempts into two synchronous Functions
was still insufficient.

## v1.2 architecture
The model work no longer happens while a Netlify Function waits.

### Attempt 0
1. `auto-repair-async-start-0` uploads `metadata.json` and calls the OpenAI Responses API with
   `background: true`. It immediately returns `responseId`.
2. The browser polls `auto-repair-async-poll` every ~2 seconds.
3. Each poll uses `client.responses.retrieve(responseId)` and returns only status.
4. When status becomes `completed`, the browser calls `auto-repair-async-collect-0`.
5. Collect retrieves the completed response, downloads `candidate-schedule.json`, runs the existing
   JavaScript Validator, and returns the broken candidate + feedback.

### Attempt 1
1. `auto-repair-async-start-1` receives only the broken candidate + schoolData. It recomputes the
   Validator report server-side and starts a second background Response.
2. The browser polls the same status endpoint.
3. `auto-repair-async-collect-1` downloads `repaired-candidate.json` and validates it.

The pristine schedule is never supplied to Attempt 1.

## UI behavior
The UI shows the current phase and the OpenAI background status (`queued`, `in_progress`,
`completed`). The page can wait several minutes without keeping a Netlify Function invocation open.
Polling stops after eight minutes with a clear error.

## Reliability
- All Netlify requests are intended to be short.
- Non-JSON server responses are surfaced as readable diagnostics.
- Temporary OpenAI input files have a one-hour expiry and are deleted after collection.
- The server re-runs Validator instead of trusting client-provided feedback.
- The old synchronous Auto-Repair endpoints were removed to prevent accidental reuse.

## Acceptance
Attempt 0: 774/775 and exactly one missing hour detected.
Attempt 1: 775/775, 0 errors, 0 warnings, 0 missing and 0 extra hours.

## Implementation note
Shared async helper code lives under `netlify/lib/`, not `netlify/functions/`, so Netlify does not discover it as an endpoint.
