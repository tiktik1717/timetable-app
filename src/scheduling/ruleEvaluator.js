export function evaluateFormalRule({
  rule,
  schedule,
  schoolData,
}) {
  if (!rule?.formalRule) {
    return {
      supported: false,
      valid: null,
      violations: [],
    };
  }

  const formalRule = rule.formalRule;

  if (
    formalRule.scope === "teacher_day" &&
    formalRule.constraint === "no_internal_gaps"
  ) {
    return evaluateTeacherNoInternalGaps({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  return {
    supported: false,
    valid: null,
    violations: [],
  };
}
function evaluateTeacherNoInternalGaps({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const teacherId = String(
    formalRule.teacherId
  );

  const teachingUnits =
    schoolData?.teachingUnits || [];

  const violations = [];

  for (const [day, daySchedule] of Object.entries(
    schedule || {}
  )) {
    const teachingHours = [];

    for (const [
      className,
      classSchedule,
    ] of Object.entries(daySchedule || {})) {
      for (const [
        hourKey,
        cellValue,
      ] of Object.entries(classSchedule || {})) {
        const hour = Number(hourKey);

        const unitIds = Array.isArray(cellValue)
          ? cellValue
          : cellValue
            ? [cellValue]
            : [];

        const teacherIsHere = unitIds.some(
          (unitId) => {
            const unit = teachingUnits.find(
              (item) => item.id === unitId
            );

            if (!unit) {
              return false;
            }

            // ישיבות צוות אינן נחשבות כרגע
            // כשעת הוראה לצורך חוק החלונות.
            if (unit.type === "teamMeeting") {
              return false;
            }

            return (
              String(unit.teacherId) ===
              teacherId
            );
          }
        );

        if (teacherIsHere) {
          teachingHours.push(hour);
        }
      }
    }

    const uniqueHours = [
      ...new Set(teachingHours),
    ].sort((a, b) => a - b);

    if (uniqueHours.length <= 1) {
      continue;
    }

    const firstHour = uniqueHours[0];
    const lastHour =
      uniqueHours[uniqueHours.length - 1];

    const missingHours = [];

    for (
      let hour = firstHour;
      hour <= lastHour;
      hour += 1
    ) {
      if (!uniqueHours.includes(hour)) {
        missingHours.push(hour);
      }
    }

    if (missingHours.length > 0) {
      violations.push({
        day,
        teacherId,
        firstHour,
        lastHour,
        gapHours: missingHours,
      });
    }
  }

  return {
    supported: true,
    valid: violations.length === 0,
    violations,
    ruleId: rule.id,
  };
}