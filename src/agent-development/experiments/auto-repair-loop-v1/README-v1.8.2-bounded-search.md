# Auto-Repair Loop v1.8.2 — Bounded Search

## Why
v1.8.1 successfully generated and server-verified a genuine multi-step defect:
- directRepairExists=false
- oneDisplacementRepairExists=false
- requiresAtLeastTwoDisplacements=true

Attempt 1 then behaved like an interactive REPL and generated 50+ Code Interpreter runs.

## Change
Attempt 1 now has a strict execution contract:
- Run 1: write and execute the COMPLETE local BFS/search program.
- Run 2: apply the complete plan and write repaired-candidate.json.
- Runs 3-4: emergency-only.
- The prompt explicitly forbids one-branch-per-run exploration.
- Search is capped at depth 2 for this benchmark unless the verified assumptions prove inconsistent.

## Guardrail
The collector enforces `pythonRunLimit = 4`.
If a completed response contains more than four Code Interpreter calls, the benchmark fails
with a controlled diagnostic rather than being accepted.

Note: the Responses API executes the model's Code Interpreter calls inside a single background
response. The collector can enforce the budget on completion; the primary prevention mechanism
during generation is therefore the strict prompt/execution contract.

## Acceptance
Attempt 0 remains unchanged and must prove:
directRepairExists=false
oneDisplacementRepairExists=false
requiresAtLeastTwoDisplacements=true

Attempt 1:
- <= 4 Python runs (target 2)
- 775/775
- 0 errors
- 0 warnings
- 0 missing
- 0 extra

After this benchmark, move to Rule Compiler v1 / Super Rules.
