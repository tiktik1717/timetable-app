# Rule Compiler automatic JSON export — v5.1

## Goal
After every successful Rule Compiler run, automatically create one portable JSON file
that can be attached directly for diagnosis instead of copying the long UI output.

## Automatic file
Filename pattern:

`rule-compiler-output-YYYY-MM-DD_HH-MM-SS.json`

The browser downloads one file after a successful compilation.

## Contents
The export contains:

- export metadata and timestamp
- summary counts
- the complete evaluated rule objects, including:
  - rule number / id
  - original text
  - category
  - severityMode / categorySource
  - interpretation
  - Formal Rule JSON
  - evaluator key and support status
  - deterministic status, summary and violations
  - compiler metadata
- the compiler's `compiledRules`
- telemetry
- the complete raw compiler server response
- deterministic evaluator output

The school dataset and full timetable are intentionally not duplicated into this
diagnostic file; the rule compiler/evaluator output itself is preserved in full.

## Failure behavior
If the browser blocks an automatic download, compilation itself still succeeds and
the normal on-screen result remains available.
