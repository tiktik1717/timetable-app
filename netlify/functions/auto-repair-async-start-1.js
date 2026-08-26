import {
  client,
  MODEL,
  repairResultSchema,
  jsonResponse,
} from "../lib/auto-repair-async-shared.js";
import { validateSchedule } from "../../src/scheduling/scheduleValidator.js";

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await request.json();
    const schoolData = body?.schoolData;
    const brokenSchedule = body?.brokenSchedule;
    const approvedExceptions = Array.isArray(body?.approvedExceptions)
      ? body.approvedExceptions
      : [];

    if (!schoolData || !brokenSchedule) {
      return jsonResponse(
        { error: "schoolData and brokenSchedule are required" },
        400,
      );
    }

    // Do not trust client-side feedback. Recompute it here.
    const validation = validateSchedule({
      schedule: brokenSchedule,
      schoolData,
      approvedExceptions,
    });

    const brokenText = JSON.stringify({ schedule: brokenSchedule }, null, 2);
    const brokenUpload = await client.files.create({
      file: new File([brokenText], "broken-candidate.json", {
        type: "application/json",
      }),
      purpose: "user_data",
      expires_after: { anchor: "created_at", seconds: 3600 },
    });

    const metadataText = JSON.stringify(
      {
        version: 1,
        purpose: "auto-repair-loop-v1.2-attempt-1",
        schoolData,
      },
      null,
      2,
    );
    const metadataUpload = await client.files.create({
      file: new File([metadataText], "school-metadata.json", {
        type: "application/json",
      }),
      purpose: "user_data",
      expires_after: { anchor: "created_at", seconds: 3600 },
    });

    const feedback = {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      missingUnits: validation.missingUnits,
      statistics: validation.statistics,
    };

    const response = await client.responses.create({
      model: MODEL,
      background: true,
      instructions: `
You are attempt 1 of an autonomous timetable repair test.
You MUST use Python code_interpreter.

You receive:
- broken-candidate.json
- school-metadata.json
- a Validator report in the user message

You DO NOT receive the pristine timetable.
You are NOT told which day/hour was removed.
Diagnose the Validator report and inspect the broken schedule + schoolData.

TIMETABLE FILE CONTRACT — exact structure; do not rediscover it.

File 1: broken-candidate.json
{
  "schedule": {
    day: {
      className: {
        hourString: [unitId, ...]
      }
    }
  }
}

File 2: school-metadata.json
{
  "version": 1,
  "purpose": "...",
  "schoolData": {
    "teachingUnits": [...],
    "teachers": [...],
    "classes": [...],
    "constraintGroups": [...],
    "dailyHoursByClass": {...},
    "hours": [...],
    ...
  }
}

IMPORTANT:
- After json.load(school-metadata.json), immediately do:
    school = metadata["schoolData"]
- Do NOT call metadata.get("teachingUnits") or metadata.get("teachers").
- Do NOT build classes_by_name. school["classes"] may contain strings and is not needed
  for this benchmark unless a specific validator problem requires it.
- schedule[day][className][hour] is a LIST of unit IDs.
- hour keys in schedule are strings.

Stable fields you may use directly:
teachingUnits[]:
- id
- hours
- className
- teacherId
- subject
- constraintGroupId

teachers[]:
- id
- name
- freeDays
- blockedHours
- educationClass
Other teacher fields may exist; inspect ONE teacher object only if a specific hard
constraint requires an unknown field.

Recommended indexes:
units_by_id = {u["id"]: u for u in school["teachingUnits"]}
teachers_by_id = {str(t["id"]): t for t in school["teachers"]}

For Validator warning type "unscheduledUnitHours":
1. Read unitId, className, teacherId, missingHours from VALIDATOR_REPORT.
2. Get target = units_by_id[unitId].
3. Count current placements of unitId by scanning only target["className"] across schedule.
4. Enumerate legal candidate cells only in that class.
5. Use school["dailyHoursByClass"][className][day] when present to define the legal
   hours of that class/day.
6. Teacher availability:
   - day must not be in teachers_by_id[teacherId].get("freeDays", [])
   - hour must not be in teacher.get("blockedHours", {}).get(day, [])
7. Teacher conflict:
   scan every class at the candidate day/hour; reject a cell if another unit there
   belongs to the same teacher.
8. If target.constraintGroupId is not null, do NOT perform a simple insertion; inspect
   the relevant group instead.
9. First test whether an EMPTY legal cell permits a one-insertion repair.
10. If no legal empty cell exists, search for the SMALLEST DISPLACEMENT CHAIN.
    Treat the search as breadth-first by number of displaced existing placements:
    depth 0 = direct insertion;
    depth 1 = move one occupant, then insert;
    depth 2 = move two occupants in dependency order, then insert;
    continue only if needed.
11. A displacement candidate is a state transition on a COPY of the schedule.
    When evaluating the next move, account for the moves already planned.
12. Every moved unit must remain in its own class and legal for its own teacher/group constraints.
13. Avoid cycles by tracking changed (unitId, fromSlot, toSlot) states.
14. Prefer fewer changed placements. Do not move unrelated units.

MINIMAL-CHANGE RULE:
Preserve every existing placement unless it must change. Rank repairs:
A. one legal insertion;
B. one displacement + insertion;
C. depth-2 displacement chain for this benchmark.
Do not search deeper than depth 2 unless RUN 1 proves the documented benchmark assumptions
are inconsistent. Do not optimize unrelated preferences.

PYTHON EXECUTION CONTRACT — STRICT:
You have a HARD BUDGET of 4 Python runs, but you SHOULD finish in 2.
Do NOT use Python as an interactive REPL and do NOT perform one search branch per run.

RUN 1 MUST be one self-contained solver program. In that single code block:
1. load both files and set school = metadata["schoolData"];
2. build units_by_id / teachers_by_id;
3. read the single missing unit from VALIDATOR_REPORT;
4. define all helper functions you need;
5. construct the full finite search space in memory;
6. perform breadth-first search LOCALLY INSIDE PYTHON using loops/collections.deque,
   not by asking the model to choose each next move;
7. search depth 0, then 1, then 2. This benchmark is already server-verified to have
   no clean depth-0 or depth-1 repair, so a correct implementation should reach depth 2;
8. when testing a chain, mutate a COPY of the schedule after each hypothetical move so
   later teacher-conflict checks see the planned state;
9. stop at the first smallest complete plan;
10. print exactly one compact SEARCH_RESULT object containing the entire plan.

IMPORTANT SEARCH SCOPE:
- The missing unit and every displaced ordinary unit stay in their own class.
- Candidate destinations are legal hours of that class/day.
- Only singleton ordinary non-group occupants may be displaced in this benchmark.
- Use the documented freeDays, blockedHours, dailyHoursByClass and teacher-conflict checks.
- Do not rediscover schemas or inspect unrelated objects.

RUN 2 MUST apply the complete plan found by RUN 1:
- deep-copy broken schedule;
- apply every displacement in dependency-safe order;
- insert the missing unit;
- write /mnt/data/repaired-candidate.json;
- read it back;
- print AUTO_REPAIR_RESULT= with all changed placements.

RUNS 3-4 are emergency-only. If RUN 1 does not find a plan, use at most two additional
batched debugging/correction runs. Never branch interactively and never exceed four runs.
If you cannot solve within the budget, return success=false rather than continuing.

Do NOT spend runs merely printing keys, days, hours, variables, representative objects,
or individual candidate branches.
Goal:
- repair the missing scheduling problem with the smallest possible change;
- this benchmark may intentionally require moving an already scheduled unit before the missing unit can be restored;
- respect teacher free days, blocked hours, class hours, groups and existing schedule structure;
- do not merely explain the repair: execute Python.

Write /mnt/data/repaired-candidate.json containing exactly:
{"schedule": <repaired schedule>}

Read it back.
Print AUTO_REPAIR_RESULT= followed by a compact description of the change.
Explicitly reference /mnt/data/repaired-candidate.json in the reply so it is returned.
`,
      tools: [
        {
          type: "code_interpreter",
          container: {
            type: "auto",
            file_ids: [brokenUpload.id, metadataUpload.id],
          },
        },
      ],
      tool_choice: "required",
      text: {
        format: {
          type: "json_schema",
          name: "auto_repair_async_attempt_1_result",
          strict: true,
          schema: repairResultSchema,
        },
      },
      input: `VALIDATOR_REPORT\n${JSON.stringify(feedback)}`,
    });

    return jsonResponse({
      success: true,
      phase: "attempt-1-started",
      responseId: response.id,
      status: response.status || "queued",
      inputFileIds: [brokenUpload.id, metadataUpload.id],
      feedback,
    });
  } catch (error) {
    console.error("Async attempt 1 start failed:", error);
    return jsonResponse(
      {
        success: false,
        error: error?.message || "Unknown attempt-1 start error",
      },
      500,
    );
  }
};
