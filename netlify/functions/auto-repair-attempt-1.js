import OpenAI from "openai";
import { validateSchedule } from "../../src/scheduling/scheduleValidator.js";

const client = new OpenAI({
  apiKey: process.env.SCHEDULING_OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

const repairResultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    success: { type: "boolean" },
    reply: { type: "string" },
    generatedFileName: { type: "string" },
  },
  required: ["success", "reply", "generatedFileName"],
};

function extractCodeRuns(response) {
  const runs = [];
  for (const item of response?.output || []) {
    if (item?.type !== "code_interpreter_call") continue;
    const logs = (item.outputs || [])
      .filter((output) => output?.type === "logs")
      .map((output) => output.logs || "")
      .filter(Boolean)
      .join("\n");
    runs.push({
      id: item.id || null,
      containerId: item.container_id || null,
      status: item.status || null,
      code: item.code || "",
      logs,
    });
  }
  return runs;
}

function extractContainerFileReferences(response, expectedName) {
  const refs = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const part of item.content || []) {
      if (part?.type !== "output_text") continue;
      for (const annotation of part.annotations || []) {
        const filename = annotation?.filename || annotation?.file_path?.filename || null;
        const fileId = annotation?.file_id || annotation?.file_path?.file_id || null;
        const containerId = annotation?.container_id || null;
        if (!fileId) continue;
        refs.push({
          fileId,
          containerId,
          filename,
          matchesExpectedName: filename === expectedName,
        });
      }
    }
  }
  return refs;
}

async function retrieveContainerFileText({ containerId, fileId }) {
  if (!containerId || !fileId) {
    throw new Error("Missing containerId/fileId for generated candidate file");
  }

  try {
    const binary = await client.containers.files.content.retrieve(fileId, {
      container_id: containerId,
    });
    if (binary && typeof binary.text === "function") return await binary.text();
    if (binary && typeof binary.arrayBuffer === "function") {
      return Buffer.from(await binary.arrayBuffer()).toString("utf8");
    }
    if (binary?.response && typeof binary.response.text === "function") {
      return await binary.response.text();
    }
  } catch (sdkError) {
    console.warn("SDK container file retrieval failed; trying raw HTTP", sdkError);
  }

  const response = await fetch(
    `https://api.openai.com/v1/containers/${encodeURIComponent(containerId)}/files/${encodeURIComponent(fileId)}/content`,
    { headers: { Authorization: `Bearer ${process.env.SCHEDULING_OPENAI_API_KEY}` } },
  );
  if (!response.ok) {
    throw new Error(`Unable to retrieve generated candidate file (${response.status})`);
  }
  return await response.text();
}


export default async (request) => {
  const uploadedFileIds = [];
  try {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const schoolData = body?.schoolData;
    const brokenSchedule = body?.brokenSchedule;
    const validatorReport = body?.validatorReport;
    const approvedExceptions = Array.isArray(body?.approvedExceptions)
      ? body.approvedExceptions
      : [];

    if (!schoolData || !brokenSchedule || !validatorReport) {
      return new Response(
        JSON.stringify({
          error: "schoolData, brokenSchedule and validatorReport are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Re-run locally so the server never trusts a validator report supplied by the client.
    const serverValidationBefore = validateSchedule({
      schedule: brokenSchedule,
      schoolData,
      approvedExceptions,
    });

    const brokenText = JSON.stringify(
      { schedule: brokenSchedule },
      null,
      2,
    );
    const brokenUpload = await client.files.create({
      file: new File(
        [brokenText],
        "broken-candidate.json",
        { type: "application/json" },
      ),
      purpose: "user_data",
      expires_after: { anchor: "created_at", seconds: 3600 },
    });
    uploadedFileIds.push(brokenUpload.id);

    const metadataText = JSON.stringify({
      version: 1,
      purpose: "auto-repair-loop-v1.1-attempt-1",
      schoolData,
    }, null, 2);

    const metadataUpload = await client.files.create({
      file: new File(
        [metadataText],
        "school-metadata.json",
        { type: "application/json" },
      ),
      purpose: "user_data",
      expires_after: { anchor: "created_at", seconds: 3600 },
    });
    uploadedFileIds.push(metadataUpload.id);

    const feedback = {
      valid: serverValidationBefore.valid,
      errors: serverValidationBefore.errors,
      warnings: serverValidationBefore.warnings,
      missingUnits: serverValidationBefore.missingUnits,
      statistics: serverValidationBefore.statistics,
    };

    const model = "gpt-5.2";
    const startedAt = Date.now();
    const response = await client.responses.create({
      model,
      instructions: `
You are attempt 1 of an autonomous timetable repair test.
You MUST use Python code_interpreter.

You receive:
- broken-candidate.json
- school-metadata.json
- a Validator report in the user message

You DO NOT receive the pristine timetable.
You are NOT told which day/hour was removed.
Diagnose the Validator report and inspect the broken schedule + schoolData.

Goal:
- repair the missing scheduling problem with the smallest possible change;
- respect teacher free days, blocked hours, class hours, groups and existing schedule structure;
- do not merely explain the repair: execute Python.

Write /mnt/data/repaired-candidate.json containing exactly:
{"schedule": <repaired schedule>}

Read it back.
Print AUTO_REPAIR_RESULT= followed by a compact description of the change.
Explicitly reference /mnt/data/repaired-candidate.json in the reply so it is returned.
`,
      tools: [{
        type: "code_interpreter",
        container: {
          type: "auto",
          file_ids: [brokenUpload.id, metadataUpload.id],
        },
      }],
      tool_choice: "required",
      text: {
        format: {
          type: "json_schema",
          name: "auto_repair_attempt_1_result",
          strict: true,
          schema: repairResultSchema,
        },
      },
      input: `VALIDATOR_REPORT\n${JSON.stringify(feedback)}`,
    });

    const parsed = JSON.parse(response.output_text || "{}");
    const codeRuns = extractCodeRuns(response);
    const refs = extractContainerFileReferences(
      response,
      "repaired-candidate.json",
    );
    const defaultContainerId =
      codeRuns.find((run) => run.containerId)?.containerId || null;
    const selectedRef =
      refs.find((ref) => ref.matchesExpectedName) || refs[0] || null;

    if (!selectedRef?.fileId) {
      throw new Error("Attempt 1 did not return repaired-candidate.json");
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

    const usage = response.usage || {};
    const telemetry = {
      model: response.model || model,
      calls: 1,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      totalTokens:
        usage.total_tokens ??
        ((usage.input_tokens || 0) + (usage.output_tokens || 0)),
      durationMs: Date.now() - startedAt,
      candidateFileBytes: Buffer.byteLength(repairedText, "utf8"),
    };

    return new Response(JSON.stringify({
      success: Boolean(
        parsed?.success &&
        codeRuns.some((run) => run.status === "completed") &&
        repairedToFull &&
        finalClean
      ),
      phase: "attempt-1",
      reply: parsed?.reply || "",
      validationBefore: serverValidationBefore,
      validation,
      repairedSchedule,
      codeRuns,
      checks: {
        modelReportedSuccess: Boolean(parsed?.success),
        completedPython:
          codeRuns.some((run) => run.status === "completed"),
        repairedToFull,
        finalClean,
      },
      telemetry,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-repair attempt 1 failed:", error);
    return new Response(JSON.stringify({
      success: false,
      phase: "attempt-1",
      error: error?.message || "Unknown attempt-1 error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    for (const id of uploadedFileIds) {
      try {
        await client.files.delete(id);
      } catch (cleanupError) {
        console.warn("Failed to delete attempt-1 temp file:", cleanupError);
      }
    }
  }
};
