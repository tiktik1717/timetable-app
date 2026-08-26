import OpenAI from "openai";
import { validateSchedule } from "../../src/scheduling/scheduleValidator.js";

const client = new OpenAI({
  apiKey: process.env.SCHEDULING_OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

const resultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    success: { type: "boolean" },
    reply: { type: "string" },
    generatedFileName: { type: "string" },
    injectedFailure: {
      type: "object",
      additionalProperties: false,
      properties: {
        unitId: { type: "string" },
        className: { type: "string" },
        day: { type: "string" },
        hour: { type: "string" },
      },
      required: ["unitId", "className", "day", "hour"],
    },
  },
  required: ["success", "reply", "generatedFileName", "injectedFailure"],
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
  let uploadedFileId = null;
  try {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const schoolData = body?.schoolData;
    const baseSchedule = body?.baseSchedule;
    const approvedExceptions = Array.isArray(body?.approvedExceptions)
      ? body.approvedExceptions
      : [];

    if (!schoolData || !baseSchedule) {
      return new Response(
        JSON.stringify({ error: "schoolData and baseSchedule are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const beforeValidation = validateSchedule({
      schedule: baseSchedule,
      schoolData,
      approvedExceptions,
    });

    const metadataText = JSON.stringify({
      version: 1,
      purpose: "auto-repair-loop-v1.1-attempt-0",
      schoolData,
      schedule: baseSchedule,
    }, null, 2);

    const uploaded = await client.files.create({
      file: new File([metadataText], "metadata.json", { type: "application/json" }),
      purpose: "user_data",
      expires_after: { anchor: "created_at", seconds: 3600 },
    });
    uploadedFileId = uploaded.id;

    const model = "gpt-5.2";
    const startedAt = Date.now();
    const response = await client.responses.create({
      model,
      instructions: `
You are attempt 0 of an auto-repair infrastructure test.
You MUST use Python code_interpreter and MUST read metadata.json.

Inside Python:
1. Deep-copy schedule.
2. Find the FIRST ordinary teaching-unit occurrence whose teachingUnit.constraintGroupId is null and teachingUnit.className equals the scanned class.
3. Remove exactly ONE occurrence. Change nothing else.
4. Write /mnt/data/candidate-schedule.json containing exactly {"schedule": <modified schedule>}.
5. Read it back.
6. Print FAILURE_INJECTION_RESULT= with unitId,className,day,hour.
7. In the structured response report the exact removed unitId/class/day/hour.
8. Explicitly reference /mnt/data/candidate-schedule.json in reply so the file is returned.

Do not repair anything. This attempt creates one controlled defect.
`,
      tools: [{
        type: "code_interpreter",
        container: { type: "auto", file_ids: [uploaded.id] },
      }],
      tool_choice: "required",
      text: {
        format: {
          type: "json_schema",
          name: "auto_repair_attempt_0_result",
          strict: true,
          schema: resultSchema,
        },
      },
      input: "Create the controlled one-hour defect now.",
    });

    const parsed = JSON.parse(response.output_text || "{}");
    const codeRuns = extractCodeRuns(response);
    const refs = extractContainerFileReferences(response, "candidate-schedule.json");
    const defaultContainerId =
      codeRuns.find((run) => run.containerId)?.containerId || null;
    const selectedRef =
      refs.find((ref) => ref.matchesExpectedName) || refs[0] || null;

    if (!selectedRef?.fileId) {
      throw new Error("Attempt 0 did not return candidate-schedule.json");
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

    const validation = validateSchedule({
      schedule: brokenSchedule,
      schoolData,
      approvedExceptions,
    });

    const beforeScheduled =
      Number(beforeValidation?.statistics?.totalScheduledHours || 0);
    const afterScheduled =
      Number(validation?.statistics?.totalScheduledHours || 0);

    const controlledDefectDetected =
      beforeScheduled - afterScheduled === 1 &&
      Number(validation?.statistics?.totalMissingHours || 0) >= 1;

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
      candidateFileBytes: Buffer.byteLength(candidateText, "utf8"),
    };

    return new Response(JSON.stringify({
      success: Boolean(
        parsed?.success &&
        codeRuns.some((run) => run.status === "completed") &&
        controlledDefectDetected
      ),
      phase: "attempt-0",
      injectedFailure: parsed?.injectedFailure || null,
      brokenSchedule,
      validation,
      beforeValidation,
      codeRuns,
      checks: {
        controlledDefectDetected,
        modelReportedSuccess: Boolean(parsed?.success),
        completedPython: codeRuns.some((run) => run.status === "completed"),
      },
      telemetry,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-repair attempt 0 failed:", error);
    return new Response(JSON.stringify({
      success: false,
      phase: "attempt-0",
      error: error?.message || "Unknown attempt-0 error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    if (uploadedFileId) {
      try {
        await client.files.delete(uploadedFileId);
      } catch (cleanupError) {
        console.warn("Failed to delete attempt-0 input file:", cleanupError);
      }
    }
  }
};
