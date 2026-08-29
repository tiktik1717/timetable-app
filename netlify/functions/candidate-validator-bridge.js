import OpenAI from "openai";
import { validateSchedule } from "../../src/scheduling/scheduleValidator.js";
import { evaluateFormalRules } from "../../src/scheduling/ruleEvaluator.js";

const client = new OpenAI({
  apiKey: process.env.SCHEDULING_OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

const bridgeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    success: { type: "boolean" },
    reply: { type: "string" },
    generatedFileName: { type: "string" },
    candidateSummary: {
      type: "object",
      additionalProperties: false,
      properties: {
        days: { type: "integer" },
        nonEmptyCells: { type: "integer" },
        scheduledUnitRefs: { type: "integer" },
      },
      required: ["days", "nonEmptyCells", "scheduledUnitRefs"],
    },
  },
  required: ["success", "reply", "generatedFileName", "candidateSummary"],
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
          type: annotation.type || null,
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

  // OpenAI JS SDK exposes container file content as a binary response.
  // Keep a raw-HTTP fallback because SDK binary wrappers can vary by version.
  try {
    const binary = await client.containers.files.content.retrieve(fileId, {
      container_id: containerId,
    });

    if (binary && typeof binary.text === "function") {
      return await binary.text();
    }
    if (binary && typeof binary.arrayBuffer === "function") {
      const buffer = Buffer.from(await binary.arrayBuffer());
      return buffer.toString("utf8");
    }
    if (binary?.response && typeof binary.response.text === "function") {
      return await binary.response.text();
    }
  } catch (sdkError) {
    console.warn("SDK container file retrieval failed; trying raw HTTP", sdkError);
  }

  const response = await fetch(
    `https://api.openai.com/v1/containers/${encodeURIComponent(containerId)}/files/${encodeURIComponent(fileId)}/content`,
    {
      headers: {
        Authorization: `Bearer ${process.env.SCHEDULING_OPENAI_API_KEY}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Unable to retrieve generated candidate file (${response.status})`,
    );
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
    const rules = Array.isArray(body?.rules) ? body.rules : [];

    if (!schoolData || typeof schoolData !== "object") {
      return new Response(JSON.stringify({ error: "schoolData is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!baseSchedule || typeof baseSchedule !== "object") {
      return new Response(JSON.stringify({ error: "baseSchedule is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const metadataPayload = {
      version: 1,
      purpose: "candidate-validator-bridge-v1-test",
      schoolData,
      schedule: baseSchedule,
    };
    const metadataText = JSON.stringify(metadataPayload, null, 2);
    const metadataFile = new File([metadataText], "metadata.json", {
      type: "application/json",
    });

    const uploaded = await client.files.create({
      file: metadataFile,
      purpose: "user_data",
      expires_after: { anchor: "created_at", seconds: 3600 },
    });
    uploadedFileId = uploaded.id;

    const model = "gpt-5.2";
    const startedAt = Date.now();
    const response = await client.responses.create({
      model,
      instructions: `
You are running Candidate -> Validator bridge infrastructure test v1.
You MUST use Python code_interpreter and MUST read the attached metadata.json file.

Inside Python:
1. Locate metadata.json and parse it.
2. Create a NEW JSON file at /mnt/data/candidate-schedule.json with exactly:
   {"schedule": <the schedule read from metadata.json>}
   Do not invent or change any timetable placement in this test.
3. Read candidate-schedule.json back with Python.
4. Count:
   - number of day keys
   - number of non-empty class/hour cells
   - total number of unit-id references stored in those non-empty cells
5. Print a compact line beginning CANDIDATE_BRIDGE_RESULT= with those counts.
6. In your final structured response, use generatedFileName="candidate-schedule.json".
7. IMPORTANT: In the reply field, explicitly reference/link the generated /mnt/data/candidate-schedule.json file so the API returns a container-file annotation for it.

Do not use network access. Keep the Python explicit and deterministic.
`,
      tools: [
        {
          type: "code_interpreter",
          container: { type: "auto", file_ids: [uploaded.id] },
        },
      ],
      tool_choice: "required",
      text: {
        format: {
          type: "json_schema",
          name: "candidate_validator_bridge_v1_result",
          strict: true,
          schema: bridgeSchema,
        },
      },
      input: "Run the Candidate -> Validator bridge test now.",
    });

    const parsed = JSON.parse(response.output_text || "{}");
    const codeRuns = extractCodeRuns(response);
    const fileRefs = extractContainerFileReferences(
      response,
      "candidate-schedule.json",
    );
    const defaultContainerId = codeRuns.find((run) => run.containerId)?.containerId || null;
    const selectedRef =
      fileRefs.find((ref) => ref.matchesExpectedName) || fileRefs[0] || null;

    if (!selectedRef?.fileId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Python created a result, but the generated candidate file was not returned with a container-file annotation.",
          modelResult: parsed,
          codeRuns,
          fileRefs,
          diagnostic: {
            outputItemTypes: (response.output || []).map((item) => item?.type || "unknown"),
            responseId: response.id || null,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
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

    const validation = validateSchedule({
      schedule: candidateSchedule,
      schoolData,
      approvedExceptions,
    });
    const formalRules = evaluateFormalRules({
      rules,
      schedule: candidateSchedule,
      schoolData,
      baselineSchedule: baseSchedule,
    });

    const usage = response.usage || {};
    const telemetry = {
      model: response.model || model,
      inputTokens: usage.input_tokens ?? usage.inputTokens ?? 0,
      outputTokens: usage.output_tokens ?? usage.outputTokens ?? 0,
      totalTokens:
        usage.total_tokens ??
        usage.totalTokens ??
        (usage.input_tokens || 0) + (usage.output_tokens || 0),
      durationMs: Date.now() - startedAt,
      inputFileBytes: Buffer.byteLength(metadataText, "utf8"),
      candidateFileBytes: Buffer.byteLength(candidateText, "utf8"),
      codeInterpreterCalls: codeRuns.length,
      containerIds: [...new Set(codeRuns.map((run) => run.containerId).filter(Boolean))],
    };

    const usedPython = codeRuns.some((run) => (run.code || "").trim().length > 0);
    const completedPython = codeRuns.some((run) => run.status === "completed");
    const bridgePassed = Boolean(
      parsed?.success &&
      usedPython &&
      completedPython &&
      validation?.valid
    );

    return new Response(
      JSON.stringify({
        success: bridgePassed,
        modelResult: parsed,
        checks: {
          modelReportedSuccess: Boolean(parsed?.success),
          usedPython,
          completedPython,
          candidateFileRetrieved: true,
          candidateJsonParsed: true,
          validatorRan: true,
          coreValid: Boolean(validation?.valid),
        },
        validation,
        formalRules,
        codeRuns,
        generatedFile: {
          filename: selectedRef.filename || "candidate-schedule.json",
          fileId: selectedRef.fileId,
          containerId: selectedRef.containerId || defaultContainerId,
          bytes: telemetry.candidateFileBytes,
        },
        telemetry,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Candidate -> Validator bridge v1 failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Unknown Candidate -> Validator bridge error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    if (uploadedFileId) {
      try {
        await client.files.delete(uploadedFileId);
      } catch (cleanupError) {
        console.warn("Failed to delete bridge input file:", cleanupError);
      }
    }
  }
};
