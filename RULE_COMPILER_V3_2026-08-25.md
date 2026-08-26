# Rule Compiler v3 — 2026-08-25

Built from v2.2 async.

## Added
1. Deterministic Category Guard in UI merge:
   - explicit mandatory/prohibitive Hebrew => critical;
   - explicit preference language => recommended;
   - manual user category always wins.
   This fixes the Friday homeroom rule being returned as recommended by the model.

2. New formal evaluator primitives:
   - grade_end_hour_cardinality
   - teacher_free_day_cardinality
   - teacher_exact_day_load
   - teacher_day_load_cardinality
   - teacher_max_consecutive_class_hours
   - unique_simultaneous_group_type

3. Compiler prompt/schema updated so rules 9–13 can be represented with these
   primitives rather than semantic_only/unsupported.

## Intended mappings
- Rule 9: grade_end_hour_cardinality grades ד+ה, days ג/ד/ה, exactly 2 at hour 6,
  remaining at hour 5.
- Rule 10: teacher_free_day_cardinality teacher 28, days ג/ד/ה, exactly 1.
- Rule 11: compound: no gaps + Monday exact 6 from hour 1 +
  exactly one of ג/ד/ה has 6 from hour 1 + exactly two have 5 from hour 1.
- Rule 12: teacher_max_consecutive_class_hours max 6, teamMeeting excluded.
- Rule 13: unique_simultaneous_group_type for resolved Parashat Shavua groups.

## Acceptance target
Compile the same 13 rules:
13 formalized / 13 deterministic evaluators supported / 0 semantic_only / 0 clarification.
Then inspect actual deterministic violations; support does not imply that the current
schedule necessarily satisfies every new rule.
