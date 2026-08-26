# Project rule loading fix v4.7 — 2026-08-26

## Observed behavior
Project JSON files correctly contained `schedulingAgent.rules`, but after loading a project from disk the Scheduling Agent UI could still show an empty rule list.

## Changes
1. `restoreSchedulingAgentProjectData()` now deep-clones and restores project rules/exceptions transactionally.
2. It re-applies the restored data once after the project-load render cycle, guarded by a restore token so an older delayed restore cannot overwrite a newer project.
3. `SchedulingAgentView` is remounted after project-level agent data is restored, preventing stale internal component state from masking newly loaded rules.
4. Loading a standalone project file now clears the previously selected cloud-project association. This prevents asynchronous cloud initialization/auto-save logic from overwriting the just-loaded local project state.
5. The successful-load alert now reports how many project rules were restored, providing an immediate diagnostic.

## Expected verification
Load a JSON project containing one rule. The success alert should say `חוקי־על ששוחזרו: 1`, and the Scheduling Agent view should display that rule.

## Build note
A full Vite build could not be completed in the sandbox because dependency installation timed out. The source patch was inspected and packaged without `node_modules`.
