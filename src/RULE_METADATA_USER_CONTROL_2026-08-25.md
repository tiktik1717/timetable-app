# Rule metadata controls — 2026-08-25

Implemented:
- Stable human-facing `ruleNumber`.
- Existing rules without a number are backfilled on the next compiler run.
- New rules receive max(existing ruleNumber)+1; deleting a rule does not renumber later rules.
- UI displays `חוק N — ...`.
- User can explicitly select category: critical / known_constraint / recommended / unspecified.
- A manual category gets `categorySource: "user"` and compiler reruns preserve it.
- Manual category updates formalRule.severity immediately.
- Compiler category inference strengthened:
  imperative Hebrew including "יש לשבץ", "צריך", "חובה", etc. => critical;
  preference language => recommended.
- The Friday homeroom rule wording "יש לשבץ..." should therefore infer critical
  when it has no user override.
