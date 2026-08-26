import { validateSchedule } from "../../src/scheduling/scheduleValidator.js";
import {
  client,
  jsonResponse,
  extractOutputText,
  extractCodeRuns,
  extractContainerFileReferences,
  findContainerFileByName,
  retrieveContainerFileText,
  responseTelemetry,
  deleteFiles,
} from "../lib/auto-repair-async-shared.js";


function cloneSchedule(schedule) {
  return JSON.parse(JSON.stringify(schedule));
}

function getUnitById(schoolData, unitId) {
  return (schoolData?.teachingUnits || []).find((u) => u?.id === unitId) || null;
}

function getLegalHours(schoolData, className, day, schedule) {
  const configured = schoolData?.dailyHoursByClass?.[className]?.[day];
  if (Number.isFinite(Number(configured)) && Number(configured) > 0) {
    return Array.from({ length: Number(configured) }, (_, i) => String(i + 1));
  }
  return Object.keys(schedule?.[day]?.[className] || {});
}

function isFinalClean(report) {
  return Boolean(
    report?.valid &&
      Number(report?.statistics?.warningCount || 0) === 0 &&
      Number(report?.statistics?.totalMissingHours || 0) === 0 &&
      Number(report?.statistics?.totalExtraHours || 0) === 0
  );
}

function findDirectRepair({
  brokenSchedule,
  schoolData,
  approvedExceptions,
  missingUnitId,
}) {
  const unit = getUnitById(schoolData, missingUnitId);
  if (!unit?.className) return null;
  const className = unit.className;

  for (const day of Object.keys(brokenSchedule || {})) {
    for (const hour of getLegalHours(schoolData, className, day, brokenSchedule)) {
      const cell = brokenSchedule?.[day]?.[className]?.[String(hour)] || [];
      if (cell.length > 0) continue;

      const candidate = cloneSchedule(brokenSchedule);
      candidate[day][className][String(hour)] = [missingUnitId];
      const report = validateSchedule({
        schedule: candidate,
        schoolData,
        approvedExceptions,
      });
      if (isFinalClean(report)) {
        return { day, className, hour: String(hour) };
      }
    }
  }
  return null;
}

function findOneDisplacementRepair({
  brokenSchedule,
  schoolData,
  approvedExceptions,
  missingUnitId,
}) {
  const missingUnit = getUnitById(schoolData, missingUnitId);
  if (!missingUnit?.className) return null;
  const className = missingUnit.className;

  // If one existing placement is displaced, the missing unit must occupy the
  // source slot (otherwise a direct empty insertion would already suffice).
  for (const sourceDay of Object.keys(brokenSchedule || {})) {
    for (const sourceHour of getLegalHours(
      schoolData,
      className,
      sourceDay,
      brokenSchedule,
    )) {
      const sourceCell =
        brokenSchedule?.[sourceDay]?.[className]?.[String(sourceHour)] || [];
      if (sourceCell.length !== 1) continue;

      const occupantId = sourceCell[0];
      const occupant = getUnitById(schoolData, occupantId);
      if (
        !occupant ||
        occupant?.constraintGroupId != null ||
        occupant?.className !== className
      ) {
        continue;
      }

      for (const destDay of Object.keys(brokenSchedule || {})) {
        for (const destHour of getLegalHours(
          schoolData,
          className,
          destDay,
          brokenSchedule,
        )) {
          if (
            destDay === sourceDay &&
            String(destHour) === String(sourceHour)
          ) {
            continue;
          }
          const destCell =
            brokenSchedule?.[destDay]?.[className]?.[String(destHour)] || [];
          if (destCell.length > 0) continue;

          const candidate = cloneSchedule(brokenSchedule);
          candidate[sourceDay][className][String(sourceHour)] = [missingUnitId];
          candidate[destDay][className][String(destHour)] = [occupantId];

          const report = validateSchedule({
            schedule: candidate,
            schoolData,
            approvedExceptions,
          });
          if (isFinalClean(report)) {
            return {
              missingUnitId,
              insertAt: {
                day: sourceDay,
                className,
                hour: String(sourceHour),
              },
              movedUnitId: occupantId,
              movedTo: {
                day: destDay,
                className,
                hour: String(destHour),
              },
            };
          }
        }
      }
    }
  }
  return null;
}

