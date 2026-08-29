# Generation Execution Loop v1.1 — resilient file retrieval + failed-run trace

## Failure observed
Generation Run #1 completed at the Responses/Code Interpreter layer, but collection failed with:
`generated-candidate.json was not returned by Code Interpreter`.
The exported workspace trace then contained no attempt/code-run entries because v1 only persisted successful candidates.

## Generic root cause
The collector treated a final-message file annotation as the transport contract. A Code Interpreter run may create `/mnt/data/generated-candidate.json` while the final model message does not expose an annotation for that file. The shared infrastructure already had a generic `findContainerFileByName()` capability, but the generation collector did not use it.

## v1.1 fix
1. Prefer the response file annotation when available.
2. If it is absent, enumerate every Code Interpreter container used by the response and locate `generated-candidate.json` by deterministic filename.
3. Retrieve the file from the container and continue normal Core Validator + formal rule evaluation.
4. If collection still fails, return `modelResult`, `codeRuns`, telemetry and responseId as diagnostics.
5. Persist failed generation attempts in the Generation Workspace trace, including Python code/logs, instead of losing the most useful experimental evidence.
6. Generation trace export version increased from 1 to 2.

This is a generic infrastructure fix; it does not encode any school-specific scheduling rule or solver strategy.
