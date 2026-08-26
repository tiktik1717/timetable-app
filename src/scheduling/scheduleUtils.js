// src/scheduling/scheduleUtils.js

/**
 * מחזיר את מזהי יחידות ההוראה ששובצו בתא מסוים.
 *
 * מבנה schedule אצלנו הוא:
 *
 * schedule[day][className][hour]
 *
 * והערך בתא יכול להיות:
 * - מערך של unitIds
 * - unitId יחיד
 * - undefined / null
 */
export function getCellUnitIds(
    schedule,
    day,
    className,
    hour
) {
    const value =
        schedule?.[day]?.[className]?.[hour];

    if (!value) {
        return [];
    }

    return Array.isArray(value)
        ? value
        : [value];
}


/**
 * מחזיר יחידת הוראה לפי id.
 */
export function getUnitById(
    teachingUnits,
    unitId
) {
    if (!Array.isArray(teachingUnits)) {
        return null;
    }

    return (
        teachingUnits.find(
            (unit) => unit.id === unitId
        ) || null
    );
}


/**
 * מחזיר מורה לפי id.
 *
 * אצלנו teacherId נשמר בדרך כלל כמחרוזת,
 * ולכן אנחנו מנרמלים גם את הערך שמגיע לפונקציה.
 */
export function getTeacherById(
    teachers,
    teacherId
) {
    if (!Array.isArray(teachers)) {
        return null;
    }

    return (
        teachers.find(
            (teacher) =>
                String(teacher.id) ===
                String(teacherId)
        ) || null
    );
}


/**
 * מחזיר קבוצת אילוץ לפי id.
 */
export function getConstraintGroupById(
    constraintGroups,
    groupId
) {
    if (
        !groupId ||
        !Array.isArray(constraintGroups)
    ) {
        return null;
    }

    return (
        constraintGroups.find(
            (group) => group.id === groupId
        ) || null
    );
}


/**
 * מחזיר כמה שעות הכיתה אמורה לפעול ביום מסוים.
 *
 * למשל:
 *
 * dailyHoursByClass = {
 *   "א1": {
 *     "א": 5,
 *     "ב": 6
 *   }
 * }
 */
export function getClassHoursForDay(
    dailyHoursByClass,
    className,
    day
) {
    return (
        Number(
            dailyHoursByClass?.[className]?.[day]
        ) || 0
    );
}


/**
 * בודק האם שעה נמצאת בתוך יום הלימודים של הכיתה.
 *
 * למשל:
 * אם הכיתה לומדת 5 שעות ביום א׳:
 *
 * שעה 5 => true
 * שעה 6 => false
 */
export function isHourInsideClassDay(
    dailyHoursByClass,
    className,
    day,
    hour
) {
    const classHours =
        getClassHoursForDay(
            dailyHoursByClass,
            className,
            day
        );

    return (
        Number(hour) >= 1 &&
        Number(hour) <= classHours
    );
}


/**
 * מחזיר את כל השיבוצים של יחידת הוראה מסוימת.
 *
 * התוצאה היא מערך כמו:
 *
 * [
 *   {
 *     day: "א",
 *     className: "א1",
 *     hour: 2
 *   },
 *   ...
 * ]
 */
export function getUnitPlacements(
    schedule,
    unitId
) {
    const placements = [];

    if (!schedule || !unitId) {
        return placements;
    }

    for (const [
        day,
        daySchedule
    ] of Object.entries(schedule)) {

        if (
            !daySchedule ||
            typeof daySchedule !== "object"
        ) {
            continue;
        }

        for (const [
            className,
            classSchedule
        ] of Object.entries(daySchedule)) {

            if (
                !classSchedule ||
                typeof classSchedule !== "object"
            ) {
                continue;
            }

            for (const [
                hour,
                cellValue
            ] of Object.entries(classSchedule)) {

                const unitIds =
                    Array.isArray(cellValue)
                        ? cellValue
                        : cellValue
                            ? [cellValue]
                            : [];

                if (unitIds.includes(unitId)) {
                    placements.push({
                        day,
                        className,
                        hour: Number(hour),
                    });
                }
            }
        }
    }

    return placements;
}


/**
 * סופר כמה פעמים יחידת הוראה שובצה.
 *
 * חשוב:
 * הפונקציה סורקת את ה-schedule בפועל ולא את
 * schoolData.hours.
 *
 * כך היא יודעת לספור גם שעה 7 ושעות עתידיות אחרות.
 */
