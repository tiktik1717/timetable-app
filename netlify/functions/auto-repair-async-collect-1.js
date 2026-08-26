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

export default async (request) => {
  let inputFileIds = [];
  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await request.json();
    const responseId = body?.responseId;
    const schoolData = body?.schoolData;
    const brokenSchedule = body?.brokenSchedule;
    const approvedExceptions = Array.isArray(body?.approvedExceptions)
      ? body.approvedExceptions
      : [];
    inputFileIds = Array.isArray(body?.inputFileIds) ? body.inputFileIds : [];

    if (!responseId || !schoolData || !brokenSchedule) {
      return jsonResponse(
        { error: "responseId, schoolData and brokenSchedule are required" },
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
    const pythonRunLimit = 4;
    const pythonRunLimitExceeded = codeRuns.length > pythonRunLimit;

    if (pythonRunLimitExceeded) {
      return jsonResponse(
        {
          success: false,
          phase: "attempt-1-collect",
          error: `Attempt 1 exceeded Python run limit (${codeRuns.length}/${pythonRunLimit}).`,
          codeRuns,
          checks: {
            modelReportedSuccess: Boolean(parsed?.success),
            completedPython: codeRuns.some((run) => run.status === "completed"),
            pythonRunLimit,
            pythonRunCount: codeRuns.length,
            pythonRunLimitExceeded: true,
          },
          telemetry: responseTelemetry(response),
        },
        200,
      );
    }

    const refs = extractContainerFileReferences(
      response,
      "repaired-candidate.json",
    );
    const defaultContainerId =
      codeRuns.find((run) => run.containerId)?.containerId || null;
    let selectedRef =
      refs.find((ref) => ref.matchesExpectedName) || refs[0] || null;

    // A generated Code Interpreter file can exist in the container even when
    // the model's final message omitted the file annotation. Do not treat the
    // annotation as the source of truth: fall back to listing the container.
    if (!selectedRef?.fileId && defaultContainerId) {
      selectedRef = await findContainerFileByName(
        defaultContainerId,
        "repaired-candidate.json",
      );
    }

    if (!selectedRef?.fileId) {
      return jsonResponse(
        {
          success: false,
          phase: "attempt-1-collect",
          error: "Attempt 1 completed but repaired-candidate.json was not found.",
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
            repairedFileFound: false,
          },
          telemetry: responseTelemetry(response),
        },
        200,
      );
    }

    const repairedText = await retrieveContainerFileText({
      containerId: selectedRef.containerId || defaultContainerId,
      fileId: selectedRef.fileId,
    });
    const repairedPayload = JSON.parse(repairedText);
    const repairedSchedule = repairedPayload?.schedule;
    if (!repairedSchedule || typeof repairedSchedule !== "object") {
      throw new Error("Attempt 1 candidate does not contain a schedule");
    }

    const validationBefore = validateSchedule({
      schedule: brokenSchedule,
      schoolData,
      approvedExceptions,
    });
    const validation = validateSchedule({
      schedule: repairedSchedule,
      schoolData,
      approvedExceptions,
    });

    const repairedToFull =
      Number(validation?.statistics?.totalScheduledHours || 0) ===
      Number(validation?.statistics?.totalRequiredHours || 0);
    const finalClean =
      validation.valid &&
      Number(validation?.statistics?.warningCount || 0) === 0 &&
      Number(validation?.statistics?.totalMissingHours || 0) === 0 &&
      Number(validation?.statistics?.totalExtraHours || 0) === 0;

    return jsonResponse({
      success: Boolean(
        parsed?.success &&
          codeRuns.some((run) => run.status === "completed") &&
          repairedToFull &&
          finalClean,
      ),
      phase: "attempt-1-collected",
      reply: parsed?.reply || "",
      validationBefore,
      validation,
      repairedSchedule,
      codeRuns,
      checks: {
        modelReportedSuccess: Boolean(parsed?.success),
        completedPython: codeRuns.some((run) => run.status === "completed"),
        repairedToFull,
        finalClean,
        repairedFileFound: true,
        repairedFileSource: selectedRef.source || "message-annotation",
        pythonRunLimit,
        pythonRunCount: codeRuns.length,
        pythonRunLimitExceeded: false,
      },
      telemetry: {
        ...responseTelemetry(response),
        candidateFileBytes: Buffer.byteLength(repairedText, "utf8"),
      },
    });
  } catch (error) {
    console.error("Async attempt 1 collect failed:", error);
    return jsonResponse(
      {
        success: false,
        phase: "attempt-1-collect",
        error: error?.message || "Unknown attempt-1 collect error",
      },
      500,
    );
  } finally {
    await deleteFiles(inputFileIds);
  }
};
