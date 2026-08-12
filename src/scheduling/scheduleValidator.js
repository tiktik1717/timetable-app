// src/scheduling/scheduleValidator.js

import {
  getCellUnitIds,
  getUnitById,
  getTeacherById,
  getConstraintGroupById,
  countScheduledUnitHours,
  isTeacherFreeDay,
  isTeacherBlockedHour,
  isHourInsideClassDay,
} from "./scheduleUtils";

/**
 * מנרמל שם יום.
 * כרגע רוב הנתונים כבר משתמשים ב:
 * א, ב, ג, ד, ה, ו
 *
 * השארנו פונקציה נפרדת כדי שבעתיד נוכל
 * לתמוך גם בפורמטים אחרים בלי לשנות את ה-validator.
 */
function normalizeDay(day) {
  return String(day || "").trim();
}

/**
 * בודק האם קבוצת שיבוץ חסומה בזמן מסוים.
 */
function isConstraintGroupBlockedAt(constraintGroups, groupId, day, hour) {
  if (!groupId) {
    return false;
  }

  const group = getConstraintGroupById(constraintGroups, groupId);

  if (!group) {
    return false;
  }

  const blockedHoursForDay = group.blockedSlots?.[normalizeDay(day)] || [];

  return blockedHoursForDay.map(Number).includes(Number(hour));
}

/**
 * יוצר אובייקט שגיאה אחיד.
 */
function createIssue({
  type,
  severity = "error",
  message,
  day = null,
  hour = null,
  className = null,
  teacherId = null,
  unitId = null,
  groupId = null,
  details = null,
}) {
  return {
    type,
    severity,
    message,
    day,
    hour,
    className,
    teacherId,
    unitId,
    groupId,
    details,
  };
}

/**
 * בודק מערכת שעות מלאה.
 *
 * הפונקציה אינה משנה שום נתון.
 *
 * היא מחזירה:
 *
 * {
 *   valid: true/false,
 *   errors: [],
 *   warnings: [],
 *   statistics: {...}
 * }
 */

function groupHasSameTimeRule(group) {
  if (!group) {
    return false;
  }

  const rules = Array.isArray(group.rules) ? group.rules : [];

  return rules.some((rule) => {
    if (typeof rule === "string") {
      return rule === "sameTime";
    }

    return rule?.type === "sameTime";
  });
}

function groupHasRule(group, ruleType) {
  if (!group) {
    return false;
  }

  const rules = Array.isArray(group.rules) ? group.rules : [];

  return rules.some((rule) => {
    if (typeof rule === "string") {
      return rule === ruleType;
    }

    return rule?.type === ruleType;
  });
}

function getMeetingById(meetings, meetingId) {
  if (!meetingId || !Array.isArray(meetings)) {
    return null;
  }

  return meetings.find((meeting) => meeting.id === meetingId) || null;
}

function isMeetingParticipantExceptionApproved(
  approvedExceptions,
  meetingId,
  teacherId,
) {
  return approvedExceptions.some(
    (exception) =>
      exception?.type === "meetingParticipant" &&
      exception?.meetingId === meetingId &&
      String(exception?.teacherId) === String(teacherId),
  );
}

function getExpectedMeetingUnits(meeting, teachingUnits, approvedExceptions) {
  return teachingUnits.filter((unit) => {
    if (unit.type !== "teamMeeting" || unit.constraintGroupId !== meeting.id) {
      return false;
    }

    const isApprovedException = isMeetingParticipantExceptionApproved(
      approvedExceptions,
      meeting.id,
      unit.teacherId,
    );

    return !isApprovedException;
  });
}

function isMeetingDayAllowed(meeting, day) {
  const allowedDays = Array.isArray(meeting?.allowedDays)
    ? meeting.allowedDays
    : [];

  // מערך ריק = אין הגבלה
  if (allowedDays.length === 0) {
    return true;
  }

  return allowedDays.includes(day);
}

