# Cloud Scheduling Agent persistence v4.8 — 2026-08-26

- Cloud create/update already use `buildProjectData()`, which now contains `schedulingAgent.rules` and `schedulingAgent.approvedExceptions`.
- Cloud load restores the same data through `restoreSchedulingAgentProjectData(projectData)`.
- Strengthened new-cloud-project state bookkeeping (`loadedCloudProjectIdRef`, localStorage selection, saved status/time).
- Added explicit save/load diagnostics showing the number of Scheduling Agent rules persisted/restored.
- Existing cloud projects created before this schema remain compatible; after loading them they may initially report 0 rules until the current rule-bearing project is saved/updated to that cloud record.
