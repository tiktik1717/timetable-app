import { deleteFiles, jsonResponse } from "../lib/auto-repair-async-shared.js";

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }
    const body = await request.json();
    const fileIds = Array.isArray(body?.fileIds) ? body.fileIds : [];
    await deleteFiles(fileIds);
    return jsonResponse({ success: true, deleted: fileIds.length });
  } catch (error) {
    return jsonResponse(
      { success: false, error: error?.message || "Cleanup failed" },
      500,
    );
  }
};
