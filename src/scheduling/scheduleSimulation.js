export function simulateScheduleMove({
  schedule,
  action,
}) {
  if (
    !schedule ||
    !action ||
    action.type !== "proposeScheduleMove"
  ) {
    return {
      success: false,
      error: "Invalid schedule move action",
      candidateSchedule: null,
    };
  }

  // עותק עמוק כדי שלא ניגע במערכת האמיתית
  const candidateSchedule =
    structuredClone(schedule);

  const {
    unitId,
    fromDay,
    fromHour,
    fromClassName,
    toDay,
    toHour,
    toClassName,
  } = action;

  const sourceCell =
    candidateSchedule?.[fromDay]?.[
      fromClassName
    ]?.[fromHour];

  const sourceUnitIds = Array.isArray(sourceCell)
    ? [...sourceCell]
    : sourceCell
      ? [sourceCell]
      : [];

  if (!sourceUnitIds.includes(unitId)) {
    return {
      success: false,
      error:
        `היחידה ${unitId} אינה נמצאת ` +
        `${fromDay}, ${fromClassName}, שעה ${fromHour}`,
      candidateSchedule: null,
    };
  }

  const newSourceUnitIds =
    sourceUnitIds.filter(
      (id) => id !== unitId
    );

  // שמירת תא המקור
  candidateSchedule[fromDay][fromClassName][
    fromHour
  ] =
    newSourceUnitIds.length === 0
      ? null
      : newSourceUnitIds;

  // ודא שמבנה היעד קיים
  if (!candidateSchedule[toDay]) {
    candidateSchedule[toDay] = {};
  }

  if (!candidateSchedule[toDay][toClassName]) {
    candidateSchedule[toDay][toClassName] =
      {};
  }

  const targetCell =
    candidateSchedule[toDay][toClassName][
      toHour
    ];

  const targetUnitIds = Array.isArray(targetCell)
    ? [...targetCell]
    : targetCell
      ? [targetCell]
      : [];

  // בשלב הזה לא מחליפים תוכן קיים אוטומטית.
  if (targetUnitIds.length > 0) {
    return {
      success: false,
      error:
        `תא היעד ${toDay}, ${toClassName}, שעה ${toHour} אינו פנוי.`,
      candidateSchedule: null,
    };
  }

  candidateSchedule[toDay][toClassName][
    toHour
  ] = [unitId];

  return {
    success: true,
    error: null,
    candidateSchedule,
  };
}