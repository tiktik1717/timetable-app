# v5.8 — Generic time-position rules

Adds generic placement metadata rather than a special evaluator for each wording.

For every placement: `hour`, `teacherTeachingSlotIndex`, `teacherTeachingSlotFromEnd`, `isTeacherFirstTeachingSlot`, `isTeacherLastTeachingSlot`, `teacherStartHour`, `teacherEndHour`, plus equivalent class fields.

This distinguishes absolute hour 2 from the teacher's second lesson, and the teacher's last lesson from the class's last lesson.

Rule 22 can use the first actual placement on each working day and `isHomeroomForClass=true`; non-working days create no penalty. Higher weighting for teacher 33 remains semantic until weighted preferences are supported.
