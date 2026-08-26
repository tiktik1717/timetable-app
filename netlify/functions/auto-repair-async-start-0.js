import {
  client,
  MODEL,
  failureResultSchema,
  jsonResponse,
} from "../lib/auto-repair-async-shared.js";

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await request.json();
    const schoolData = body?.schoolData;
    const baseSchedule = body?.baseSchedule;

    if (!schoolData || !baseSchedule) {
      return jsonResponse(
        { error: "schoolData and baseSchedule are required" },
        400,
      );
    }

    const metadataText = JSON.stringify(
      {
        version: 1,
        purpose: "auto-repair-loop-v1.2-attempt-0",
        schoolData,
        schedule: baseSchedule,
      },
      null,
      2,
    );

    const uploaded = await client.files.create({
      file: new File([metadataText], "metadata.json", {
        type: "application/json",
      }),
      purpose: "user_data",
      expires_after: { anchor: "created_at", seconds: 3600 },
    });

    const response = await client.responses.create({
      model: MODEL,
      background: true,
      instructions: `
You are attempt 0 of an auto-repair infrastructure test.
You MUST use Python code_interpreter and MUST read metadata.json.

The JSON structure is known and MUST be used exactly:
- schedule[day][className][hourString] = [unitId, ...]
- NOT schedule[className][day][hour].
- metadata["schoolData"]["teachingUnits"] is a LIST of teaching-unit objects.
- metadata["schoolData"]["teachers"] contains teacher metadata.
- metadata["schoolData"]["dailyHoursByClass"][className][day] gives the maximum legal hour count.
- Build units_by_id and teachers_by_id immediately.

Use these exact helper semantics:
- get_cell(schedule_obj, day, className, hour):
    schedule_obj.get(day, {}).get(className, {}).get(str(hour), [])
- set_cell(schedule_obj, day, className, hour, ids):
    schedule_obj[day][className][str(hour)] = ids
- iterate slots as:
    for day, classes in schedule_obj.items():
        for className, hours in classes.items():
            for hour in hours.keys():
                ...

This benchmark must create a CONTROLLED MULTI-STEP defect that cannot be repaired by:
A. one direct insertion of the missing unit into an empty legal slot; OR
B. moving only one already-scheduled unit and then inserting the missing unit.

Create a three-slot chain inside the SAME class using ordinary non-group units U, V, W.

Pristine:
  A -> U
  B -> V
  C -> W

Broken:
  A -> V
  B -> W
  C -> empty
  U missing

The intended restoration is:
  W: B -> C
  V: A -> B
  U: missing -> A

Search deterministically for the FIRST triple A,B,C satisfying:
1. A/B/C are distinct legal slots in the same class.
2. Each pristine source cell contains exactly one unit.
3. U,V,W are distinct ordinary units with constraintGroupId == null.
4. Each unit's className equals that class.
5. Build the broken schedule A=V, B=W, C=[].
6. U has no legal direct insertion into any empty cell.
7. No one-displacement repair exists.
8. The intended two-displacement restoration is legal.
9. Check teacher freeDays, blockedHours and conflicts against the TEMPORARY schedule after each hypothetical move.
10. Prefer the first valid triple in existing schedule iteration order.

Do the search and mutation in ONE Python run.
Write /mnt/data/candidate-schedule.json containing exactly {"schedule": <broken schedule>}.
Read it back.
Print one compact JSON line beginning FAILURE_INJECTION_RESULT= with:
unitId, className, day/hour of A, displacedUnitId=V, secondDisplacedUnitId=W, slotB, slotC.

In the structured response, injectedFailure identifies U and original A.
Explicitly reference /mnt/data/candidate-schedule.json.

If no qualifying triple exists, raise RuntimeError. Never fall back to an easier defect.
Do not probe alternate schedule orientations.

Do not repair anything. This attempt creates the controlled multi-step displacement defect.
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
          name: "auto_repair_async_attempt_0_result",
          strict: true,
          schema: failureResultSchema,
        },
      },
      input: "Create the controlled one-hour defect now.",
    });

    return jsonResponse({
      success: true,
      phase: "attempt-0-started",
      responseId: response.id,
      status: response.status || "queued",
      inputFileIds: [uploaded.id],
      inputFileBytes: Buffer.byteLength(metadataText, "utf8"),
    });
  } catch (error) {
    console.error("Async attempt 0 start failed:", error);
    return jsonResponse(
      {
        success: false,
        error: error?.message || "Unknown attempt-0 start error",
      },
      500,
    );
  }
};
