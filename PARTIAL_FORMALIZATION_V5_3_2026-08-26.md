# Partial Formalization — v5.3

## Why
A rule must not be shown as fully satisfied when the deterministic JSON covers only part
of its meaning. At the same time, useful deterministic coverage should not be discarded
just because one semantic component is not expressible in the current DSL.

## New status
`partially_formalized`

A partially formalized rule has:
- a valid `formalRuleJson` for the deterministic subset;
- `formalCoverage.covered` describing exactly what the evaluator checks;
- `formalCoverage.semanticOnly` describing what remains semantic;
- `semanticGuidance` for the Scheduling Agent.

The UI shows:
- `◐ החלק הפורמלי מתקיים` or `◐ החלק הפורמלי מופר`;
- the covered portion;
- the semantic-only remainder.

## State freshness
Every fresh compilation clears old evaluator fields for rules that no longer have a
current deterministic result. This prevents an old `satisfied` / `evaluatorSupported`
state from surviving after a rule becomes semantic-only or needs clarification.

## Invalid inner Formal Rule JSON
The async collect guard now attempts only conservative repairs:
1. remove markdown JSON fences;
2. extract an outer JSON object if explanatory text leaked around it;
3. remove trailing commas.

If parsing succeeds, the JSON is canonicalized before returning it to the UI.
If it still fails, the compiler does **not** pretend the rule is formal. It becomes
`semantic_only`, evaluator support is removed, and the downgrade is documented.

The compiler prompt also includes an explicit fully-formalizable pattern for
"exactly one free day among a set of days", reducing regression risk for Rule 5.

## Example: English 2+1+1
A preference requiring three English days with a 2+1+1 distribution, where the pair must
also be consecutive, should be `partially_formalized` until the DSL can deterministically
check subject-specific consecutiveness. The quantitative distribution may be formal;
consecutiveness remains semantic.
