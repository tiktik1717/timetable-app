# Flexible Rule Model — v5.2

## Purpose
Not every timetable instruction should be forced into deterministic Formal Rule JSON.
The rule compiler now separates **importance/category** from **execution kind**.

## Rule kinds
- `hard_constraint` — condition on the final schedule.
- `soft_preference` — preference about the final schedule; formalize when measurable.
- `comparison_objective` — compares a candidate to a baseline/current schedule.
- `search_strategy` — guides which moves/search actions to try first.
- `semantic_guidance` — understood instruction that remains useful without a formal evaluator.

## Formalization statuses
- `formalized` — deterministic Formal Rule JSON exists.
- `semantic_only` — valid, understood, active guidance with no deterministic JSON required.
- `needs_clarification` — meaning itself is ambiguous.

`semantic_only` is no longer treated as a compiler failure.

## Compiler output
Every compiled rule now also returns:
- `ruleKind`
- `semanticGuidance`

For semantic-only rules, `semanticGuidance` is the operational instruction passed to the
Scheduling Agent.

## UI
Compiler summary distinguishes:
- deterministic/evaluator-supported rules
- flexible semantic guidance
- rules that genuinely need clarification

Each rule card shows its application kind. Semantic-only rules show
`◈ הנחיה גמישה` instead of looking like an unsupported/error state.

## Agent behavior
The scheduling agent receives all rules, including semantic-only rules.
It is explicitly instructed to:
- enforce hard/critical rules first,
- optimize soft preferences,
- compare candidates using comparison objectives,
- use search strategies to order candidate moves,
- keep semantic guidance active even when there is no Formal Rule JSON.

This establishes the architecture needed for rules such as:
- minimize number of changes,
- do not add sixth-hour teacher loads relative to baseline,
- move ordinary lessons before moving constraint groups,
without pretending that these are deterministic predicates on a single schedule.
