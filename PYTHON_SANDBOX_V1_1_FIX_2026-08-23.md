# Python Sandbox v1.1 fix — 2026-08-23

The first v1 infrastructure test could report a false failure when Code Interpreter
successfully ran Python and returned the correct structured counts, but stdout did
not contain the optional `SANDBOX_RESULT=` marker.

v1.1 changes:
- Success now requires:
  - model structured result says success;
  - at least one Code Interpreter call contains Python code;
  - at least one Code Interpreter call completed;
  - returned counts exactly match the server-side schoolData counts.
- `SANDBOX_RESULT=` remains a diagnostic check, not a hard pass/fail condition.
- Failed tests now return `checks`, `expectedCounts`, output item types, response id/status.
- The UI renders those diagnostics instead of only the generic failure sentence.

This keeps the test strict about actual Python execution while removing an unnecessarily
fragile dependency on one exact stdout string.