export function countScheduledUnitHours(
    schedule,
    unitId
) {
    return getUnitPlacements(
        schedule,
        unitId
    ).length;
}


/**
 * מחזיר כמה שעות עדיין נשארו לשיבוץ עבור יחידה.
 */
export function getRemainingUnitHours(
    schedule,
    teachingUnits,
    unitId
) {
    const unit =
        getUnitById(
            teachingUnits,
            unitId
        );

    if (!unit) {
        return 0;
    }

    const scheduled =
        countScheduledUnitHours(
            schedule,
            unitId
        );

    return Math.max(
        0,
        Number(unit.hours || 0) - scheduled
    );
}


/**
 * מחזיר את כל יחידות ההוראה של מורה.
 *
 * ניתן לבחור אם לכלול גם ישיבות צוות.
 */
export function getTeacherUnits(
    teachingUnits,
    teacherId,
    options = {}
) {
    const {
        includeMeetings = true,
    } = options;

    if (!Array.isArray(teachingUnits)) {
        return [];
    }

    return teachingUnits.filter((unit) => {
        if (
            String(unit.teacherId) !==
            String(teacherId)
        ) {
            return false;
        }

        if (
            !includeMeetings &&
            unit.type === "teamMeeting"
        ) {
            return false;
        }

        return true;
    });
}


/**
 * מחזיר את כל היחידות שנמצאות בתא,
 * כאובייקטים מלאים ולא רק IDs.
 */
export function getCellUnits(
    schedule,
    teachingUnits,
    day,
    className,
    hour
) {
    return getCellUnitIds(
        schedule,
        day,
        className,
        hour
    )
        .map((unitId) =>
            getUnitById(
                teachingUnits,
                unitId
            )
        )
        .filter(Boolean);
}


/**
 * מחזיר את כל המורים ששובצו בתא.
 */
export function getCellTeacherIds(
    schedule,
    teachingUnits,
    day,
    className,
    hour
) {
    return [
        ...new Set(
            getCellUnits(
                schedule,
                teachingUnits,
                day,
                className,
                hour
            )
                .map((unit) =>
                    String(unit.teacherId)
                )
                .filter(Boolean)
        ),
    ];
}


/**
 * בודק האם מורה משובץ במקום כלשהו
 * ביום ובשעה מסוימים.
 *
 * ניתן להעביר excludeClassName אם רוצים
 * להתעלם מכיתה מסוימת.
 */
export function isTeacherBusyAt(
    schedule,
    teachingUnits,
    teacherId,
    day,
    hour,
    options = {}
) {
    const {
        excludeClassName = null,
    } = options;

    const daySchedule =
        schedule?.[day];

    if (!daySchedule) {
        return false;
    }

    for (const className of Object.keys(
        daySchedule
    )) {
        if (
            excludeClassName &&
            className === excludeClassName
        ) {
            continue;
        }

        const teacherIds =
            getCellTeacherIds(
                schedule,
                teachingUnits,
                day,
                className,
                hour
            );

        if (
            teacherIds.includes(
                String(teacherId)
            )
        ) {
            return true;
        }
    }

    return false;
}


/**
 * בודק האם היום הוא יום חופשי של המורה.
 *
 * הערך "אין" שקיים בחלק מהנתונים אינו נחשב ליום.
 */
export function isTeacherFreeDay(
    teachers,
    teacherId,
    day
) {
    const teacher =
        getTeacherById(
            teachers,
            teacherId
        );

    if (!teacher) {
        return false;
    }

    const freeDays =
        Array.isArray(teacher.freeDays)
            ? teacher.freeDays
            : [];

    return freeDays
        .filter(
            (freeDay) =>
                freeDay &&
                freeDay !== "אין"
        )
        .includes(day);
}


/**
 * בודק האם שעה נחסמה במפורש עבור מורה.
 */
export function isTeacherBlockedHour(
    teachers,
    teacherId,
    day,
    hour
) {
    const teacher =
        getTeacherById(
            teachers,
            teacherId
        );

    if (!teacher) {
        return false;
    }

    const blockedHours =
        teacher.blockedHours?.[day];

    if (!Array.isArray(blockedHours)) {
        return false;
    }

    return blockedHours
        .map(Number)
        .includes(Number(hour));
}