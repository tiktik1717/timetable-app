# Agent infrastructure patch — 2026-08-23

## Changes

### 1. Fixed `proposedAction` Temporal Dead Zone bug
`SchedulingAgentView.handleSend()` no longer references `proposedAction` before declaration.
The older duplicate early solver invocation was not activated as part of this patch; the existing one-attempt workspace flow remains conservative and unchanged in behavior.

### 2. Connected deterministic formal-rule evaluation
`ruleEvaluator.js` now exports:
- `evaluateFormalRules()`
- `formalRuleEvaluationsToRuleCheckResults()`

`SchedulingAgentView` runs supported formal rules directly against the current/working schedule and sends those deterministic results to the server-side Agent.
For a rule with a supported deterministic evaluator, its deterministic result takes precedence over an LLM semantic judgment for the same rule.

### 3. Added Agent token telemetry
The Netlify scheduling function now returns a `telemetry` object containing:
- model
- inputTokens
- outputTokens
- totalTokens
- durationMs

`SchedulingAgentView` accumulates this usage for the current UI session and displays calls/input/output/total tokens and the last model used.
This includes evaluation calls made during workspace attempts.

### 4. Added Validator CLI entry point
New command:

```bash
npm run validate:schedule -- path/to/project.json [path/to/report.json]
```

It executes the existing Core Validator and also calls `evaluateFormalRules()` for any stored formal rules.
The report contains both sections and a compact summary.

### 5. Node ESM compatibility
`scheduleValidator.js` now imports `scheduleUtils.js` with an explicit `.js` extension, allowing the Validator to run directly in Node as well as through Vite.

## Verification performed

### Golden reference
Command run against the approved reference timetable:
- 775 required hours
- 775 scheduled hours
- 0 missing
- 0 extra
- 0 Core errors
- 0 Core warnings
- `coreValid: true`

### Formal rule smoke test
A temporary `teacher_day / no_internal_gaps` formal rule was injected and executed through the new CLI:
- formalRulesEvaluated: 1
- formalRulesSupported: 1
- formalRuleViolations: 0

### Syntax checks
Passed `node --check` for:
- `netlify/functions/scheduling-agent.js`
- `src/scheduling/ruleEvaluator.js`
- `src/scheduling/scheduleValidator.js`
- `scripts/validate-schedule.mjs`

### Full Vite build
A full `npm run build` could not be executed in this environment because the uploaded project contains no `node_modules`; `npm ci` was attempted but timed out before dependencies were installed. No `node_modules` are included in the output ZIP.
