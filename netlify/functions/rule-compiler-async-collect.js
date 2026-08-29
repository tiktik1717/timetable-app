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


function tryParseFormalRuleJson(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, value: null };
  }

  const candidates = [];
  const raw = value.trim();
  candidates.push(raw);

  // Models occasionally wrap an otherwise valid JSON object in markdown.
  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (withoutFence !== raw) candidates.push(withoutFence);

  // If explanatory text leaked around the JSON, try the outermost object.
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(withoutFence.slice(firstBrace, lastBrace + 1));
  }

  // Conservative repairs for common serialization slips. Every repaired
  // candidate is still accepted ONLY if JSON.parse validates it.
  for (const candidate of [...candidates]) {
    candidates.push(
      candidate.replace(/,\s*([}\]])/g, "$1"),
    );

    // Smart quotes sometimes leak into JSON punctuation.
    candidates.push(
      candidate
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, "$1"),
    );

    // Python-ish literals occasionally appear in otherwise JSON-shaped output.
    candidates.push(
      candidate
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false")
        .replace(/\bNone\b/g, "null")
        .replace(/,\s*([}\]])/g, "$1"),
    );

    // Single-quoted JSON-like strings are not valid JSON. This repair is
    // intentionally conservative and only targets simple quoted tokens.
    candidates.push(
      candidate
        .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, body) =>
          JSON.stringify(body.replace(/\\'/g, "'"))
        )
        .replace(/,\s*([}\]])/g, "$1"),
    );

    // Quote simple unquoted object keys.
    candidates.push(
      candidate
        .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
        .replace(/,\s*([}\]])/g, "$1"),
    );
  }

  for (const candidate of [...new Set(candidates)]) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        ok: true,
        value: JSON.stringify(parsed),
      };
    } catch {
      // Try next candidate.
    }
  }

  return { ok: false, value: null };
}


function hasMeaningfulSemanticRemainder(item) {
  if (item?.formalizationStatus !== "formalized") return false;
  const remainder = String(
    item?.formalCoverage?.semanticOnly ?? "",
  ).trim();
  if (!remainder) return false;

  const normalized = remainder
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return ![
    "אין",
    "ללא",
    "none",
    "n/a",
    "לא",
    "-",
  ].includes(normalized);
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
          const expectsFormalJson =
            item.formalizationStatus === "formalized" ||
            item.formalizationStatus === "partially_formalized";

          if (!expectsFormalJson || !item.formalRuleJson) {
            const unsupported =
              item?.capabilityPlan?.unsupportedRequirements || [];
            if (
              item.formalizationStatus === "semantic_only" &&
              item.ruleKind !== "comparison_objective" &&
              item.ruleKind !== "search_strategy" &&
              unsupported.length === 0
            ) {
              return {
                ...item,
                explanation:
                  `${item.explanation || ""} [Capability guard: semantic_only returned without any unsupported requirement; review compiler planning.]`,
              };
            }
            return item;
          }

          const parsedFormalRule =
            tryParseFormalRuleJson(item.formalRuleJson);

          if (parsedFormalRule.ok) {
            const canonicalItem = {
              ...item,
              formalRuleJson: parsedFormalRule.value,
            };

            // Safety guard: a rule cannot claim full formalization while
            // simultaneously declaring a meaningful semantic remainder.
            if (hasMeaningfulSemanticRemainder(canonicalItem)) {
              return {
                ...canonicalItem,
                formalizationStatus: "partially_formalized",
                explanation:
                  `${canonicalItem.explanation} [Compiler guard: meaningful semantic remainder => partially_formalized.]`,
              };
            }

            return canonicalItem;
          }

          // Never pretend an invalid JSON artifact is deterministically
          // enforceable. Preserve the understood semantics, but make the
          // downgrade explicit and remove evaluator support.
          return {
            ...item,
            formalizationStatus: "semantic_only",
            evaluatorKey: "unsupported",
            clarificationQuestion: null,
            formalCoverage: {
              covered: "",
              semanticOnly:
                item.semanticGuidance ||
                item.interpretation ||
                "החוק מובן אך הייצוג הפורמלי שהוחזר לא היה JSON תקין.",
            },
            explanation:
              `${item.explanation} [Compiler guard: formalRuleJson remained invalid after conservative repair.]`,
            formalRuleJson: null,
          };
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
