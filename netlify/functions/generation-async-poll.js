import { client, jsonResponse } from "../lib/auto-repair-async-shared.js";
const TERMINAL = new Set(["completed", "failed", "cancelled", "incomplete"]);
export default async (request) => {
  try {
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    const { responseId } = await request.json();
    if (!responseId) return jsonResponse({ error: "responseId is required" }, 400);
    const response = await client.responses.retrieve(responseId);
    return jsonResponse({ success: true, responseId, status: response?.status || "unknown", terminal: TERMINAL.has(response?.status), error: response?.error || response?.incomplete_details || null });
  } catch (error) { return jsonResponse({ success: false, error: error?.message || "Unknown polling error" }, 500); }
};