function isMeetingHourAllowed(meeting, hour) {
  const allowedHours = Array.isArray(meeting?.allowedHours)
    ? meeting.allowedHours
    : [];

  // מערך ריק = אין הגבלה
  if (allowedHours.length === 0) {
    return true;
  }

  return allowedHours.map(Number).includes(Number(hour));
}

export function validateSchedule({
  schedule,
  schoolData,
  approvedExceptions = [],
}) {
  const errors = [];
  const warnings = [];

  const teachers = schoolData?.teachers || [];

  const meetings = schoolData?.meetings || [];

  const teachingUnits = schoolData?.teachingUnits || [];

  const constraintGroups = schoolData?.constraintGroups || [];

  const dailyHoursByClass = schoolData?.dailyHoursByClass || {};

  const teacherById = new Map(
    teachers.map((teacher) => [String(teacher.id), teacher]),
  );

  const unitById = new Map(teachingUnits.map((unit) => [unit.id, unit]));

  /**
   * --------------------------------------------------
   * 1. מעבר על כל התאים הקיימים ב-schedule
   * --------------------------------------------------
   */

  const teacherPlacementsByTime = new Map();

  for (const [day, daySchedule] of Object.entries(schedule || {})) {
    if (!daySchedule || typeof daySchedule !== "object") {
      continue;
    }

    for (const [className, classSchedule] of Object.entries(daySchedule)) {
      if (!classSchedule || typeof classSchedule !== "object") {
        continue;
      }

      for (const [hourKey] of Object.entries(classSchedule)) {
        const hour = Number(hourKey);

        const unitIds = getCellUnitIds(schedule, day, className, hour);

        if (unitIds.length === 0) {
          continue;
        }

        /**
         * ------------------------------------------
         * 1A. שעה מחוץ ליום הלימודים של הכיתה
         * ------------------------------------------
         *
         * לישיבות צוות לא נשתמש בבדיקת
         * dailyHoursByClass באותו אופן.
         */

        const unitsInCell = unitIds
          .map((unitId) => getUnitById(teachingUnits, unitId))
          .filter(Boolean);

        const isMeetingCell =
          unitsInCell.length > 0 &&
          unitsInCell.every((unit) => unit.type === "teamMeeting");

        const hasKnownUnits = unitsInCell.length > 0;

        if (
          hasKnownUnits &&
          !isMeetingCell &&
          !isHourInsideClassDay(dailyHoursByClass, className, day, hour)
        ) {
          errors.push(
            createIssue({
              type: "outsideClassHours",
              message: `שיבוץ בכיתה ${className} ביום ${day} שעה ${hour} נמצא אחרי שעות הלימוד של הכיתה.`,
              day,
              hour,
              className,
            }),
          );
        }

        /**
         * ------------------------------------------
         * 1B. בדיקת כל יחידה בתא
         * ------------------------------------------
         */

        for (const unitId of unitIds) {
          const unit = unitById.get(unitId);

          if (!unit) {
            errors.push(
              createIssue({
                type: "unknownUnit",
                message: `בתא ${className}, יום ${day}, שעה ${hour} מופיע unitId שאינו קיים: ${unitId}`,
                day,
                hour,
                className,
                unitId,
              }),
            );

            continue;
          }

          /**
           * היחידה משובצת בשורה שאינה שייכת לה.
           */

          if (unit.className !== className) {
            errors.push(
              createIssue({
                type: "wrongClass",
                message: `היחידה ${unit.id} שייכת ל-${unit.className} אך שובצה בשורה ${className}.`,
                day,
                hour,
                className,
                teacherId: unit.teacherId,
                unitId: unit.id,
              }),
            );
          }

          /**
           * המורה קיים?
           */

          const teacher = teacherById.get(String(unit.teacherId));

          if (!teacher) {
            errors.push(
              createIssue({
                type: "unknownTeacher",
                message: `יחידת ההוראה ${unit.id} מפנה למורה שאינו קיים: ${unit.teacherId}`,
                day,
                hour,
                className,
                teacherId: unit.teacherId,
                unitId: unit.id,
              }),
            );

            continue;
          }

          /**
           * יום חופשי.
           */

          if (isTeacherFreeDay(teachers, unit.teacherId, day)) {
            errors.push(
              createIssue({
                type: "teacherFreeDay",
                message: `${teacher.name} שובץ/ה ביום החופשי (${day}).`,
                day,
                hour,
                className,
                teacherId: unit.teacherId,
                unitId: unit.id,
              }),
            );
          }

          /**
           * שעה חסומה למורה.
           */

          if (isTeacherBlockedHour(teachers, unit.teacherId, day, hour)) {
            errors.push(
              createIssue({
                type: "teacherBlockedHour",
                message: `${teacher.name} שובץ/ה ביום ${day} שעה ${hour}, למרות שהשעה חסומה עבורו/ה.`,
                day,
                hour,
                className,
                teacherId: unit.teacherId,
                unitId: unit.id,
              }),
            );
          }

          /**
           * שעה חסומה לקבוצת השיבוץ.
           */

          if (
            isConstraintGroupBlockedAt(
              constraintGroups,
              unit.constraintGroupId,
              day,
              hour,
            )
          ) {
            errors.push(
              createIssue({
                type: "constraintGroupBlocked",
                message: `היחידה ${unit.id} שובצה בזמן שחסום לקבוצת השיבוץ שלה.`,
                day,
                hour,
                className,
                teacherId: unit.teacherId,
                unitId: unit.id,
                groupId: unit.constraintGroupId,
              }),
            );
          }

          /**
           * ----------------------------------------
           * רישום לצורך איתור התנגשות מורה
           * ----------------------------------------
           */

          const teacherTimeKey = [
            String(unit.teacherId),
            day,
            String(hour),
          ].join("|");

          if (!teacherPlacementsByTime.has(teacherTimeKey)) {
            teacherPlacementsByTime.set(teacherTimeKey, []);
          }

          teacherPlacementsByTime.get(teacherTimeKey).push({
            unitId: unit.id,
            className,
            constraintGroupId: unit.constraintGroupId || null,
            unitType: unit.type || null,
          });
        }
      }
    }
  }

  /**
   * --------------------------------------------------
   * 2. התנגשויות מורים
   * --------------------------------------------------
   */

  for (const [key, placements] of teacherPlacementsByTime.entries()) {
    /**
     * חשוב:
     * אם אותה יחידה הופיעה בטעות פעמיים באותו תא,
     * זו בעיה אחרת ולא teacher conflict.
     */

    const uniqueClasses = [
      ...new Set(placements.map((placement) => placement.className)),
    ];

    if (uniqueClasses.length <= 1) {
      continue;
    }
    const groupIds = [
      ...new Set(
        placements
          .map((placement) => placement.constraintGroupId)
          .filter(Boolean),
      ),
    ];

    const allPlacementsBelongToSameGroup =
      groupIds.length === 1 &&
      placements.every(
        (placement) => placement.constraintGroupId === groupIds[0],
      );

    if (allPlacementsBelongToSameGroup) {
      const group = getConstraintGroupById(constraintGroups, groupIds[0]);

      if (groupHasRule(group, "sameTime")) {
        continue;
      }
    }

    const [teacherId, day, hour] = key.split("|");

    const teacher = getTeacherById(teachers, teacherId);

    errors.push(
      createIssue({
        type: "teacherConflict",
        message: `${teacher?.name || teacherId} שובץ/ה ביותר ממקום אחד ביום ${day} שעה ${hour}.`,
        day,
        hour: Number(hour),
        teacherId,
        details: {
          placements,
        },
      }),
    );
  }

  /**
   * --------------------------------------------------
   * 3. מספר השיבוצים של כל Teaching Unit
   * --------------------------------------------------
   */

  let totalRequiredHours = 0;
  let totalScheduledHours = 0;
  let totalMissingHours = 0;
  let totalExtraHours = 0;

  for (const unit of teachingUnits) {
    const isApprovedMeetingException =
      unit.type === "teamMeeting" &&
      isMeetingParticipantExceptionApproved(
        approvedExceptions,
        unit.constraintGroupId,
        unit.teacherId,
      );

    if (isApprovedMeetingException) {
      continue;
    }
    const requiredHours = Math.max(0, Number(unit.hours) || 0);

    const scheduledHours = countScheduledUnitHours(schedule, unit.id);

    totalRequiredHours += requiredHours;

    totalScheduledHours += Math.min(scheduledHours, requiredHours);

    /**
     * חסרות שעות.
     *
     * בשלב הזה זו warning ולא error,
     * כי אנחנו רוצים שה-validator יהיה שימושי
     * גם תוך כדי בניית מערכת חלקית.
     */

    if (scheduledHours < requiredHours) {
      const missing = requiredHours - scheduledHours;

      totalMissingHours += missing;

      warnings.push(
        createIssue({
          type: "unscheduledUnitHours",
          severity: "warning",
          message: `ליחידה ${unit.id} חסרות ${missing} שעות שיבוץ.`,
          className: unit.className,
          teacherId: unit.teacherId,
          unitId: unit.id,
          details: {
            requiredHours,
            scheduledHours,
            missingHours: missing,
          },
        }),
      );
    }

    /**
     * יותר מדי שיבוצים.
     */

    if (scheduledHours > requiredHours) {
      const extra = scheduledHours - requiredHours;

      totalExtraHours += extra;

      errors.push(
        createIssue({
          type: "unitOverScheduled",
          message: `היחידה ${unit.id} שובצה ${scheduledHours} פעמים למרות שנדרשות רק ${requiredHours} שעות.`,
          className: unit.className,
          teacherId: unit.teacherId,
          unitId: unit.id,
          details: {
            requiredHours,
            scheduledHours,
            extraHours: extra,
          },
        }),
      );
    }
  }

  /**
   * --------------------------------------------------
   * 4. בדיקת חוקי קבוצות השיבוץ
   * --------------------------------------------------
   */

  const placementsByUnitId = new Map();

  for (const unit of teachingUnits) {
    placementsByUnitId.set(unit.id, []);
  }

  for (const [day, daySchedule] of Object.entries(schedule || {})) {
    for (const [className, classSchedule] of Object.entries(
      daySchedule || {},
    )) {
      for (const [hourKey, cellValue] of Object.entries(classSchedule || {})) {
        const hour = Number(hourKey);

        const unitIds = Array.isArray(cellValue)
          ? cellValue
          : cellValue
            ? [cellValue]
            : [];

        for (const unitId of unitIds) {
          if (!placementsByUnitId.has(unitId)) {
            continue;
          }

          placementsByUnitId.get(unitId).push({
            day,
            hour,
            className,
          });
        }
      }
    }
  }

  for (const group of constraintGroups) {
    // ישיבות צוות נבדקות בנפרד בהמשך
    if (getMeetingById(meetings, group.id)) {
      continue;
    }
    if (!groupHasRule(group, "sameTime")) {
      continue;
    }

    const groupUnits = teachingUnits.filter(
      (unit) => unit.constraintGroupId === group.id,
    );

    if (groupUnits.length < 2) {
      continue;
    }

    const placementsBySlot = new Map();

    for (const unit of groupUnits) {
      const placements = placementsByUnitId.get(unit.id) || [];

      for (const placement of placements) {
        const key = `${placement.day}|${placement.hour}`;

        if (!placementsBySlot.has(key)) {
          placementsBySlot.set(key, new Set());
        }

        placementsBySlot.get(key).add(unit.id);
      }
    }

    for (const [slotKey, unitIdsAtSlot] of placementsBySlot.entries()) {
      /*
       * במערכת חלקית אין בעיה שעוד לא שובצו
       * כל שעות הקבוצה.
       *
       * אבל אם כבר שובצה יחידה של הקבוצה
       * בזמן מסוים, כל היחידות של קבוצת
       * sameTime צריכות להיות שם יחד.
       */

      if (unitIdsAtSlot.size !== groupUnits.length) {
        const [day, hour] = slotKey.split("|");

        errors.push(
          createIssue({
            type: "sameTimeViolation",

            message: `קבוצת "${group.name || group.id}" אינה משובצת במלואה יחד ביום ${day} שעה ${hour}.`,

            day,
            hour: Number(hour),

            groupId: group.id,

            details: {
              expectedUnitIds: groupUnits.map((unit) => unit.id),

              actualUnitIds: [...unitIdsAtSlot],
            },
          }),
        );
      }
    }
  }

  for (const group of constraintGroups) {
    if (!groupHasRule(group, "notSameTime")) {
      continue;
    }

    const groupUnits = teachingUnits.filter(
      (unit) => unit.constraintGroupId === group.id,
    );

    const placementsBySlot = new Map();

    for (const unit of groupUnits) {
      const placements = placementsByUnitId.get(unit.id) || [];

      for (const placement of placements) {
        const key = `${placement.day}|${placement.hour}`;

        if (!placementsBySlot.has(key)) {
          placementsBySlot.set(key, []);
        }

        placementsBySlot.get(key).push({
          unitId: unit.id,
          className: placement.className,
        });
      }
    }

    for (const [slotKey, placements] of placementsBySlot.entries()) {
      if (placements.length <= 1) {
        continue;
      }

      const [day, hour] = slotKey.split("|");

      errors.push(
        createIssue({
          type: "notSameTimeViolation",

          message: `בקבוצת "${group.name || group.id}" שובצו מספר יחידות באותו זמן: יום ${day} שעה ${hour}.`,

          day,
          hour: Number(hour),

          groupId: group.id,

          details: {
            placements,
          },
        }),
      );
    }
  }

  for (const group of constraintGroups) {
    if (!groupHasRule(group, "notSameDaySameClass")) {
      continue;
    }

    const groupUnits = teachingUnits.filter(
      (unit) => unit.constraintGroupId === group.id,
    );

    const placementsByClassAndDay = new Map();

    for (const unit of groupUnits) {
      const placements = placementsByUnitId.get(unit.id) || [];

      for (const placement of placements) {
        const key = `${placement.className}|${placement.day}`;

        if (!placementsByClassAndDay.has(key)) {
          placementsByClassAndDay.set(key, []);
        }

        placementsByClassAndDay.get(key).push({
          unitId: unit.id,
          hour: placement.hour,
        });
      }
    }

    for (const [key, placements] of placementsByClassAndDay.entries()) {
      if (placements.length <= 1) {
        continue;
      }

      const [className, day] = key.split("|");

      errors.push(
        createIssue({
          type: "notSameDaySameClassViolation",

          message: `בקבוצת "${group.name || group.id}" שובצו יותר משעה אחת בכיתה ${className} ביום ${day}.`,

          day,
          className,
          groupId: group.id,

          details: {
            placements,
          },
        }),
      );
    }
  }
  /**
   * --------------------------------------------------
   * 4B. בדיקת ישיבות צוות
   * --------------------------------------------------
   */

  for (const meeting of meetings) {
    const meetingUnits = getExpectedMeetingUnits(
      meeting,
      teachingUnits,
      approvedExceptions,
    );

    if (meetingUnits.length === 0) {
      continue;
    }

    const placementsBySlot = new Map();

    for (const unit of meetingUnits) {
      const placements = placementsByUnitId.get(unit.id) || [];

      for (const placement of placements) {
        const key = `${placement.day}|${placement.hour}`;

        if (!placementsBySlot.has(key)) {
          placementsBySlot.set(key, new Set());
        }

        placementsBySlot.get(key).add(unit.id);
      }
    }

    /**
     * ------------------------------------------------
     * בדיקה: הישיבה מופיעה ביותר מזמן אחד
     * ------------------------------------------------
     */

    if (placementsBySlot.size > 1) {
      errors.push(
        createIssue({
          type: "meetingSplitAcrossSlots",

          message: `הישיבה "${meeting.name}" מפוצלת בין יותר מזמן אחד.`,

          groupId: meeting.id,

          details: {
            slots: [...placementsBySlot.entries()].map(([slotKey, unitIds]) => {
              const [day, hour] = slotKey.split("|");

              return {
                day,
                hour: Number(hour),
                unitIds: [...unitIds],
              };
            }),
          },
        }),
      );
    }

    /**
     * ------------------------------------------------
     * בדיקת כל זמן שבו נמצאה הישיבה
     * ------------------------------------------------
     */

    for (const [slotKey, unitIdsAtSlot] of placementsBySlot.entries()) {
      const [day, hourText] = slotKey.split("|");

      const hour = Number(hourText);

      /**
       * כל המשתתפים הצפויים נמצאים?
       */

      if (unitIdsAtSlot.size !== meetingUnits.length) {
        errors.push(
          createIssue({
            type: "meetingPartialAttendance",

            message: `הישיבה "${meeting.name}" אינה כוללת את כל המשתתפים ביום ${day} שעה ${hour}.`,

            day,
            hour,

            groupId: meeting.id,

            details: {
              expectedUnitIds: meetingUnits.map((unit) => unit.id),

              actualUnitIds: [...unitIdsAtSlot],

              missingUnitIds: meetingUnits
                .map((unit) => unit.id)
                .filter((unitId) => !unitIdsAtSlot.has(unitId)),
            },
          }),
        );
      }

      /**
       * יום מותר?
       */

      if (!isMeetingDayAllowed(meeting, day)) {
        errors.push(
          createIssue({
            type: "meetingWrongDay",

            message: `הישיבה "${meeting.name}" שובצה ביום ${day}, שאינו יום מותר עבורה.`,

            day,
            hour,

            groupId: meeting.id,

            details: {
              allowedDays: meeting.allowedDays || [],
            },
          }),
        );
      }

      /**
       * שעה מותרת?
       */

      if (!isMeetingHourAllowed(meeting, hour)) {
        errors.push(
          createIssue({
            type: "meetingWrongHour",

            message: `הישיבה "${meeting.name}" שובצה בשעה ${hour}, שאינה שעה מותרת עבורה.`,

            day,
            hour,

            groupId: meeting.id,

            details: {
              allowedHours: meeting.allowedHours || [],
            },
          }),
        );
      }
    }
  }

  /**
   * --------------------------------------------------
   * 5. סטטיסטיקה כללית
   * --------------------------------------------------
   */

  const schedulingPercentage =
    totalRequiredHours === 0
      ? 0
      : Math.round((totalScheduledHours / totalRequiredHours) * 100);
  const missingUnits = warnings
    .filter((warning) => warning.type === "unscheduledUnitHours")
    .map((warning) => ({
      unitId: warning.unitId,
      teacherId: warning.teacherId,
      className: warning.className,
      missingHours: warning.details?.missingHours || 0,
    }));
  return {
    valid: errors.length === 0,

    errors,
    warnings,
    missingUnits,

    statistics: {
      totalRequiredHours,
      totalScheduledHours,
      totalMissingHours,
      totalExtraHours,
      schedulingPercentage,

      errorCount: errors.length,

      warningCount: warnings.length,

      missingUnitCount: missingUnits.length,
    },
  };
}
