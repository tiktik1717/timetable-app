import OpenAI from "openai";

export const client = new OpenAI({
  apiKey: process.env.SCHEDULING_OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

export const MODEL = "gpt-5.2";

export const failureResultSchema = {
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

export const repairResultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    success: { type: "boolean" },
    reply: { type: "string" },
    generatedFileName: { type: "string" },
  },
  required: ["success", "reply", "generatedFileName"],
};

export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text) {
    return response.output_text;
  }
  const parts = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n");
}

export function extractCodeRuns(response) {
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

export function extractContainerFileReferences(response, expectedName) {
  const refs = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const part of item.content || []) {
      if (part?.type !== "output_text") continue;
      for (const annotation of part.annotations || []) {
        const filename =
          annotation?.filename || annotation?.file_path?.filename || null;
        const fileId =
          annotation?.file_id || annotation?.file_path?.file_id || null;
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


export async function findContainerFileByName(containerId, expectedName) {
  if (!containerId || !expectedName) return null;

  // Primary path: SDK list API.
  try {
    const page = await client.containers.files.list({
      container_id: containerId,
      limit: 100,
    });
    const items = page?.data || page?.items || [];
    const match = items.find((item) => {
      const name = item?.path || item?.filename || item?.name || "";
      return (
        name === expectedName ||
        name === `/mnt/data/${expectedName}` ||
        String(name).endsWith(`/${expectedName}`)
      );
    });
    if (match?.id) {
      return {
        fileId: match.id,
        containerId,
        filename:
          match.path || match.filename || match.name || expectedName,
        source: "container-list-sdk",
      };
    }
  } catch (sdkError) {
    console.warn(
      "SDK container file listing failed; trying raw HTTP",
      sdkError,
    );
  }

  // Fallback path: raw Containers API. This also makes diagnostics independent
  // of minor SDK method-shape changes.
  try {
    const response = await fetch(
      `https://api.openai.com/v1/containers/${encodeURIComponent(containerId)}/files?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SCHEDULING_OPENAI_API_KEY}`,
        },
      },
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const items = payload?.data || [];
    const match = items.find((item) => {
      const name = item?.path || item?.filename || item?.name || "";
      return (
        name === expectedName ||
        name === `/mnt/data/${expectedName}` ||
        String(name).endsWith(`/${expectedName}`)
      );
    });
    if (match?.id) {
      return {
        fileId: match.id,
        containerId,
        filename:
          match.path || match.filename || match.name || expectedName,
        source: "container-list-http",
      };
    }
  } catch (httpError) {
    console.warn("Raw container file listing failed", httpError);
  }

  return null;
}

export async function retrieveContainerFileText({ containerId, fileId }) {
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

export function responseTelemetry(response, startedAt = null) {
  const usage = response?.usage || {};
  const inferredStartedAt =
    startedAt ||
    (Number(response?.created_at) > 0
      ? Number(response.created_at) * 1000
      : null);
  return {
    model: response?.model || MODEL,
    calls: 1,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    totalTokens:
      usage.total_tokens ??
      ((usage.input_tokens || 0) + (usage.output_tokens || 0)),
    durationMs: inferredStartedAt ? Math.max(0, Date.now() - inferredStartedAt) : 0,
  };
}

export async function deleteFiles(fileIds = []) {
  for (const fileId of fileIds || []) {
    if (!fileId) continue;
    try {
      await client.files.delete(fileId);
    } catch (error) {
      console.warn("Failed to delete temporary OpenAI file", fileId, error);
    }
  }
}
