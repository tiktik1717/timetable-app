# Generation Workspace v1 — 2026-08-28

## Purpose
First infrastructure step for Generation Run #1: start from an empty timetable while preserving the current real timetable as a baseline/template.

## Added
- `createEmptyScheduleFromTemplate(schedule)` preserves the legal day/class/hour grid and clears all placements.
- `createGenerationWorkspace(schedule)` creates an isolated generation workspace with:
  - `mode: generation`
  - baseline/original schedule
  - empty working schedule
  - attempts, candidateHistory and trace containers.
- Scheduling Agent UI now offers two distinct workspaces:
  - repair workspace from current timetable
  - Generation Workspace from zero.
- Generation dashboard validates the empty/current candidate through the independent Core Validator and displays:
  - scheduled / required hours
  - percentage
  - missing hours
  - Core errors
  - warnings
  - number of units with missing hours.
- Trace export downloads the complete workspace, validation result, statistics and current rules for later agent-infrastructure analysis.

## Important architecture
The real timetable is never cleared. Generation occurs only inside an isolated workspace. The existing timetable is retained as baseline/reference data.

## Next experiment
Generation Run #1 should use this workspace and add placements incrementally. Every candidate should be validated and logged. Repeated Python/search operations observed in the trace should drive the later generic Solver Action Library.

## Preserved regression
The v6.6.3 Rule Compiler and manual soft-conflict swap behavior were preserved unchanged.

## Verification
`node --check` passed for modified plain JS infrastructure. Full Vite build could not be completed in the artifact environment because dependencies were unavailable; `npm ci` timed out and `vite` was not installed.
