# User-selected rule severity v4.9 — 2026-08-26

## Change
The rule-entry panel now includes a severity selector:
- Automatic
- Critical
- Known constraint
- Recommended

## Semantics
- Automatic: the compiler/deterministic guard may infer the category.
- Manual: the user's category always overrides compiler output.
- Each rule persists `severityMode` (`auto` or `manual`) in the same rule object, so it is automatically included in local project JSON and cloud project persistence.
- Existing per-rule category editing remains available.
- Selecting a category on an existing rule switches it to manual mode.
- Selecting Automatic switches it back to automatic mode; the last visible category remains until the next compiler run.

## Compatibility
Older project rules that use `categorySource: "user"` continue to be treated as manually classified.
