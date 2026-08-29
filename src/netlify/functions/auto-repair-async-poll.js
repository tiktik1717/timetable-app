import { client, jsonResponse } from "../lib/auto-repair-async-shared.js";

const TERMINAL = new Set(["completed", "failed", "cancelled", "incomplete"]);

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }
    const body = await request.json();
    const responseId = body?.responseId;
    if (!responseId) {
      return jsonResponse({ error: "responseId is required" }, 400);
    }

    const response = await client.responses.retrieve(responseId);
    const status = response?.status || "unknown";

    return jsonResponse({
      success: true,
      responseId,
      status,
      terminal: TERMINAL.has(status),
      error:
        status === "failed" || status === "incomplete"
          ? response?.error || response?.incomplete_details || null
          : null,
    });
  } catch (error) {
    console.error("Async response poll failed:", error);
    return jsonResponse(
      { success: false, error: error?.message || "Unknown polling error" },
      500,
    );
  }
};
