# Auto-Repair Loop v1.1 — split-request fix

## Why v1 timed out
v1 executed two OpenAI Code Interpreter Responses calls inside one Netlify Function invocation.
On the deployed environment, the combined duration exceeded the request execution limit.
The frontend then tried to JSON.parse the platform's plain-text `TimeoutError`, producing:
`Unexpected token 'T', "TimeoutErr"... is not valid JSON`.

## v1.1 architecture

Browser orchestration:

1. POST `/.netlify/functions/auto-repair-attempt-0`
   - one Code Interpreter call;
   - Python removes one ordinary scheduled occurrence;
   - server downloads the generated candidate;
   - existing `scheduleValidator.js` validates it;
   - response returns the broken schedule + Validator report + Python logs.

2. Browser receives attempt 0 and immediately POSTs
   `/.netlify/functions/auto-repair-attempt-1`
   - separate Netlify invocation and timeout budget;
   - receives schoolData, the broken schedule and Validator feedback;
   - does NOT receive the pristine timetable and is not told the removed day/hour;
   - one Code Interpreter call repairs the candidate;
   - same `scheduleValidator.js` validates the repaired candidate.

## Additional reliability change
The UI now reads HTTP responses as text first and parses JSON explicitly.
If Netlify returns plain text such as `TimeoutError`, the user sees that server response directly
instead of a misleading JSON parse exception.

## Acceptance
Attempt 0:
- 774/775
- exactly one missing hour detected by Validator

Attempt 1:
- 775/775
- 0 core errors
- 0 warnings
- 0 missing hours
- 0 extra hours

## Security / trust
Attempt 1 re-runs the Validator server-side on the broken schedule and does not trust the
Validator report sent by the browser. Generated candidates are also validated server-side.
