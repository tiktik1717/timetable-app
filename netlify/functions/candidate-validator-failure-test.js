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
      return new Response(JSON.stringify({ error: "schoolData and baseSchedule are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const beforeValidation = validateSchedule({
      schedule: baseSchedule,
      schoolData,
      approvedExceptions,
    });

    const metadataText = JSON.stringify({
      version: 1,
      purpose: "candidate-validator-failure-injection-v1",
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
You are running an intentional Candidate -> Validator FAILURE-INJECTION infrastructure test.
You MUST use Python code_interpreter and MUST read the attached metadata.json.

Inside Python do exactly this:
1. Parse metadata.json and deep-copy its schedule.
2. Build a lookup of teachingUnits by id from schoolData.teachingUnits.
3. Scan day -> class -> hour cells and find the FIRST unit-id reference that:
   - is a real teachingUnit,
   - has constraintGroupId == null,
   - and the teachingUnit.className equals the class currently being scanned.
4. Remove exactly ONE occurrence of that unit id from that one cell. Do not move or alter anything else.
5. Create /mnt/data/candidate-schedule.json containing exactly {"schedule": <modified schedule>}.
6. Read the file back with Python.
7. Print one compact line beginning FAILURE_INJECTION_RESULT= and include unitId,className,day,hour.
8. In the structured response, report the exact removed unitId/class/day/hour and generatedFileName="candidate-schedule.json".
9. In reply, explicitly reference/link /mnt/data/candidate-schedule.json so the API returns a container-file annotation.

The goal is NOT to repair the timetable. The goal is to create one controlled missing-hour defect and let the JavaScript Validator detect it.
No network access.
`,
      tools: [{
        type: "code_interpreter",
        container: { type: "auto", file_ids: [uploaded.id] },
      }],
      tool_choice: "required",
      text: {
        format: {
          type: "json_schema",
          name: "candidate_validator_failure_injection_v1_result",
          strict: true,
          schema: resultSchema,
        },
      },
      input: "Run the intentional failure-injection test now.",
    });

    const parsed = JSON.parse(response.output_text || "{}");
    const codeRuns = extractCodeRuns(response);
    const refs = extractContainerFileReferences(response, "candidate-schedule.json");
    const defaultContainerId = codeRuns.find((run) => run.containerId)?.containerId || null;
    const selectedRef = refs.find((ref) => ref.matchesExpectedName) || refs[0] || null;

    if (!selectedRef?.fileId) {
      throw new Error("Python ran but candidate-schedule.json was not returned as a container file");
    }

    const candidateText = await retrieveContainerFileText({
      containerId: selectedRef.containerId || defaultContainerId,
      fileId: selectedRef.fileId,
    });
    const candidatePayload = JSON.parse(candidateText);
    const candidateSchedule = candidatePayload?.schedule;
    if (!candidateSchedule || typeof candidateSchedule !== "object") {
      throw new Error("candidate-schedule.json does not contain a schedule object");
    }

    const afterValidation = validateSchedule({
      schedule: candidateSchedule,
      schoolData,
      approvedExceptions,
    });

    const beforeScheduled = Number(beforeValidation?.statistics?.totalScheduledHours || 0);
    const afterScheduled = Number(afterValidation?.statistics?.totalScheduledHours || 0);
    const missingDelta = Number(afterValidation?.statistics?.totalMissingHours || 0) -
      Number(beforeValidation?.statistics?.totalMissingHours || 0);
    const warningDelta = Number(afterValidation?.statistics?.warningCount || 0) -
      Number(beforeValidation?.statistics?.warningCount || 0);
    const errorDelta = Number(afterValidation?.statistics?.errorCount || 0) -
      Number(beforeValidation?.statistics?.errorCount || 0);

    const usedPython = codeRuns.some((run) => (run.code || "").trim().length > 0);
    const completedPython = codeRuns.some((run) => run.status === "completed");
    const injectedExactlyOneReference = beforeScheduled - afterScheduled === 1;
    const validatorDetectedDefect = missingDelta >= 1 || warningDelta >= 1 || errorDelta >= 1;

    // `success` here means the TEST succeeded: Python created a deliberate defect
    // and the Validator detected it. The candidate itself is intentionally invalid/incomplete.
    const testPassed = Boolean(
      parsed?.success &&
      usedPython &&
      completedPython &&
      injectedExactlyOneReference &&
      validatorDetectedDefect
    );

    const usage = response.usage || {};
    const telemetry = {
      model: response.model || model,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      totalTokens: usage.total_tokens ?? ((usage.input_tokens || 0) + (usage.output_tokens || 0)),
      durationMs: Date.now() - startedAt,
      inputFileBytes: Buffer.byteLength(metadataText, "utf8"),
      candidateFileBytes: Buffer.byteLength(candidateText, "utf8"),
      codeInterpreterCalls: codeRuns.length,
    };

    return new Response(JSON.stringify({
      success: testPassed,
      intentionalFailure: true,
      injectedFailure: parsed?.injectedFailure || null,
      checks: {
        modelReportedSuccess: Boolean(parsed?.success),
        usedPython,
        completedPython,
        candidateFileRetrieved: true,
        injectedExactlyOneReference,
        validatorDetectedDefect,
      },
      beforeValidation,
      validation: afterValidation,
      deltas: {
        scheduledHours: afterScheduled - beforeScheduled,
        missingHours: missingDelta,
        warnings: warningDelta,
        errors: errorDelta,
      },
      codeRuns,
      generatedFile: {
        filename: selectedRef.filename || "candidate-schedule.json",
        fileId: selectedRef.fileId,
        containerId: selectedRef.containerId || defaultContainerId,
        bytes: telemetry.candidateFileBytes,
      },
      telemetry,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Candidate failure-injection test failed:", error);
    return new Response(JSON.stringify({
      success: false,
      intentionalFailure: true,
      error: error?.message || "Unknown failure-injection test error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    if (uploadedFileId) {
      try {
        await client.files.delete(uploadedFileId);
      } catch (cleanupError) {
        console.warn("Failed to delete failure-test input file:", cleanupError);
      }
    }
  }
};
