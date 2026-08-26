# Rule Compiler v1.0.2 — Student-class scope fix

## Problem found by the first Rule Compiler test
`class_no_internal_gaps` treated every entry in `schoolData.classes` as a real student class.
In this dataset that list also contains technical schedule rows such as:
- צוות ניהול
- צוות שילוב
- הדרכת מתמטיקה ...
- הדרכת שפה ...

That caused false violations for the global rule:
`אסור שלכיתה יהיה חור באמצע או בתחילת יום הלימודים.`

## Fix
A canonical helper `getStudentClassNames(schoolData)` now derives actual student classes
from `teachers[].educationClass`, which represents the homeroom relationship and yields
the real class rows only.

Fallback behavior for datasets without `educationClass` uses grade+section-looking class names.

The same student-class scope is also used by `grade_same_end_hour`, so grade evaluators
cannot accidentally include technical rows in future datasets.

## Acceptance
The exact three first-test rule families are evaluated against the reference timetable:
- grade_same_end_hour for grade ד
- teacher_no_internal_gaps for teacher 10
- class_no_internal_gaps globally

Expected: all supported and valid on the current reference timetable.
