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
import { validateSchedule } from "../../src/scheduling/scheduleValidator.js";
import { evaluateFormalRules } from "../../src/scheduling/ruleEvaluator.js";

export default async (request) => {
  let response = null;
  let parsed = null;
  let codeRuns = [];
  let uploadedFileIds = [];
  let responseId = null;

  try {
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    const body = await request.json();
    ({ responseId, uploadedFileIds = [] } = body);
    const { schoolData, rules = [], approvedExceptions = [], baselineSchedule = null } = body;
    if (!responseId || !schoolData) return jsonResponse({ error: "responseId and schoolData are required" }, 400);

    response = await client.responses.retrieve(responseId);
    if (response.status !== "completed") {
      return jsonResponse({ success: false, error: `Response is not completed (${response.status})` }, 409);
    }

    const outputText = extractOutputText(response) || "{}";
    try {
      parsed = JSON.parse(outputText);
    } catch {
      parsed = { success: false, reply: outputText, generatedFileName: "", strategySummary: "" };
    }
    codeRuns = extractCodeRuns(response);

    // File annotations are convenient, but they are not a reliable transport
    // contract: Code Interpreter can create the requested file without the
    // final assistant message carrying a file annotation. Prefer an annotation
    // when present, then deterministically list the actual container by name.
    const refs = extractContainerFileReferences(response, "generated-candidate.json");
    let selectedRef = refs.find((r) => r.matchesExpectedName) || refs[0] || null;

    const candidateContainerIds = [
      selectedRef?.containerId,
      ...codeRuns.map((run) => run.containerId),
    ].filter(Boolean);
    const uniqueContainerIds = [...new Set(candidateContainerIds)];

    if (!selectedRef?.fileId) {
      for (const containerId of uniqueContainerIds) {
        const found = await findContainerFileByName(containerId, "generated-candidate.json");
        if (found?.fileId) {
          selectedRef = found;
          break;
        }
      }
    }

    const containerId = selectedRef?.containerId || uniqueContainerIds[0] || null;
    if (!selectedRef?.fileId || !containerId) {
      throw new Error(
        "Code Interpreter did not expose generated-candidate.json. The run trace was preserved so the next attempt can diagnose whether the file was never written or only not returned as an annotation.",
      );
    }

    const candidatePayload = JSON.parse(
      await retrieveContainerFileText({ containerId, fileId: selectedRef.fileId }),
    );
    const candidateSchedule = candidatePayload?.schedule;
    if (!candidateSchedule || typeof candidateSchedule !== "object") {
      throw new Error("Generated file has no schedule object");
    }

    const validation = validateSchedule({ schedule: candidateSchedule, schoolData, approvedExceptions });
    const formalEvaluations = evaluateFormalRules({ rules, schedule: candidateSchedule, schoolData, baselineSchedule });
    await deleteFiles(uploadedFileIds);

    return jsonResponse({
      success: true,
      modelResult: parsed,
      candidateSchedule,
      validation,
      formalEvaluations,
      codeRuns,
      generatedFile: {
        fileId: selectedRef.fileId,
        containerId,
        filename: selectedRef.filename || "generated-candidate.json",
        source: selectedRef.source || "response-annotation",
      },
      telemetry: responseTelemetry(response),
      responseId,
    });
  } catch (error) {
    console.error("Generation async collect failed:", error);
    try {
      await deleteFiles(uploadedFileIds);
    } catch {}
    return jsonResponse(
      {
        success: false,
        error: error?.message || "Unknown generation collect error",
        responseId,
        modelResult: parsed,
        codeRuns,
        telemetry: response ? responseTelemetry(response) : null,
      },
      500,
    );
  }
};
