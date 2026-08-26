import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.SCHEDULING_OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractOutputText(response) {
  if (
    typeof response?.output_text === "string" &&
    response.output_text
  ) {
    return response.output_text;
  }

  const parts = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;

    for (const content of item.content || []) {
      if (
        content?.type === "output_text" &&
        typeof content.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n");
}

function telemetry(response, startedAt = null) {
  const usage = response?.usage || {};

  return {
    model: response?.model || "gpt-5.2",
    calls: 1,
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    totalTokens:
      usage.total_tokens ||
      (usage.input_tokens || 0) +
        (usage.output_tokens || 0),
    durationMs:
      startedAt != null
        ? Math.max(0, Date.now() - Number(startedAt))
        : 0,
  };
}

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Method not allowed" },
        405,
      );
    }

    const body = await request.json();
    const responseId = body?.responseId;
    const startedAt = body?.startedAt || null;

    if (!responseId) {
      return jsonResponse(
        { error: "responseId is required" },
        400,
      );
    }

    const response =
      await client.responses.retrieve(responseId);

    if (response?.status !== "completed") {
      return jsonResponse(
        {
          success: true,
          completed: false,
          phase: "rule-compiler-pending",
          responseId,
          status:
            response?.status || "unknown",
        },
        200,
      );
    }

    const outputText =
      extractOutputText(response);

    if (!outputText) {
      return jsonResponse(
        {
          success: false,
          completed: true,
          error:
            "Rule Compiler completed without output text.",
          telemetry: telemetry(
            response,
            startedAt,
          ),
        },
        200,
      );
    }

    const parsed = JSON.parse(outputText);

    const compiledRules =
      (parsed.compiledRules || []).map(
        (item) => {
          if (
            item.formalizationStatus !==
              "formalized" ||
            !item.formalRuleJson
          ) {
            return item;
          }

          try {
            JSON.parse(item.formalRuleJson);
            return item;
          } catch {
            return {
              ...item,
              formalizationStatus:
                "semantic_only",
              evaluatorKey: "unsupported",
              clarificationQuestion: null,
              explanation:
                `${item.explanation} [Compiler guard: formalRuleJson was not valid JSON.]`,
              formalRuleJson: null,
            };
          }
        },
      );

    return jsonResponse({
      success: true,
      completed: true,
      phase: "rule-compiler-completed",
      compiledRules,
      telemetry: {
        ...telemetry(response, startedAt),
        ruleCount: compiledRules.length,
      },
    });
  } catch (error) {
    console.error(
      "Async Rule Compiler collect failed:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        completed: true,
        error:
          error?.message ||
          "Unknown Rule Compiler collect error",
      },
      500,
    );
  }
};
