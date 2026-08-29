# Rule Compiler v1.0.3 — Explicit gap semantics

The first live test showed that the compiler unnecessarily asked whether
"באמצע או בתחילת יום הלימודים" means internal gaps only or continuity from hour 1.
The text already resolves that distinction.

Changes:
- `no_gaps_from_first_hour` is now the canonical constraint when a rule explicitly
  mentions the start of the day / first hour.
- `no_internal_gaps` remains available for rules that prohibit only gaps between
  the first and last occupied periods.
- `class_no_internal_gaps` evaluator supports both semantics.
- Compiler instructions now require clarification only for genuinely missing information,
  and explicitly treat phrases such as בתחילת היום, מהשעה הראשונה, רק בימים,
  לפחות, לכל היותר, בדיוק, אסור and חייב as semantic evidence to encode.
- The exact test rule must compile as formalized with clarificationQuestion=null.

Regression:
The deterministic three-rule acceptance test remains valid on the reference timetable.
