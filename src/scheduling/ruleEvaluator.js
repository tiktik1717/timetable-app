import { evaluateGenericRuleExpression } from "./genericRuleEngine.js";
export function evaluateFormalRule({
  rule,
  schedule,
  schoolData,
  baselineSchedule = null,
}) {
  if (!rule?.formalRule) {
    return {
      supported: false,
      valid: null,
      violations: [],
    };
  }

  const formalRule = rule.formalRule;

  if (formalRule?.version === 4 && formalRule?.expression) {
    return evaluateGenericRuleExpression({
      rule,
      expression: formalRule.expression,
      schedule,
      schoolData,
      baselineSchedule,
    });
  }

  if (
    formalRule?.version === 2 &&
    formalRule?.operator === "AND" &&
    Array.isArray(formalRule?.clauses)
  ) {
    const clauseResults = formalRule.clauses.map(
      (clause, index) => {
        const clauseRule = {
          ...rule,
          id: `${rule.id}::${clause.id || `c${index + 1}`}`,
          evaluatorKey:
            clause.evaluatorKey || "unsupported",
          formalRule: {
            version: 1,
            scope: clause.scope,
            constraint: clause.constraint,
            targets: clause.targets || {
              teacherIds: [],
              classNames: [],
              grades: [],
              constraintGroupIds: [],
            },
            params: clause.params || {
              days: [],
              hours: [],
              min: null,
              max: null,
              exact: null,
              count: null,
              value: null,
            },
            logic: clause.logic || "all",
            severity: formalRule.severity,
          },
        };

        const result = evaluateFormalRule({
          rule: clauseRule,
          schedule,
          schoolData,
          baselineSchedule,
        });

        return {
          clauseId:
            clause.id || `c${index + 1}`,
          evaluatorKey:
            clause.evaluatorKey || "unsupported",
          ...result,
        };
      }
    );

    const allSupported = clauseResults.every(
      (item) => item.supported
    );
    const allValid =
      allSupported &&
      clauseResults.every((item) => item.valid);

    return {
      supported: allSupported,
      valid: allSupported ? allValid : null,
      violations: clauseResults.flatMap(
        (item) =>
          (item.violations || []).map((violation) => ({
            ...violation,
            clauseId: item.clauseId,
            evaluatorKey: item.evaluatorKey,
          }))
      ),
      clauseResults,
      ruleId: rule.id,
    };
  }

  if (formalRule?.expression) {
    return evaluateGenericRuleExpression({
      rule,
      expression: formalRule.expression,
      schedule,
      schoolData,
      baselineSchedule,
    });
  }

  const evaluatorKey =
    rule.evaluatorKey ||
    inferLegacyEvaluatorKey(formalRule);

  if (evaluatorKey === "teacher_no_internal_gaps") {
    return evaluateTeacherNoInternalGaps({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "class_no_internal_gaps") {
    return evaluateClassNoInternalGaps({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "grade_same_end_hour") {
    return evaluateGradeSameEndHour({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "grade_exact_end_hour") {
    return evaluateGradeExactEndHour({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "homeroom_first_hours") {
    return evaluateHomeroomFirstHours({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (
    evaluatorKey ===
    "non_homeroom_max_hours_same_class_day"
  ) {
    return evaluateNonHomeroomMaxHoursSameClassDay({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "teacher_allowed_days") {
    return evaluateTeacherAllowedDays({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "teacher_blocked_hours") {
    return evaluateTeacherBlockedHours({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "grade_end_hour_cardinality") {
    return evaluateGradeEndHourCardinality({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "teacher_free_day_cardinality") {
    return evaluateTeacherFreeDayCardinality({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "teacher_day_load_cardinality") {
    return evaluateTeacherDayLoadCardinality({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "teacher_exact_day_load") {
    return evaluateTeacherExactDayLoad({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "teacher_max_consecutive_class_hours") {
    return evaluateTeacherMaxConsecutiveClassHours({
      rule,
      formalRule,
      schedule,
      schoolData,
    });
  }

  if (evaluatorKey === "unique_simultaneous_group_type") {
    return evaluateUniqueSimultaneousGroupType({
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
    ruleId: rule.id,
  };
}

function inferLegacyEvaluatorKey(formalRule) {
  if (
    formalRule?.scope === "teacher_day" &&
    formalRule?.constraint === "no_internal_gaps"
  ) {
    return "teacher_no_internal_gaps";
  }
  return "unsupported";
}

function normalizeDay(day) {
  const value = String(day ?? "").trim();
  const aliases = {
    "א": "א",
    "ראשון": "א",
    "יום ראשון": "א",
    "ב": "ב",
    "שני": "ב",
    "יום שני": "ב",
    "ג": "ג",
    "שלישי": "ג",
    "יום שלישי": "ג",
    "ד": "ד",
    "רביעי": "ד",
    "יום רביעי": "ד",
    "ה": "ה",
    "חמישי": "ה",
    "יום חמישי": "ה",
    "ו": "ו",
    "שישי": "ו",
    "יום שישי": "ו",
  };
  return aliases[value] || value;
}

function targetTeacherIds(formalRule) {
  const ids = formalRule?.targets?.teacherIds;
  if (Array.isArray(ids) && ids.length > 0) {
    return ids.map(String);
  }
  if (formalRule?.teacherId != null) {
    return [String(formalRule.teacherId)];
  }
  return [];
}

function getCellUnitIds(cellValue) {
  if (Array.isArray(cellValue)) return cellValue;
  return cellValue ? [cellValue] : [];
}

function getStudentClassNames(schoolData) {
  // In the current metadata, schoolData.classes also contains technical
  // scheduling rows (staff meetings, pedagogical guidance, etc.).
  // A real student class is reliably grounded by a homeroom teacher's
  // educationClass field. Prefer that explicit relationship.
  const fromHomeroomTeachers = [
    ...new Set(
      (schoolData?.teachers || [])
        .map((teacher) => teacher?.educationClass)
        .filter(Boolean)
        .map(String)
    ),
  ];

  if (fromHomeroomTeachers.length > 0) {
    return fromHomeroomTeachers;
  }

  // Defensive fallback for datasets that do not carry educationClass:
  // use class names that look like a grade+section code, while excluding
  // obvious technical schedule rows.
  return (schoolData?.classes || [])
    .map((item) =>
      typeof item === "string"
        ? item
        : item?.name || item?.className || item?.id
    )
    .filter(Boolean)
    .map(String)
    .filter((name) =>
      /^[^\d\s]+\d+$/.test(name)
    );
}

function getTeacherIdsAtCell({
  cellValue,
  teachingUnits,
}) {
  return getCellUnitIds(cellValue)
    .map((unitId) =>
      teachingUnits.find((item) => item.id === unitId)
    )
    .filter(Boolean)
    .filter((unit) => unit.type !== "teamMeeting")
    .map((unit) => String(unit.teacherId));
}

function evaluateTeacherNoInternalGaps({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const teacherIds = targetTeacherIds(formalRule);
  if (teacherIds.length !== 1) {
    return {
      supported: false,
      valid: null,
      violations: [],
      ruleId: rule.id,
      reason: "teacher_no_internal_gaps requires exactly one teacher target",
    };
  }

  const teacherId = teacherIds[0];

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


function evaluateClassNoInternalGaps({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const explicitClasses =
    formalRule?.targets?.classNames || [];
  const studentClasses =
    getStudentClassNames(schoolData);

  const classNames =
    explicitClasses.length > 0
      ? explicitClasses
      : studentClasses;

  const violations = [];

  for (const day of Object.keys(schedule || {})) {
    for (const className of classNames) {
      const hoursMap =
        schedule?.[day]?.[className] || {};

      const occupiedHours = Object.entries(hoursMap)
        .filter(([, cell]) =>
          getCellUnitIds(cell).length > 0
        )
        .map(([hour]) => Number(hour))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

      if (occupiedHours.length === 0) continue;

      const firstHour = occupiedHours[0];
      const lastHour =
        occupiedHours[occupiedHours.length - 1];

      const requireFromFirstHour =
        formalRule?.constraint ===
        "no_gaps_from_first_hour";

      const scanStartHour =
        requireFromFirstHour ? 1 : firstHour;

      const missingHours = [];
      for (
        let hour = scanStartHour;
        hour <= lastHour;
        hour += 1
      ) {
        if (!occupiedHours.includes(hour)) {
          missingHours.push(hour);
        }
      }

      if (missingHours.length > 0) {
        violations.push({
          day,
          className,
          firstHour,
          lastHour,
          gapHours: missingHours,
          constraint: formalRule?.constraint,
        });
      }
    }
  }

  return {
    supported: true,
    valid: violations.length === 0,
    violations,
    ruleId: rule.id,
  };
}

function classGrade(className) {
  const text = String(className || "").trim();
  if (!text) return "";
  const match = text.match(/^([^\d\s]+)/);
  return match ? match[1] : text.charAt(0);
}

function evaluateGradeSameEndHour({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const grades =
    formalRule?.targets?.grades || [];

  if (grades.length === 0) {
    return {
      supported: false,
      valid: null,
      violations: [],
      ruleId: rule.id,
      reason: "grade_same_end_hour requires at least one grade target",
    };
  }

  const studentClasses =
    getStudentClassNames(schoolData);

  const violations = [];

  for (const grade of grades) {
    const gradeClasses =
      studentClasses.filter(
        (className) =>
          classGrade(className) === String(grade)
      );

    for (const day of Object.keys(schedule || {})) {
      const endHours = gradeClasses.map((className) => {
        const hoursMap =
          schedule?.[day]?.[className] || {};
        const occupied = Object.entries(hoursMap)
          .filter(([, cell]) =>
            getCellUnitIds(cell).length > 0
          )
          .map(([hour]) => Number(hour))
          .filter(Number.isFinite);
        return {
          className,
          endHour:
            occupied.length > 0
              ? Math.max(...occupied)
              : 0,
        };
      });

      const uniqueEndHours = [
        ...new Set(
          endHours.map((item) => item.endHour)
        ),
      ];

      if (uniqueEndHours.length > 1) {
        violations.push({
          day,
          grade: String(grade),
          classEndHours: endHours,
        });
      }
    }
  }

  return {
    supported: true,
    valid: violations.length === 0,
    violations,
    ruleId: rule.id,
  };
}


function evaluateGradeExactEndHour({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const grades =
    formalRule?.targets?.grades || [];
  const days =
    (formalRule?.params?.days || []).map(normalizeDay);
  const exactHour =
    Number(formalRule?.params?.exact);

  if (
    grades.length === 0 ||
    days.length === 0 ||
    !Number.isFinite(exactHour)
  ) {
    return {
      supported: false,
      valid: null,
      violations: [],
      ruleId: rule.id,
      reason: "grade_exact_end_hour requires grades, days and params.exact",
    };
  }

  const studentClasses =
    getStudentClassNames(schoolData);
  const violations = [];

  for (const grade of grades) {
    const gradeClasses = studentClasses.filter(
      (className) =>
        classGrade(className) === String(grade)
    );

    for (const dayRaw of days) {
      const day = normalizeDay(dayRaw);

      for (const className of gradeClasses) {
        const hoursMap =
          schedule?.[day]?.[className] || {};
        const occupied = Object.entries(hoursMap)
          .filter(([, cell]) =>
            getCellUnitIds(cell).length > 0
          )
          .map(([hour]) => Number(hour))
          .filter(Number.isFinite);

        const endHour =
          occupied.length > 0
            ? Math.max(...occupied)
            : 0;

        if (endHour !== exactHour) {
          violations.push({
            day,
            grade: String(grade),
            className,
            endHour,
            expectedEndHour: exactHour,
          });
        }
      }
    }
  }

  return {
    supported: true,
    valid: violations.length === 0,
    violations,
    ruleId: rule.id,
  };
}

function getHomeroomTeacherByClass(schoolData) {
  const mapping = new Map();

  for (const teacher of schoolData?.teachers || []) {
    if (!teacher?.educationClass) continue;
    mapping.set(
      String(teacher.educationClass),
      String(teacher.id)
    );
  }

  return mapping;
}

function cellContainsTeacher({
  cell,
  teacherId,
  schoolData,
}) {
  const teachingUnits =
    schoolData?.teachingUnits || [];

  return getCellUnitIds(cell).some((unitId) => {
    const unit = teachingUnits.find(
      (item) => item.id === unitId
    );

    return (
      unit &&
      String(unit.teacherId) ===
        String(teacherId)
    );
  });
}

function evaluateHomeroomFirstHours({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const requestedClasses =
    formalRule?.targets?.classNames || [];
  const classNames =
    requestedClasses.length > 0
      ? requestedClasses
      : getStudentClassNames(schoolData);

  const days =
    (formalRule?.params?.days || []).map(normalizeDay);
  const count =
    Number(formalRule?.params?.count);

  if (
    classNames.length === 0 ||
    days.length === 0 ||
    !Number.isFinite(count) ||
    count < 1
  ) {
    return {
      supported: false,
      valid: null,
      violations: [],
      ruleId: rule.id,
      reason: "homeroom_first_hours requires classes, days and params.count",
    };
  }

  const homeroomByClass =
    getHomeroomTeacherByClass(schoolData);
  const violations = [];

  for (const className of classNames) {
    const teacherId =
      homeroomByClass.get(String(className));

    if (!teacherId) {
      violations.push({
        className,
        teacherId: null,
        reason: "missing_homeroom_teacher",
      });
      continue;
    }

    for (const day of days) {
      for (let hour = 1; hour <= count; hour += 1) {
        const cell =
          schedule?.[day]?.[className]?.[
            String(hour)
          ] || [];

        if (
          !cellContainsTeacher({
            cell,
            teacherId,
            schoolData,
          })
        ) {
          violations.push({
            day,
            hour,
            className,
            teacherId,
            expected: "homeroom_teacher_in_own_class",
          });
        }
      }
    }
  }

  return {
    supported: true,
    valid: violations.length === 0,
    violations,
    ruleId: rule.id,
  };
}

function evaluateNonHomeroomMaxHoursSameClassDay({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const maxHours =
    Number(formalRule?.params?.max);

  if (!Number.isFinite(maxHours)) {
    return {
      supported: false,
      valid: null,
      violations: [],
      ruleId: rule.id,
      reason: "non_homeroom_max_hours_same_class_day requires params.max",
    };
  }

  const requestedClasses =
    formalRule?.targets?.classNames || [];
  const classNames =
    requestedClasses.length > 0
      ? requestedClasses
      : getStudentClassNames(schoolData);

  const homeroomByClass =
    getHomeroomTeacherByClass(schoolData);
  const teachingUnits =
    schoolData?.teachingUnits || [];
  const unitsById = new Map(
    teachingUnits.map((unit) => [
      unit.id,
      unit,
    ])
  );

  const violations = [];

  for (const day of Object.keys(schedule || {})) {
    for (const className of classNames) {
      const hoursMap =
        schedule?.[day]?.[className] || {};
      const counts = new Map();

      for (const cell of Object.values(hoursMap)) {
        const teacherIds = [
          ...new Set(
            getCellUnitIds(cell)
              .map((unitId) =>
                unitsById.get(unitId)
              )
              .filter(Boolean)
              .filter(
                (unit) =>
                  unit.type !== "teamMeeting"
              )
              .map((unit) =>
                String(unit.teacherId)
              )
          ),
        ];

        for (const teacherId of teacherIds) {
          counts.set(
            teacherId,
            (counts.get(teacherId) || 0) + 1
          );
        }
      }

      const homeroomTeacherId =
        homeroomByClass.get(String(className));

      for (const [teacherId, hours] of counts) {
        if (
          homeroomTeacherId &&
          String(teacherId) ===
            String(homeroomTeacherId)
        ) {
          continue;
        }

        if (hours > maxHours) {
          violations.push({
            day,
            className,
            teacherId,
            hours,
            maxHours,
          });
        }
      }
    }
  }

  return {
    supported: true,
    valid: violations.length === 0,
    violations,
    ruleId: rule.id,
  };
}

function getTeacherPlacements({
  teacherId,
  schedule,
  schoolData,
}) {
  const teachingUnits =
    schoolData?.teachingUnits || [];
  const placements = [];

  for (const [day, classes] of Object.entries(
    schedule || {}
  )) {
    for (const [
      className,
      hoursMap,
    ] of Object.entries(classes || {})) {
      for (const [
        hourKey,
        cell,
      ] of Object.entries(hoursMap || {})) {
        const teacherIds = getTeacherIdsAtCell({
          cellValue: cell,
          teachingUnits,
        });

        if (teacherIds.includes(String(teacherId))) {
          placements.push({
            day,
            hour: Number(hourKey),
            className,
          });
        }
      }
    }
  }

  return placements;
}

function evaluateTeacherAllowedDays({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const teacherIds =
    targetTeacherIds(formalRule);
  const allowedDays =
    (formalRule?.params?.days || []).map(normalizeDay);

  if (
    teacherIds.length === 0 ||
    allowedDays.length === 0
  ) {
    return {
      supported: false,
      valid: null,
      violations: [],
      ruleId: rule.id,
      reason: "teacher_allowed_days requires teacherIds and params.days",
    };
  }

  const violations = [];

  for (const teacherId of teacherIds) {
    for (const placement of getTeacherPlacements({
      teacherId,
      schedule,
      schoolData,
    })) {
      if (!allowedDays.includes(normalizeDay(placement.day))) {
        violations.push({
          teacherId,
          ...placement,
          allowedDays,
        });
      }
    }
  }

  return {
    supported: true,
    valid: violations.length === 0,
    violations,
    ruleId: rule.id,
  };
}

function evaluateTeacherBlockedHours({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const teacherIds =
    targetTeacherIds(formalRule);
  const days =
    (formalRule?.params?.days || []).map(normalizeDay);
  const hours =
    (formalRule?.params?.hours || []).map(Number);

  if (
    teacherIds.length === 0 ||
    hours.length === 0
  ) {
    return {
      supported: false,
      valid: null,
      violations: [],
      ruleId: rule.id,
      reason: "teacher_blocked_hours requires teacherIds, days and hours",
    };
  }

  const violations = [];

  for (const teacherId of teacherIds) {
    for (const placement of getTeacherPlacements({
      teacherId,
      schedule,
      schoolData,
    })) {
      if (
        (days.length === 0 ||
          days.includes(normalizeDay(placement.day))) &&
        hours.includes(Number(placement.hour))
      ) {
        violations.push({
          teacherId,
          ...placement,
          blockedDays: days,
          blockedHours: hours,
        });
      }
    }
  }

  return {
    supported: true,
    valid: violations.length === 0,
    violations,
    ruleId: rule.id,
  };
}


function getClassEndHour(schedule, day, className) {
  const hoursMap = schedule?.[day]?.[className] || {};
  const occupied = Object.entries(hoursMap)
    .filter(([, cell]) => getCellUnitIds(cell).length > 0)
    .map(([hour]) => Number(hour))
    .filter(Number.isFinite);
  return occupied.length ? Math.max(...occupied) : 0;
}

function teacherTeachingHoursForDay({
  teacherId,
  day,
  schedule,
  schoolData,
  excludeTypes = ["teamMeeting"],
}) {
  const excluded = new Set((excludeTypes || []).map(String));
  const unitsById = new Map(
    (schoolData?.teachingUnits || []).map((unit) => [
      String(unit.id),
      unit,
    ])
  );
  const hours = new Set();

  for (const hoursMap of Object.values(schedule?.[day] || {})) {
    for (const [hourKey, cell] of Object.entries(hoursMap || {})) {
      const isTeaching = getCellUnitIds(cell).some((unitId) => {
        const unit = unitsById.get(String(unitId));
        return (
          unit &&
          String(unit.teacherId) === String(teacherId) &&
          !excluded.has(String(unit.type || ""))
        );
      });
      if (isTeaching) hours.add(Number(hourKey));
    }
  }

  return [...hours].filter(Number.isFinite).sort((a, b) => a - b);
}

function isConsecutiveFrom(hours, startHour, count) {
  if (hours.length !== count) return false;
  for (let i = 0; i < count; i += 1) {
    if (hours[i] !== startHour + i) return false;
  }
  return true;
}

function evaluateGradeEndHourCardinality({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const grades = formalRule?.targets?.grades || [];
  const days = (formalRule?.params?.days || []).map(normalizeDay);
  const exactDays = Number(formalRule?.params?.count);
  const selectedEndHour = Number(formalRule?.params?.exact);
  const remainingEndHour = Number(formalRule?.params?.value);

  if (
    grades.length === 0 ||
    days.length === 0 ||
    !Number.isFinite(exactDays) ||
    !Number.isFinite(selectedEndHour) ||
    !Number.isFinite(remainingEndHour)
  ) {
    return {
      supported: false, valid: null, violations: [], ruleId: rule.id,
      reason: "grade_end_hour_cardinality requires grades, days, count, exact and value",
    };
  }

  const studentClasses = getStudentClassNames(schoolData);
  const dayStates = days.map((day) => {
    const details = [];
    let selected = true;
    let remaining = true;

    for (const grade of grades) {
      const classes = studentClasses.filter(
        (className) => classGrade(className) === String(grade)
      );
      for (const className of classes) {
        const endHour = getClassEndHour(schedule, day, className);
        details.push({ grade: String(grade), className, endHour });
        if (endHour !== selectedEndHour) selected = false;
        if (endHour !== remainingEndHour) remaining = false;
      }
    }
    return { day, selected, remaining, details };
  });

  const selectedDays = dayStates.filter((item) => item.selected);
  const invalidDays = dayStates.filter(
    (item) => !item.selected && !item.remaining
  );

  const valid =
    selectedDays.length === exactDays &&
    invalidDays.length === 0;

  return {
    supported: true,
    valid,
    violations: valid
      ? []
      : [{
          days,
          grades: grades.map(String),
          requiredSelectedDays: exactDays,
          selectedEndHour,
          remainingEndHour,
          actualSelectedDays: selectedDays.map((item) => item.day),
          invalidDays,
          dayStates,
        }],
    ruleId: rule.id,
  };
}

function evaluateTeacherFreeDayCardinality({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const teacherIds = targetTeacherIds(formalRule);
  const days = (formalRule?.params?.days || []).map(normalizeDay);
  const exact = Number(formalRule?.params?.count ?? formalRule?.params?.exact);

  if (teacherIds.length !== 1 || days.length === 0 || !Number.isFinite(exact)) {
    return {
      supported: false, valid: null, violations: [], ruleId: rule.id,
      reason: "teacher_free_day_cardinality requires one teacher, days and count",
    };
  }

  const teacherId = teacherIds[0];
  const freeDays = days.filter(
    (day) =>
      teacherTeachingHoursForDay({
        teacherId, day, schedule, schoolData, excludeTypes: [],
      }).length === 0
  );
  const valid = freeDays.length === exact;

  return {
    supported: true,
    valid,
    violations: valid ? [] : [{
      teacherId,
      candidateDays: days,
      requiredFreeDayCount: exact,
      actualFreeDays: freeDays,
    }],
    ruleId: rule.id,
  };
}

function evaluateTeacherExactDayLoad({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const teacherIds = targetTeacherIds(formalRule);
  const days = (formalRule?.params?.days || []).map(normalizeDay);
  const exactHours = Number(formalRule?.params?.exact);
  const startHour = Number(formalRule?.params?.value ?? 1);

  if (
    teacherIds.length !== 1 ||
    days.length === 0 ||
    !Number.isFinite(exactHours)
  ) {
    return {
      supported: false, valid: null, violations: [], ruleId: rule.id,
      reason: "teacher_exact_day_load requires one teacher, days and exact",
    };
  }

  const teacherId = teacherIds[0];
  const violations = [];
  for (const day of days) {
    const hours = teacherTeachingHoursForDay({
      teacherId, day, schedule, schoolData,
    });
    if (!isConsecutiveFrom(hours, startHour, exactHours)) {
      violations.push({
        teacherId, day, hours,
        expectedHours: exactHours,
        expectedStartHour: startHour,
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

function evaluateTeacherDayLoadCardinality({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const teacherIds = targetTeacherIds(formalRule);
  const days = (formalRule?.params?.days || []).map(normalizeDay);
  const exactDays = Number(formalRule?.params?.count);
  const exactHours = Number(formalRule?.params?.exact);
  const startHour = Number(formalRule?.params?.value ?? 1);

  if (
    teacherIds.length !== 1 ||
    days.length === 0 ||
    !Number.isFinite(exactDays) ||
    !Number.isFinite(exactHours)
  ) {
    return {
      supported: false, valid: null, violations: [], ruleId: rule.id,
      reason: "teacher_day_load_cardinality requires one teacher, days, count and exact",
    };
  }

  const teacherId = teacherIds[0];
  const states = days.map((day) => {
    const hours = teacherTeachingHoursForDay({
      teacherId, day, schedule, schoolData,
    });
    return {
      day,
      hours,
      matches: isConsecutiveFrom(hours, startHour, exactHours),
    };
  });
  const matching = states.filter((item) => item.matches);
  const valid = matching.length === exactDays;

  return {
    supported: true,
    valid,
    violations: valid ? [] : [{
      teacherId,
      candidateDays: days,
      requiredDayCount: exactDays,
      exactHours,
      startHour,
      actualMatchingDays: matching.map((item) => item.day),
      states,
    }],
    ruleId: rule.id,
  };
}

function evaluateTeacherMaxConsecutiveClassHours({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const max = Number(formalRule?.params?.max);
  if (!Number.isFinite(max)) {
    return {
      supported: false, valid: null, violations: [], ruleId: rule.id,
      reason: "teacher_max_consecutive_class_hours requires params.max",
    };
  }

  const unitsById = new Map(
    (schoolData?.teachingUnits || []).map((unit) => [
      String(unit.id), unit,
    ])
  );
  const requestedTeacherIds = targetTeacherIds(formalRule);
  const teacherIds =
    requestedTeacherIds.length > 0
      ? requestedTeacherIds
      : (schoolData?.teachers || []).map((t) => String(t.id));

  const violations = [];
  for (const teacherId of teacherIds) {
    for (const day of Object.keys(schedule || {})) {
      const hours = teacherTeachingHoursForDay({
        teacherId,
        day,
        schedule,
        schoolData,
        excludeTypes: ["teamMeeting"],
      });
      let run = [];
      for (const hour of hours) {
        if (!run.length || hour === run[run.length - 1] + 1) {
          run.push(hour);
        } else {
          run = [hour];
        }
        if (run.length > max) {
          violations.push({
            teacherId, day,
            consecutiveHours: [...run],
            maxAllowed: max,
          });
          break;
        }
      }
    }
  }

  return {
    supported: true,
    valid: violations.length === 0,
    violations,
    ruleId: rule.id,
  };
}

function evaluateUniqueSimultaneousGroupType({
  rule,
  formalRule,
  schedule,
  schoolData,
}) {
  const groupIds = new Set(
    (formalRule?.targets?.constraintGroupIds || []).map(String)
  );
  if (groupIds.size < 2) {
    return {
      supported: false, valid: null, violations: [], ruleId: rule.id,
      reason: "unique_simultaneous_group_type requires at least two constraintGroupIds",
    };
  }

  const unitsById = new Map(
    (schoolData?.teachingUnits || []).map((unit) => [
      String(unit.id), unit,
    ])
  );
  const violations = [];

  for (const [day, classes] of Object.entries(schedule || {})) {
    const byHour = new Map();
    for (const hoursMap of Object.values(classes || {})) {
      for (const [hour, cell] of Object.entries(hoursMap || {})) {
        for (const unitId of getCellUnitIds(cell)) {
          const unit = unitsById.get(String(unitId));
          const groupId = unit?.constraintGroupId;
          if (!groupId || !groupIds.has(String(groupId))) continue;
          if (!byHour.has(hour)) byHour.set(hour, new Set());
          byHour.get(hour).add(String(groupId));
        }
      }
    }
    for (const [hour, activeGroups] of byHour) {
      if (activeGroups.size > 1) {
        violations.push({
          day,
          hour: Number(hour),
          constraintGroupIds: [...activeGroups],
          maxSimultaneousGroups: 1,
        });
      }
    }
  }

  return {
    supported: true,
    valid: violations.length === 0,
    violations,
    ruleId: rule.id,
  };
}

/**
 * Evaluate every currently formalized rule against a schedule.
 * Unsupported formal rules are returned explicitly rather than silently ignored.
 * This gives the Agent/Validator pipeline one deterministic entry point for
 * formal super-rules while the rule language is still evolving.
 */
export function evaluateFormalRules({
  rules = [],
  schedule,
  schoolData,
  baselineSchedule = null,
}) {
  return (rules || [])
    .filter((rule) => rule?.formalRule)
    .map((rule) => {
      const result = evaluateFormalRule({
        rule,
        schedule,
        schoolData,
        baselineSchedule,
      });

      return {
        ruleId: rule.id,
        originalText: rule.originalText || "",
        interpretation: rule.interpretation || "",
        ...result,
      };
    });
}

/**
 * Convert deterministic evaluator results to the same shape used by the
 * Scheduling Agent ruleCheckResults contract.
 */
export function formalRuleEvaluationsToRuleCheckResults(
  evaluations = [],
) {
  return evaluations.map((result) => {
    if (!result.supported) {
      return {
        ruleId: result.ruleId,
        status: "unknown",
        summary: "החוק פורמלי אך עדיין אין evaluator דטרמיניסטי שתומך בו.",
        violations: [],
        source: "formal-rule-evaluator",
      };
    }

    if (result.objective) {
      return {
        ruleId: result.ruleId,
        status: "objective_measured",
        summary:
          `${result.direction === "maximize" ? "יעד מקסום" : "יעד מזעור"} נמדד: ${result.objectiveValue}.`,
        violations: [],
        objective: true,
        direction: result.direction,
        objectiveValue: result.objectiveValue,
        measurements: result.measurements || [],
        source: "formal-rule-evaluator",
      };
    }

    return {
      ruleId: result.ruleId,
      status: result.valid ? "satisfied" : "violated",
      summary: result.valid
        ? "החוק מתקיים לפי הבדיקה הדטרמיניסטית."
        : `נמצאו ${result.violations?.length || 0} הפרות בבדיקה הדטרמיניסטית.`,
      violations: (result.violations || []).map((violation) => ({
        day: violation.day ?? null,
        hours: violation.gapHours || violation.hours || [],
        entityId:
          violation.teacherId ||
          violation.className ||
          violation.entityId ||
          null,
        explanation: JSON.stringify(violation),
        detailsJson: JSON.stringify(violation),
      })),
      source: "formal-rule-evaluator",
    };
  });
}
