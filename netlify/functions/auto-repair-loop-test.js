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
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
    }
    const body = await request.json();
    const schoolData = body?.schoolData;
    const baseSchedule = body?.baseSchedule;
    const approvedExceptions = Array.isArray(body?.approvedExceptions) ? body.approvedExceptions : [];
    if (!schoolData || !baseSchedule) {
      return new Response(JSON.stringify({ error: "schoolData and baseSchedule are required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const baseValidation = validateSchedule({ schedule: baseSchedule, schoolData, approvedExceptions });
    const metadataText = JSON.stringify({ version: 1, purpose: "auto-repair-loop-v1", schoolData, schedule: baseSchedule }, null, 2);
    const metadataUpload = await client.files.create({
      file: new File([metadataText], "metadata.json", { type: "application/json" }),
      purpose: "user_data", expires_after: { anchor: "created_at", seconds: 3600 },
    });
    uploadedFileIds.push(metadataUpload.id);

    const model = "gpt-5.2";
    const startedAt = Date.now();

    // Attempt 0: create one controlled defect. This is deliberately deterministic in intent,
    // but the Python code itself is authored by the model.
    const injectResponse = await client.responses.create({
      model,
      instructions: `You are attempt 0 of an auto-repair infrastructure test. You MUST use Python code_interpreter and read metadata.json. Deep-copy schedule. Find the FIRST ordinary teaching-unit occurrence whose teachingUnit.constraintGroupId is null and teachingUnit.className equals the scanned class. Remove exactly ONE occurrence and alter nothing else. Write /mnt/data/candidate-schedule.json containing exactly {"schedule": <modified schedule>}. Read it back. Print FAILURE_INJECTION_RESULT= with unitId,className,day,hour. In your reply explicitly reference /mnt/data/candidate-schedule.json so it is returned as a container file.`,
      tools: [{ type: "code_interpreter", container: { type: "auto", file_ids: [metadataUpload.id] } }],
      tool_choice: "required",
      input: "Create the controlled one-hour defect now.",
    });
    const injectRuns = extractCodeRuns(injectResponse);
    const injectRefs = extractContainerFileReferences(injectResponse, "candidate-schedule.json");
    const injectContainer = injectRuns.find((r) => r.containerId)?.containerId || null;
    const injectRef = injectRefs.find((r) => r.matchesExpectedName) || injectRefs[0];
    if (!injectRef?.fileId) throw new Error("Attempt 0 did not return candidate-schedule.json");
    const brokenText = await retrieveContainerFileText({ containerId: injectRef.containerId || injectContainer, fileId: injectRef.fileId });
    const brokenPayload = JSON.parse(brokenText);
    const brokenSchedule = brokenPayload?.schedule;
    if (!brokenSchedule) throw new Error("Attempt 0 candidate has no schedule");
    const brokenValidation = validateSchedule({ schedule: brokenSchedule, schoolData, approvedExceptions });

    const beforeScheduled = Number(baseValidation?.statistics?.totalScheduledHours || 0);
    const brokenScheduled = Number(brokenValidation?.statistics?.totalScheduledHours || 0);
    const controlledDefectDetected = beforeScheduled - brokenScheduled === 1 && Number(brokenValidation?.statistics?.totalMissingHours || 0) >= 1;
    if (!controlledDefectDetected) throw new Error("Attempt 0 did not create the expected one-hour missing-unit defect");

    // Upload ONLY the broken candidate + Validator feedback for attempt 1.
    // The repair model is not told which cell was removed and does not receive the pristine schedule.
    const brokenUpload = await client.files.create({
      file: new File([brokenText], "broken-candidate.json", { type: "application/json" }),
      purpose: "user_data", expires_after: { anchor: "created_at", seconds: 3600 },
    });
    uploadedFileIds.push(brokenUpload.id);
    const repairMetadataText = JSON.stringify({ version: 1, purpose: "auto-repair-loop-v1-repair", schoolData }, null, 2);
    const repairMetaUpload = await client.files.create({
      file: new File([repairMetadataText], "school-metadata.json", { type: "application/json" }),
      purpose: "user_data", expires_after: { anchor: "created_at", seconds: 3600 },
    });
    uploadedFileIds.push(repairMetaUpload.id);

    const compactFeedback = {
      valid: brokenValidation.valid,
      errors: brokenValidation.errors,
      warnings: brokenValidation.warnings,
      missingUnits: brokenValidation.missingUnits,
      statistics: brokenValidation.statistics,
    };

    const repairResponse = await client.responses.create({
      model,
      instructions: `You are attempt 1 of an autonomous timetable repair test. You MUST use Python code_interpreter. You receive broken-candidate.json, school-metadata.json, and the Validator report in the user message. You DO NOT have the pristine timetable and you are NOT told which cell was removed. Diagnose the Validator feedback and repair the candidate with the smallest possible change. Respect schoolData constraints. Write /mnt/data/repaired-candidate.json containing exactly {"schedule": <repaired schedule>}. Read it back. Print AUTO_REPAIR_RESULT= with a compact description of what you changed. In your reply explicitly reference /mnt/data/repaired-candidate.json so the file is returned. Do not merely explain a repair: execute Python and create the file.`,
      tools: [{ type: "code_interpreter", container: { type: "auto", file_ids: [brokenUpload.id, repairMetaUpload.id] } }],
      tool_choice: "required",
      text: { format: { type: "json_schema", name: "auto_repair_v1_result", strict: true, schema: repairResultSchema } },
      input: `VALIDATOR_REPORT\n${JSON.stringify(compactFeedback)}`,
    });
    const repairParsed = JSON.parse(repairResponse.output_text || "{}");
    const repairRuns = extractCodeRuns(repairResponse);
    const repairRefs = extractContainerFileReferences(repairResponse, "repaired-candidate.json");
    const repairContainer = repairRuns.find((r) => r.containerId)?.containerId || null;
    const repairRef = repairRefs.find((r) => r.matchesExpectedName) || repairRefs[0];
    if (!repairRef?.fileId) throw new Error("Attempt 1 did not return repaired-candidate.json");
    const repairedText = await retrieveContainerFileText({ containerId: repairRef.containerId || repairContainer, fileId: repairRef.fileId });
    const repairedPayload = JSON.parse(repairedText);
    const repairedSchedule = repairedPayload?.schedule;
    if (!repairedSchedule) throw new Error("Attempt 1 candidate has no schedule");
    const repairedValidation = validateSchedule({ schedule: repairedSchedule, schoolData, approvedExceptions });

    const repairedToFull = Number(repairedValidation?.statistics?.totalScheduledHours || 0) === Number(repairedValidation?.statistics?.totalRequiredHours || 0);
    const finalClean = repairedValidation.valid && Number(repairedValidation?.statistics?.warningCount || 0) === 0 && Number(repairedValidation?.statistics?.totalMissingHours || 0) === 0 && Number(repairedValidation?.statistics?.totalExtraHours || 0) === 0;
    const success = Boolean(controlledDefectDetected && repairParsed?.success && repairRuns.some((r) => r.status === "completed") && repairedToFull && finalClean);

    const u0=injectResponse.usage||{}, u1=repairResponse.usage||{};
    const telemetry = {
      model: repairResponse.model || injectResponse.model || model,
      calls: 2,
      inputTokens: (u0.input_tokens||0)+(u1.input_tokens||0),
      outputTokens: (u0.output_tokens||0)+(u1.output_tokens||0),
      totalTokens: (u0.total_tokens||0)+(u1.total_tokens||0),
      durationMs: Date.now()-startedAt,
      attempt0: { inputTokens:u0.input_tokens||0, outputTokens:u0.output_tokens||0, totalTokens:u0.total_tokens||0 },
      attempt1: { inputTokens:u1.input_tokens||0, outputTokens:u1.output_tokens||0, totalTokens:u1.total_tokens||0 },
    };

    return new Response(JSON.stringify({
      success,
      attempts: [
        { number: 0, purpose: "inject-controlled-defect", validation: brokenValidation, codeRuns: injectRuns, candidateBytes: Buffer.byteLength(brokenText,"utf8") },
        { number: 1, purpose: "autonomous-repair-from-validator-feedback", validation: repairedValidation, codeRuns: repairRuns, candidateBytes: Buffer.byteLength(repairedText,"utf8"), reply: repairParsed?.reply || "" },
      ],
      checks: { controlledDefectDetected, repairModelReportedSuccess:Boolean(repairParsed?.success), repairedToFull, finalClean },
      telemetry,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Auto-repair loop v1 failed:", error);
    return new Response(JSON.stringify({ success:false, error:error?.message || "Unknown auto-repair error" }), { status:500, headers:{"Content-Type":"application/json"} });
  } finally {
    for (const id of uploadedFileIds) {
      try { await client.files.delete(id); } catch (e) { console.warn("Failed to delete auto-repair temp file", id, e); }
    }
  }
};
