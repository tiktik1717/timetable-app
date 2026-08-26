# Generic Rule Engine v1.1 / Rule Compiler v4.1

Changes driven by the 17-rule regression run:

- Student-class scope is now grounded from teachers.educationClass, with a grade+section fallback. Technical rows such as meetings/guidance are excluded from student_classes.
- Added virtual sources class_days, grade_days and teacher_days, including zero-placement days.
- Added relational placement field isHomeroomForClass.
- Added constraintGroupName.
- Added generic operators contains / starts_with.
- Added aggregate metrics all_equal and count_where.
- class_end_hour supports assert.op=all_equal.
- Compiler guidance explicitly prevents compiling same-end-hour as eq 1.
- Compiler guidance uses count_distinct(constraintGroupId) for simultaneous constraint groups.
- Compiler can express exact free-day cardinality and day-load distributions through teacher_days + count_where.
- Compiler can express non-homeroom limits without a dedicated evaluator.
- grade_days supports cross-grade day-pattern rules such as rule 9.

Regression target: recompile unchanged rules 1-17. Expected improvements include rules 1/4 correct same-end-hour semantics; 3/8/9/10/11 formalizable; 13 distinct-group counting; 15 only real student classes. Rule 12 should be formalized when meeting entities can be resolved from ENTITIES; otherwise clarification remains appropriate only if the dataset truly cannot identify meetings.
