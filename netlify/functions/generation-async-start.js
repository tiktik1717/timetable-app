import { client, MODEL, jsonResponse } from "../lib/auto-repair-async-shared.js";
import { validateSchedule } from "../../src/scheduling/scheduleValidator.js";
import { evaluateFormalRules } from "../../src/scheduling/ruleEvaluator.js";

const resultSchema = {
  type: "object", additionalProperties: false,
  properties: {
    success: { type: "boolean" },
    reply: { type: "string" },
    generatedFileName: { type: "string" },
    strategySummary: { type: "string" },
  },
  required: ["success", "reply", "generatedFileName", "strategySummary"],
};

export default async (request) => {
  try {
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    const body = await request.json();
    const schoolData = body?.schoolData;
    const schedule = body?.schedule;
    const rules = Array.isArray(body?.rules) ? body.rules : [];
    const approvedExceptions = Array.isArray(body?.approvedExceptions) ? body.approvedExceptions : [];
    const baselineSchedule = body?.baselineSchedule || null;
    if (!schoolData || !schedule) return jsonResponse({ error: "schoolData and schedule are required" }, 400);

    const validation = validateSchedule({ schedule, schoolData, approvedExceptions });
    const formalEvaluations = evaluateFormalRules({ rules, schedule, schoolData, baselineSchedule });
    const payload = { version: 1, purpose: "generation-run-v1", schoolData, schedule, rules, validation, formalEvaluations };
    const upload = await client.files.create({
      file: new File([JSON.stringify(payload)], "generation-input.json", { type: "application/json" }),
      purpose: "user_data", expires_after: { anchor: "created_at", seconds: 3600 },
    });

    const response = await client.responses.create({
      model: MODEL,
      background: true,
      instructions: `
You are Generation Run #1 for a real school timetable. Your task is to create the best next FULL candidate from an initially empty or partially generated timetable.
You MUST use Python code_interpreter and read generation-input.json.

This is an observation experiment: write the scheduling/search logic yourself in Python. Do not merely explain a plan. Do not assume a prebuilt solver library beyond Python standard library.

Hard priorities, in order:
1. Never lose already-valid placements without a reason.
2. Maximize scheduled required teaching hours.
3. Minimize Core Validator errors. Prefer zero Core errors even if some hours remain missing.
4. Respect formal hard constraints in rules. Treat recommended/soft rules as optimization preferences after feasibility.
5. Preserve teaching-unit hour counts exactly; never create unknown unit IDs.

Known data contract:
- input["schoolData"]["teachingUnits"] contains id, hours, className, teacherId, subject, constraintGroupId and other metadata.
- input["schedule"][day][className][hourString] is null or a list of unit IDs.
- dailyHoursByClass, teachers.freeDays / blockedHours, constraintGroups and compiled formal rules are in the input.
- validation and formalEvaluations describe the current candidate.

Use a small number of substantial Python runs. In Python, build indexes and a finite search procedure. Start with highly constrained units/groups, use legal-slot filtering, teacher occupancy checks, and backtracking/repair when greedy placement blocks progress. Group-linked units may need coordinated placement; inspect their metadata/rules rather than treating them as unrelated singletons.

IMPORTANT experimental trace requirement:
- Print concise markers GEN_PHASE=... for major phases.
- Print GEN_PROGRESS={...} whenever you obtain a materially better candidate (scheduled count, missing count, and any internally detected conflicts).
- Your code itself is part of the experiment and will be preserved.

Before finishing, write exactly {"schedule": <candidate>} to /mnt/data/generated-candidate.json and read it back. Explicitly reference /mnt/data/generated-candidate.json in reply so the API returns the file annotation.
Return success=true if you produced a structurally valid candidate file, even if it is not yet 775/775. strategySummary must briefly state the algorithm actually used.
`,
      tools: [{ type: "code_interpreter", container: { type: "auto", file_ids: [upload.id] } }],
      tool_choice: "required",
      text: { format: { type: "json_schema", name: "generation_run_v1_result", strict: true, schema: resultSchema } },
      input: "Execute the next autonomous timetable generation attempt now.",
    });

    return jsonResponse({ success: true, responseId: response.id, status: response.status || "queued", uploadedFileIds: [upload.id] });
  } catch (error) {
    console.error("Generation async start failed:", error);
    return jsonResponse({ success: false, error: error?.message || "Unknown generation start error" }, 500);
  }
};