export default async (request) => {
  let inputFileIds = [];
  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await request.json();
    const responseId = body?.responseId;
    const schoolData = body?.schoolData;
    const baseSchedule = body?.baseSchedule;
    const approvedExceptions = Array.isArray(body?.approvedExceptions)
      ? body.approvedExceptions
      : [];
    inputFileIds = Array.isArray(body?.inputFileIds) ? body.inputFileIds : [];

    if (!responseId || !schoolData || !baseSchedule) {
      return jsonResponse(
        { error: "responseId, schoolData and baseSchedule are required" },
        400,
      );
    }

    const response = await client.responses.retrieve(responseId);
    if (response?.status !== "completed") {
      return jsonResponse(
        {
          success: false,
          error: `Response is not completed (status=${response?.status || "unknown"})`,
        },
        409,
      );
    }

    const parsed = JSON.parse(extractOutputText(response) || "{}");
    const codeRuns = extractCodeRuns(response);
    const refs = extractContainerFileReferences(
      response,
      "candidate-schedule.json",
    );
    const defaultContainerId =
      codeRuns.find((run) => run.containerId)?.containerId || null;
    let selectedRef =
      refs.find((ref) => ref.matchesExpectedName) || refs[0] || null;

    // As with Attempt 1, the file may exist in the Code Interpreter container
    // even when the final assistant message omitted a file annotation.
    if (!selectedRef?.fileId && defaultContainerId) {
      selectedRef = await findContainerFileByName(
        defaultContainerId,
        "candidate-schedule.json",
      );
    }

    if (!selectedRef?.fileId) {
      return jsonResponse(
        {
          success: false,
          phase: "attempt-0-collect",
          error: "Attempt 0 completed but candidate-schedule.json was not found.",
          codeRuns,
          diagnostics: {
            parsed,
            defaultContainerId,
            annotationRefs: refs,
            outputItemTypes: (response?.output || []).map(
              (item) => item?.type || "unknown",
            ),
          },
          checks: {
            modelReportedSuccess: Boolean(parsed?.success),
            completedPython: codeRuns.some(
              (run) => run.status === "completed",
            ),
            candidateFileFound: false,
          },
          telemetry: responseTelemetry(response),
        },
        200,
      );
    }

    const candidateText = await retrieveContainerFileText({
      containerId: selectedRef.containerId || defaultContainerId,
      fileId: selectedRef.fileId,
    });
    const candidatePayload = JSON.parse(candidateText);
    const brokenSchedule = candidatePayload?.schedule;
    if (!brokenSchedule || typeof brokenSchedule !== "object") {
      throw new Error("Attempt 0 candidate does not contain a schedule");
    }

    const beforeValidation = validateSchedule({
      schedule: baseSchedule,
      schoolData,
      approvedExceptions,
    });
    const validation = validateSchedule({
      schedule: brokenSchedule,
      schoolData,
      approvedExceptions,
    });

    const beforeScheduled = Number(
      beforeValidation?.statistics?.totalScheduledHours || 0,
    );
    const afterScheduled = Number(
      validation?.statistics?.totalScheduledHours || 0,
    );
    const injected = parsed?.injectedFailure || null;
    const originalDay = injected?.day != null ? String(injected.day) : null;
    const originalHour = injected?.hour != null ? String(injected.hour) : null;
    const originalClass = injected?.className || null;
    const originalUnitId = injected?.unitId || null;
    const originalCell =
      originalDay && originalClass && originalHour
        ? brokenSchedule?.[originalDay]?.[originalClass]?.[originalHour]
        : null;

    const originalSlotOccupiedByAnotherUnit =
      Array.isArray(originalCell) &&
      originalCell.length > 0 &&
      !originalCell.includes(originalUnitId);

    const missingUnitId =
      validation?.missingUnits?.length === 1
        ? validation.missingUnits[0]?.unitId
        : originalUnitId;

    // Verify benchmark hardness with the SAME production Validator.
    // We deliberately brute-force all direct repairs and all repairs involving
    // only one displaced existing unit. v1.8 is accepted only if neither exists.
    const directRepair = missingUnitId
      ? findDirectRepair({
          brokenSchedule,
          schoolData,
          approvedExceptions,
          missingUnitId,
        })
      : null;

    const oneDisplacementRepair = missingUnitId
      ? findOneDisplacementRepair({
          brokenSchedule,
          schoolData,
          approvedExceptions,
          missingUnitId,
        })
      : null;

    const requiresAtLeastTwoDisplacements =
      !directRepair && !oneDisplacementRepair;

    const controlledDefectDetected =
      beforeScheduled - afterScheduled === 1 &&
      Number(validation?.statistics?.totalMissingHours || 0) >= 1 &&
      originalSlotOccupiedByAnotherUnit &&
      requiresAtLeastTwoDisplacements;

    return jsonResponse({
      success: Boolean(
        parsed?.success &&
          codeRuns.some((run) => run.status === "completed") &&
          controlledDefectDetected,
      ),
      phase: "attempt-0-collected",
      injectedFailure: parsed?.injectedFailure || null,
      brokenSchedule,
      validation,
      beforeValidation,
      codeRuns,
      checks: {
        controlledDefectDetected,
        originalSlotOccupiedByAnotherUnit,
        directRepairExists: Boolean(directRepair),
        oneDisplacementRepairExists: Boolean(oneDisplacementRepair),
        requiresAtLeastTwoDisplacements,
        directRepair,
        oneDisplacementRepair,
        modelReportedSuccess: Boolean(parsed?.success),
        completedPython: codeRuns.some((run) => run.status === "completed"),
        candidateFileFound: true,
        candidateFileSource: selectedRef.source || "message-annotation",
      },
      telemetry: {
        ...responseTelemetry(response),
        candidateFileBytes: Buffer.byteLength(candidateText, "utf8"),
      },
    });
  } catch (error) {
    console.error("Async attempt 0 collect failed:", error);
    return jsonResponse(
      {
        success: false,
        phase: "attempt-0-collect",
        error: error?.message || "Unknown attempt-0 collect error",
      },
      500,
    );
  } finally {
    await deleteFiles(inputFileIds);
  }
};
