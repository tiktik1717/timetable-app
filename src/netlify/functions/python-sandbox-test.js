import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.SCHEDULING_OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

const sandboxResultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    success: { type: "boolean" },
    reply: { type: "string" },
    result: {
      type: "object",
      additionalProperties: false,
      properties: {
        teacherCount: { type: "integer" },
        classCount: { type: "integer" },
        teachingUnitCount: { type: "integer" },
      },
      required: ["teacherCount", "classCount", "teachingUnitCount"],
    },
    generatedFileName: { type: "string" },
  },
  required: ["success", "reply", "result", "generatedFileName"],
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

export default async (request) => {
  let uploadedFileId = null;

  try {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = await request.json();
    const schoolData = body?.schoolData;

    if (!schoolData || typeof schoolData !== "object") {
      return new Response(
        JSON.stringify({ error: "schoolData is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const metadataPayload = {
      version: 1,
      purpose: "python-sandbox-v1-test",
      schoolData,
    };

    const metadataText = JSON.stringify(metadataPayload, null, 2);
    const metadataFile = new File(
      [metadataText],
      "metadata.json",
      { type: "application/json" },
    );

    const uploaded = await client.files.create({
      file: metadataFile,
      purpose: "user_data",
      expires_after: {
        anchor: "created_at",
        seconds: 3600,
      },
    });

    uploadedFileId = uploaded.id;

    const model = "gpt-5.2";
    const startedAt = Date.now();

    const response = await client.responses.create({
      model,
      instructions: `
You are running a narrow infrastructure test for a school timetable agent.
You MUST use the Python code_interpreter tool. Do not answer from the prompt alone.

Inside the sandbox:
1. Locate and read the attached metadata.json file.
2. Parse the JSON.
3. Count schoolData.teachers, schoolData.classes, and schoolData.teachingUnits.
4. Create /mnt/data/result.json containing exactly these three integer fields:
   teacherCount, classCount, teachingUnitCount.
5. Read result.json back with Python and print one log line beginning with SANDBOX_RESULT= followed by compact JSON.
6. Return the same three values in the required structured response.

Do not modify the input file. Do not use network access. Keep the Python code short and explicit.
`,
      tools: [
        {
          type: "code_interpreter",
          container: {
            type: "auto",
            file_ids: [uploaded.id],
          },
        },
      ],
      tool_choice: "required",
      text: {
        format: {
          type: "json_schema",
          name: "python_sandbox_v1_test_result",
          strict: true,
          schema: sandboxResultSchema,
        },
      },
      input: "Run the Python sandbox test now.",
    });

    const parsed = JSON.parse(response.output_text || "{}");
    const codeRuns = extractCodeRuns(response);
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
      codeInterpreterCalls: codeRuns.length,
      containerIds: [...new Set(codeRuns.map((run) => run.containerId).filter(Boolean))],
    };

    const usedPython = codeRuns.some((run) => (run.code || "").trim().length > 0);
    const completedPython = codeRuns.some((run) => run.status === "completed");
    const hasExpectedLog = codeRuns.some((run) =>
      (run.logs || "").includes("SANDBOX_RESULT="),
    );

    const expectedCounts = {
      teacherCount: Array.isArray(schoolData.teachers) ? schoolData.teachers.length : 0,
      classCount: Array.isArray(schoolData.classes) ? schoolData.classes.length : 0,
      teachingUnitCount: Array.isArray(schoolData.teachingUnits)
        ? schoolData.teachingUnits.length
        : 0,
    };

    const countsMatch =
      parsed?.result?.teacherCount === expectedCounts.teacherCount &&
      parsed?.result?.classCount === expectedCounts.classCount &&
      parsed?.result?.teachingUnitCount === expectedCounts.teachingUnitCount;

    // The infrastructure test should prove that Python actually ran and produced
    // the correct result. A specific stdout marker is useful diagnostics, but it
    // must not turn a successful Code Interpreter run into a false failure.
    const infrastructurePassed = Boolean(
      parsed?.success &&
      usedPython &&
      completedPython &&
      countsMatch
    );

    const checks = {
      modelReportedSuccess: Boolean(parsed?.success),
      usedPython,
      completedPython,
      countsMatch,
      hasExpectedLog,
      codeInterpreterCalls: codeRuns.length,
    };

    return new Response(
      JSON.stringify({
        ...parsed,
        success: infrastructurePassed,
        checks,
        expectedCounts,
        codeRuns,
        telemetry,
        diagnostic: infrastructurePassed
          ? null
          : {
              message: "Python Sandbox infrastructure test did not satisfy all required checks.",
              responseStatus: response.status || null,
              responseId: response.id || null,
              outputItemTypes: (response.output || []).map((item) => item?.type || "unknown"),
            },
        inputFile: {
          name: "metadata.json",
          bytes: telemetry.inputFileBytes,
          expiresInSeconds: 3600,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Python sandbox v1 test failed:", error);

    return new Response(
      JSON.stringify({
        error: error?.message || "Unknown Python sandbox error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    if (uploadedFileId) {
      try {
        await client.files.delete(uploadedFileId);
      } catch (cleanupError) {
        console.warn("Failed to delete temporary sandbox input file:", cleanupError);
      }
    }
  }
};
