
// Generic deterministic timetable rule engine.
// It executes a small declarative DSL produced by the Rule Compiler.

const DAY_ALIASES = {
  "ראשון":"א","א'":"א","א":"א",
  "שני":"ב","ב'":"ב","ב":"ב",
  "שלישי":"ג","ג'":"ג","ג":"ג",
  "רביעי":"ד","ד'":"ד","ד":"ד",
  "חמישי":"ה","ה'":"ה","ה":"ה",
  "שישי":"ו","ו'":"ו","ו":"ו",
};

export const GENERIC_RULE_DSL_CAPABILITIES = {
  version: "6.5",
  principle:
    "Compose existing typed primitives before declaring a natural-language requirement unsupported.",
  sources: {
    placements: {
      rowKind: "placement",
      supports: ["filters", "exclude", "groupBy", "time-sequence metrics"],
      universe: "all scheduled placements; use isInstructionalPlacement=true for teaching-only rules"
    },
    teacher_teaching_days: {
      rowKind: "teacher_day_summary",
      universe: "instructional teaching only",
      fields: ["teacherId","day","count","startHour","endHour","gapCount","maxConsecutiveHours","maxConsecutiveGapHours"]
    },
    teacher_activity_days: {
      rowKind: "teacher_day_summary",
      universe: "all scheduled activities",
      fields: ["teacherId","day","count","startHour","endHour","gapCount","maxConsecutiveHours","maxConsecutiveGapHours"]
    },
    class_teaching_days: {
      rowKind: "class_day_summary",
      universe: "instructional teaching only",
      fields: ["className","grade","day","count","startHour","endHour","gapCount","maxConsecutiveHours","maxConsecutiveGapHours"]
    },
    class_activity_days: {
      rowKind: "class_day_summary",
      universe: "all scheduled activities",
      fields: ["className","grade","day","count","startHour","endHour","gapCount","maxConsecutiveHours","maxConsecutiveGapHours"]
    },
    grade_days: {
      rowKind: "grade_day_summary",
      universe: "grade-level daily summary"
    },
    student_classes: {
      rowKind: "class_identity"
    }
  },
  expressions: {
    every_placement: {
      purpose: "Assert a property for every selected placement.",
      input: "rows",
      output: "boolean + violating rows",
      composableWith: ["and","conditional"]
    },
    aggregate: {
      purpose: "Group selected rows, compute one metric per group, assert a threshold/property.",
      input: "rows",
      output: "group metrics + boolean",
      composableWith: ["and","conditional"]
    },
    aggregate_pipeline: {
      purpose: "Perform multiple aggregation stages; derived metrics from one stage become fields in the next.",
      input: "rows",
      output: "final derived rows + assertions applied to EVERY final row",
      composableWith: ["and","conditional"],
      enables: [
        "weekly distributions",
        "count days having a per-day property",
        "combine per-day sequence metrics with weekly cardinalities"
      ]
    },
    conditional: {
      purpose: "Evaluate THEN only for groups/rows selected by a typed WHEN expression.",
      input: "typed expression",
      output: "boolean + trigger bindings",
      composableWith: ["aggregate","coverage","aggregate_pipeline","every_placement"]
    },
    coverage: {
      purpose: "Measure ratio/count of rows matching a predicate inside a selected population.",
      input: "rows",
      output: "ratio or count + boolean"
    },
    objective: {
      purpose: "Measure a minimize/maximize objective on one schedule without inventing a hard threshold.",
      input: "rows",
      output: "objectiveValue",
      directions: ["minimize","maximize"]
    },
    weighted_objective: {
      purpose: "Combine measurable preferences with relative weights into one minimization score.",
      input: "typed child expressions",
      output: "objectiveValue + weighted components"
    },
    comparative_objective: {
      purpose: "Compare a candidate schedule against an explicit baseline schedule.",
      input: "candidate + baseline",
      output: "objectiveValue + deltas",
      modes: ["changed_cells","measure_delta","nonincrease_per_group"]
    },
    class_end_hour: {
      purpose: "Compare class end hours across days/classes."
    },
    required_slots: {
      purpose: "Require concrete day/hour/class/teacher/group placements when all required coordinates are fixed."
    },
    exists: {
      purpose: "Require that at least/min/max N selected rows exist while leaving unspecified dimensions free for the solver.",
      input: "rows selected by source/filters/exclude",
      output: "count + boolean",
      note: "Use when natural language fixes some coordinates (for example teacher+class+hour) but intentionally leaves day or another dimension unspecified."
    },
    and: {
      purpose: "Require all child expressions."
    },
    or: {
      purpose: "Accept any child expression."
    }
  },
  metrics: {
    count: { input: "rows", output: "number", meaning: "number of rows" },
    count_distinct: { input: "rows", output: "number", supportsWhere: true },
    count_where: { input: "rows/derived rows", output: "number" },
    sum: { input: "numeric field over rows/derived rows", output: "number" },
    field_value: { input: "numeric field", output: "number", note: "sums numeric values when group contains multiple rows; prefer sum when that is the intent" },
    min: { input: "numeric field", output: "number" },
    max: { input: "numeric field", output: "number" },
    value: { input: "field", output: "scalar" },
    common_value: { input: "field", output: "scalar|null" },
    all_equal: { input: "field", output: "boolean" },
    start_hour: { input: "hour rows/day summary", output: "number" },
    end_hour: { input: "hour rows/day summary", output: "number" },
    distinct_hours: { input: "hour rows/day summary", output: "number" },
    max_consecutive_hours: {
      input: "rows containing hour or daily summary",
      output: "number",
      meaning: "longest run of consecutive occupied hour numbers"
    },
    gap_count: { input: "hour rows/day summary", output: "number" },
    max_consecutive_gap_hours: {
      input: "hour rows/day summary",
      output: "number",
      meaning: "longest run of consecutive internal gaps"
    },
    changed_cells: {
      input: "candidate + baseline schedules",
      output: "number",
      meaning: "class/day/hour cells whose normalized unit-id set differs"
    },
    positive_delta: {
      input: "candidate and baseline grouped measurements",
      output: "number",
      meaning: "max(candidate-baseline,0)"
    }
  },
  planningRules: [
    "Ground entities and scope first.",
    "Decompose the natural-language rule into atomic measurable requirements.",
    "Match each requirement to catalog sources/expressions/metrics.",
    "Search for a composition path, including aggregate_pipeline and conditional, before declaring a gap.",
    "If all material requirements have a composition path, formalize them.",
    "If only some have a path, partially formalize and name only the truly unsupported remainder.",
    "Never claim a primitive is missing when it appears in this catalog."
  ]
};

export function normalizeRuleDay(value) {
  return DAY_ALIASES[String(value ?? "").trim()] || String(value ?? "").trim();
}

function cellIds(cell) {
  if (Array.isArray(cell)) return cell.map(String);
  if (cell == null || cell === "") return [];
  if (typeof cell === "string" || typeof cell === "number") return [String(cell)];
  if (typeof cell === "object") {
    if (Array.isArray(cell.unitIds)) return cell.unitIds.map(String);
    if (cell.unitId != null) return [String(cell.unitId)];
  }
  return [];
}

function gradeOf(className) {
  return String(className || "").trim().charAt(0);
}
function maxConsecutive(hs) {
  let best=0,run=0,prev=null;
  for (const h of hs) { run=prev!==null && h===prev+1?run+1:1; best=Math.max(best,run); prev=h; }
  return best;
}

function maxConsecutiveGapHours(hs) {
  const sorted = [...new Set((hs || []).map(Number).filter(Number.isFinite))]
    .sort((a,b)=>a-b);
  if (sorted.length < 2) return 0;

  let best = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    // Only INTERNAL free periods count as gaps. The number of consecutive
    // free hours between two taught periods is the distance minus one.
    best = Math.max(best, Math.max(0, sorted[i] - sorted[i - 1] - 1));
  }
  return best;
}


function normalizeActivityKind(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["instructional","instruction","teaching","lesson","class"].includes(raw)) return "instructional";
  if (["meeting","teammeeting","team_meeting","staffmeeting","staff_meeting"].includes(raw)) return "meeting";
  if (["duty","supervision"].includes(raw)) return "duty";
  if (["support","guidance","training"].includes(raw)) return "support";
  if (raw === "other") return "other";
  return null;
}

function classifyActivityKind(unit, group) {
  const explicit = normalizeActivityKind(unit?.activityKind ?? group?.activityKind);
  if (explicit) return explicit;
  const unitType = String(unit?.type ?? "").trim().toLowerCase();
  const groupKind = String(group?.groupKind ?? "").trim().toLowerCase();
  if (groupKind === "meeting" || unitType === "teammeeting") return "meeting";
  if (["duty","supervision"].includes(groupKind) || ["duty","supervision"].includes(unitType)) return "duty";
  if (["support","guidance","training"].includes(groupKind) || ["support","guidance","training"].includes(unitType)) return "support";
  return "instructional";
}

function makeContext(schedule, schoolData) {
  const units = schoolData?.teachingUnits || [];
  const unitsById = new Map(units.map(u => [String(u.id), u]));
  const teachersById = new Map((schoolData?.teachers || []).map(t => [String(t.id), t]));
  const homeroomByClass = new Map(
    (schoolData?.teachers || [])
      .filter(t => t?.educationClass)
      .map(t => [String(t.educationClass), String(t.id)])
  );
  const homeroomClassByTeacher = new Map(
    (schoolData?.teachers || [])
      .filter(t => t?.educationClass)
      .map(t => [String(t.id), String(t.educationClass)])
  );
  const groundedClasses = [...homeroomByClass.keys()];
  const fallbackClasses = (schoolData?.classes || [])
    .map(c => typeof c === "string" ? c : (c?.name || c?.className))
    .filter(Boolean).map(String).filter(name => /^[^\d\s]+\d+$/.test(name));
  const studentClasses = new Set(groundedClasses.length ? groundedClasses : fallbackClasses);
  const groupsById = new Map((schoolData?.constraintGroups || []).map(g => [String(g.id), g]));

  const placements = [];
  for (const [dayRaw, classes] of Object.entries(schedule || {})) {
    const day = normalizeRuleDay(dayRaw);
    for (const [className, hours] of Object.entries(classes || {})) {
      for (const [hourRaw, cell] of Object.entries(hours || {})) {
        const hour = Number(hourRaw);
        for (const unitId of cellIds(cell)) {
          const unit = unitsById.get(String(unitId)) || {};
          const group = unit.constraintGroupId == null ? null : groupsById.get(String(unit.constraintGroupId));
          const activityKind = classifyActivityKind(unit, group);
          placements.push({
            kind: "placement", day, hour, className,
            grade: gradeOf(className), unitId: String(unitId),
            teacherId: unit.teacherId == null ? null : String(unit.teacherId),
            constraintGroupId: unit.constraintGroupId == null ? null : String(unit.constraintGroupId),
            constraintGroupName: unit.constraintGroupId == null ? null : String(groupsById.get(String(unit.constraintGroupId))?.name || groupsById.get(String(unit.constraintGroupId))?.label || ""),
            subject: unit.subject ?? unit.subjectName ?? null,
            unitType: unit.type ?? null,
            groupKind: group?.groupKind ?? null,
            activityKind,
            isInstructionalPlacement: activityKind === "instructional",
            isHomeroomTeacher:
              unit.teacherId != null &&
              homeroomClassByTeacher.has(String(unit.teacherId)),
            homeroomClassName:
              unit.teacherId == null
                ? null
                : (homeroomClassByTeacher.get(String(unit.teacherId)) || null),
            isHomeroomForClass:
              homeroomByClass.get(String(className)) === String(unit.teacherId),
          });
        }
      }
    }
  }
  // Generic time-position metadata. Activity positions include every scheduled
  // activity; Teaching positions include instructional placements only.
  const teacherActivityDayHours = new Map();
  const teacherTeachingDayHours = new Map();
  const classActivityDayHours = new Map();
  const classTeachingDayHours = new Map();
  const addHour = (map,key,hour) => { if (!map.has(key)) map.set(key,new Set()); map.get(key).add(Number(hour)); };
  const sortedHours = (map,key) => [...(map.get(key)||[])].filter(Number.isFinite).sort((a,b)=>a-b);
  const addActivityPosition = (p,hours,prefix) => {
    const index=hours.indexOf(Number(p.hour));
    p[`${prefix}StartHour`]=hours.length?hours[0]:0;
    p[`${prefix}EndHour`]=hours.length?hours[hours.length-1]:0;
    p[`${prefix}SlotIndex`]=index>=0?index+1:null;
    p[`${prefix}SlotFromEnd`]=index>=0?hours.length-index:null;
    const cap=prefix[0].toUpperCase()+prefix.slice(1);
    p[`is${cap}FirstSlot`]=index===0;
    p[`is${cap}LastSlot`]=index===hours.length-1 && index>=0;
  };
  for (const p of placements) {
    if (p.teacherId != null) {
      const key=`${p.teacherId}::${p.day}`;
      addHour(teacherActivityDayHours,key,p.hour);
      if (p.isInstructionalPlacement) addHour(teacherTeachingDayHours,key,p.hour);
    }
    const key=`${p.className}::${p.day}`;
    addHour(classActivityDayHours,key,p.hour);
    if (p.isInstructionalPlacement) addHour(classTeachingDayHours,key,p.hour);
  }
  for (const p of placements) {
    if (p.teacherId != null) {
      const key=`${p.teacherId}::${p.day}`;
      const ah=sortedHours(teacherActivityDayHours,key), th=sortedHours(teacherTeachingDayHours,key);
      addActivityPosition(p,ah,"teacherActivity");
      const i=p.isInstructionalPlacement?th.indexOf(Number(p.hour)):-1;
      p.teacherStartHour=th.length?th[0]:0; p.teacherEndHour=th.length?th[th.length-1]:0;
      p.teacherTeachingSlotIndex=i>=0?i+1:null; p.teacherTeachingSlotFromEnd=i>=0?th.length-i:null;
      p.isTeacherFirstTeachingSlot=i===0; p.isTeacherLastTeachingSlot=i===th.length-1 && i>=0;
    }
    const key=`${p.className}::${p.day}`;
    const ah=sortedHours(classActivityDayHours,key), th=sortedHours(classTeachingDayHours,key);
    addActivityPosition(p,ah,"classActivity");
    const i=p.isInstructionalPlacement?th.indexOf(Number(p.hour)):-1;
    p.classStartHour=th.length?th[0]:0; p.classEndHour=th.length?th[th.length-1]:0;
    p.classTeachingSlotIndex=i>=0?i+1:null; p.classTeachingSlotFromEnd=i>=0?th.length-i:null;
    p.isClassFirstTeachingSlot=i===0; p.isClassLastTeachingSlot=i===th.length-1 && i>=0;
  }

  const days=[...new Set(Object.keys(schedule || {}).map(normalizeRuleDay))];
  const classDays=[];
  for (const className of studentClasses) for (const day of days) {
    const rs=placements.filter(p=>p.className===className && p.day===day);
    const hs=[...new Set(rs.map(r=>Number(r.hour)).filter(Number.isFinite))].sort((a,b)=>a-b);
    classDays.push({kind:"class_day",className,grade:gradeOf(className),day,count:rs.length,distinctHours:hs.length,startHour:hs.length?hs[0]:0,endHour:hs.length?hs[hs.length-1]:0,gapCount:hs.length?(hs[hs.length-1]-hs[0]+1)-hs.length:0,maxConsecutiveHours:maxConsecutive(hs),maxConsecutiveGapHours:maxConsecutiveGapHours(hs)});
  }
  const gradeDays=[];
  const grades=[...new Set([...studentClasses].map(gradeOf))];
  for (const grade of grades) for (const day of days) {
    const members=classDays.filter(x=>x.grade===grade && x.day===day);
    const ends=members.map(x=>x.endHour);
    const allEqual=new Set(ends).size<=1;
    gradeDays.push({kind:"grade_day",grade,day,classCount:members.length,allEqualEndHour:allEqual,endHour:allEqual && ends.length?ends[0]:null});
  }
  function summarizeDayRows(rows, kind, extra={}) {
    const hs=[...new Set(rows.map(r=>Number(r.hour)).filter(Number.isFinite))].sort((a,b)=>a-b);
    return {kind,...extra,count:hs.length,distinctHours:hs.length,rawPlacementCount:rows.length,
      startHour:hs.length?hs[0]:0,endHour:hs.length?hs[hs.length-1]:0,
      gapCount:hs.length?(hs[hs.length-1]-hs[0]+1)-hs.length:0,
      maxConsecutiveHours:maxConsecutive(hs),maxConsecutiveGapHours:maxConsecutiveGapHours(hs)};
  }
  const teacherActivityDays=[], teacherTeachingDays=[];
  for (const teacherId of teachersById.keys()) for (const day of days) {
    const activityRows=placements.filter(p=>p.teacherId===teacherId && p.day===day);
    teacherActivityDays.push(summarizeDayRows(activityRows,"teacher_activity_day",{teacherId,day}));
    teacherTeachingDays.push(summarizeDayRows(activityRows.filter(p=>p.isInstructionalPlacement),"teacher_teaching_day",{teacherId,day}));
  }
  const classActivityDays=[], classTeachingDays=[];
  for (const className of studentClasses) for (const day of days) {
    const activityRows=placements.filter(p=>p.className===className && p.day===day);
    const extra={className,grade:gradeOf(className),day};
    classActivityDays.push(summarizeDayRows(activityRows,"class_activity_day",extra));
    classTeachingDays.push(summarizeDayRows(activityRows.filter(p=>p.isInstructionalPlacement),"class_teaching_day",extra));
  }
  const teacherDays=teacherActivityDays;
  return { schedule, schoolData, unitsById, teachersById, studentClasses, homeroomByClass,
    placements, classDays, gradeDays, teacherDays,
    teacherActivityDays, teacherTeachingDays, classActivityDays, classTeachingDays };
}

function valueAt(obj, field) {
  if (field === "day") return normalizeRuleDay(obj.day);
  return obj?.[field];
}

function compare(actual, op, expected) {
  if (op === "eq") return String(actual) === String(expected);
  if (op === "neq") return String(actual) !== String(expected);
  if (op === "lt") return Number(actual) < Number(expected);
  if (op === "lte") return Number(actual) <= Number(expected);
  if (op === "gt") return Number(actual) > Number(expected);
  if (op === "gte") return Number(actual) >= Number(expected);
  if (op === "in") return (expected || []).map(String).includes(String(actual));
  if (op === "not_in") return !(expected || []).map(String).includes(String(actual));
  if (op === "contains") return String(actual ?? "").includes(String(expected ?? ""));
  if (op === "starts_with") return String(actual ?? "").startsWith(String(expected ?? ""));
  return false;
}

function matchesFilter(row, f) {
  const actual = valueAt(row, f.field);
  const expected = f.field === "day" && Array.isArray(f.value)
    ? f.value.map(normalizeRuleDay)
    : f.field === "day" ? normalizeRuleDay(f.value) : f.value;
  return compare(actual, f.op || "eq", expected);
}

// Boolean predicate DSL for conditions that must be evaluated on the SAME row.
// This prevents a rule such as "not on Tuesday in hours 1-2" from becoming
// two independent prohibitions (not Tuesday AND not hours 1-2).
function matchesPredicate(row, predicate) {
  if (!predicate) return true;
  if (predicate.type === "condition") return matchesFilter(row, predicate);
  if (predicate.type === "and") return (predicate.children || []).every(p => matchesPredicate(row, p));
  if (predicate.type === "or") return (predicate.children || []).some(p => matchesPredicate(row, p));
  if (predicate.type === "not") return !matchesPredicate(row, predicate.child);
  throw new Error(`Unsupported generic predicate type: ${predicate.type}`);
}

function selectRows(ctx, expr) {
  const source = expr.source || "placements";
  let rows;
  if (source === "placements") rows = [...ctx.placements];
  else if (source === "student_classes") {
    rows = [...ctx.studentClasses].map(className => ({
      kind:"class", className, grade:gradeOf(className)
    }));
  } else if (source === "class_days") rows = [...ctx.classDays];
  else if (source === "teacher_days") rows = [...ctx.teacherDays];
  else if (source === "teacher_activity_days") rows = [...ctx.teacherActivityDays];
  else if (source === "teacher_teaching_days") rows = [...ctx.teacherTeachingDays];
  else if (source === "class_activity_days") rows = [...ctx.classActivityDays];
  else if (source === "class_teaching_days") rows = [...ctx.classTeachingDays];
  else if (source === "grade_days") rows = [...ctx.gradeDays];
  else if (source === "teachers") {
    rows = [...ctx.teachersById.values()].map(t => ({
      kind:"teacher", teacherId:String(t.id), teacher:t
    }));
  } else {
    throw new Error(`Unsupported generic source: ${source}`);
  }
  for (const f of expr.filters || []) rows = rows.filter(r => matchesFilter(r, f));
  for (const f of expr.exclude || []) rows = rows.filter(r => !matchesFilter(r, f));
  return rows;
}

function groupRows(rows, fields) {
  if (!fields?.length) return [{ key:{}, rows }];
  const map = new Map();
  for (const row of rows) {
    const key = Object.fromEntries(fields.map(f => [f, valueAt(row, f)]));
    const s = JSON.stringify(key);
    if (!map.has(s)) map.set(s, {key, rows:[]});
    map.get(s).rows.push(row);
  }
  return [...map.values()];
}

function metric(group, metricSpec) {
  const rows = group.rows;
  const type = metricSpec?.type || "count";
  if (type === "count") return rows.length;
  if (type === "sum") {
    return rows
      .map(r => Number(valueAt(r, metricSpec.field)))
      .filter(Number.isFinite)
      .reduce((sum, value) => sum + value, 0);
  }
  if (type === "field_value") {
    if (!rows.length) return 0;
    const values = rows.map(r => Number(valueAt(r, metricSpec.field))).filter(Number.isFinite);
    if (!values.length) return 0;
    // Summary sources such as teacher_days/class_days normally contain one row per group.
    // If a caller groups more broadly, summing preserves the meaning of an already-computed count field.
    return values.reduce((sum, value) => sum + value, 0);
  }
  if (type === "count_distinct") {
    const metricRows = metricSpec?.where
      ? rows.filter(r => matchesFilter(r, metricSpec.where))
      : rows;
    return new Set(
      metricRows.map(r => String(valueAt(r, metricSpec.field)))
    ).size;
  }
  if (type === "max_consecutive_gap_hours") {
    // For raw placements, compute from distinct scheduled hour slots in the group.
    // For summary sources (teacher_days/class_days), use the precomputed field.
    if (
      rows.length === 1 &&
      valueAt(rows[0], metricSpec.field || "maxConsecutiveGapHours") != null
    ) {
      return Number(
        valueAt(rows[0], metricSpec.field || "maxConsecutiveGapHours")
      ) || 0;
    }
    return maxConsecutiveGapHours(
      rows.map(r => Number(valueAt(r, metricSpec.field || "hour")))
    );
  }
  if (type === "all_equal") return new Set(rows.map(r => String(valueAt(r, metricSpec.field)))).size <= 1;
  if (type === "common_value") {
    if (!rows.length) return null;
    const values = rows.map(r => valueAt(r, metricSpec.field));
    return new Set(values.map(v => String(v))).size <= 1 ? values[0] : null;
  }
  if (type === "value") return rows.length ? valueAt(rows[0], metricSpec.field) : null;
  if (type === "min") return rows.length ? Math.min(...rows.map(r => Number(valueAt(r, metricSpec.field))).filter(Number.isFinite)) : 0;
  if (type === "max") return rows.length ? Math.max(...rows.map(r => Number(valueAt(r, metricSpec.field))).filter(Number.isFinite)) : 0;
  if (type === "start_hour") {
    if (rows.some(r => r.startHour != null)) return rows.length ? Math.min(...rows.map(r => Number(r.startHour)).filter(Number.isFinite)) : 0;
    return rows.length ? Math.min(...rows.map(r => Number(r.hour)).filter(Number.isFinite)) : 0;
  }
  if (type === "end_hour") {
    if (rows.some(r => r.endHour != null)) return rows.length ? Math.max(...rows.map(r => Number(r.endHour)).filter(Number.isFinite)) : 0;
    return rows.length ? Math.max(...rows.map(r => Number(r.hour)).filter(Number.isFinite)) : 0;
  }
  if (type === "distinct_hours") {
    if (rows.length === 1 && rows[0].distinctHours != null) return Number(rows[0].distinctHours);
    return new Set(rows.map(r => Number(r.hour)).filter(Number.isFinite)).size;
  }
  if (type === "max_consecutive_hours") {
    if (rows.length === 1 && rows[0].maxConsecutiveHours != null) return Number(rows[0].maxConsecutiveHours);
    const hs=[...new Set(rows.map(r=>Number(r.hour)).filter(Number.isFinite))].sort((a,b)=>a-b);
    let best=0, run=0, prev=null;
    for (const h of hs) { run = prev !== null && h === prev+1 ? run+1 : 1; best=Math.max(best,run); prev=h; }
    return best;
  }
  if (type === "count_where") {
    const f=metricSpec.where; return rows.filter(r=>matchesFilter(r,f)).length;
  }
  if (type === "gap_count") {
    if (rows.length === 1 && rows[0].gapCount != null) return Number(rows[0].gapCount);
    const hs=[...new Set(rows.map(r=>Number(r.hour)).filter(Number.isFinite))].sort((a,b)=>a-b);
    if (!hs.length) return 0;
    return (hs[hs.length-1]-hs[0]+1)-hs.length;
  }
  throw new Error(`Unsupported generic metric: ${type}`);
}

function assertMetric(actual, assertion) {
  return compare(actual, assertion?.op || "eq", assertion?.value);
}

function executeAggregate(ctx, expr) {
  const rows=selectRows(ctx,expr);
  const groups=groupRows(rows,expr.groupBy || []);
  const violations=[];
  const results=[];
  for (const g of groups) {
    const actual=metric(g,expr.metric);
    const valid=assertMetric(actual,expr.assert);
    results.push({...g.key,actual});
    if (!valid) violations.push({...g.key,actual,expected:expr.assert});
  }
  return {valid:violations.length===0,violations,results};
}

function executeAggregatePipeline(ctx, expr) {
  let rows = selectRows(ctx, expr);
  const stages = expr.stages || [];
  for (const stage of stages) {
    const groups = groupRows(rows, stage.groupBy || []);
    rows = groups.map(g => {
      const derived = {...g.key};
      for (const m of stage.metrics || []) {
        if (!m?.as) throw new Error("aggregate_pipeline metric requires 'as'");
        derived[m.as] = metric(g, m);
      }
      return derived;
    });
  }
  const violations=[];
  if (rows.length === 0 && (expr.assertions || []).length > 0) {
    for (const assertion of expr.assertions || []) {
      violations.push({
        field:assertion.field,
        actual:null,
        expected:{op:assertion.op || "eq",value:assertion.value},
        reason:"aggregate_pipeline produced no final rows"
      });
    }
  } else {
    for (const row of rows) {
      for (const assertion of expr.assertions || []) {
        const actual = valueAt(row, assertion.field);
        if (!compare(actual, assertion.op || "eq", assertion.value)) {
          violations.push({
            ...row,
            field:assertion.field,
            actual,
            expected:{op:assertion.op || "eq",value:assertion.value}
          });
        }
      }
    }
  }
  return {valid:violations.length===0,violations,results:rows};
}

function executeEveryPlacement(ctx, expr) {
  const rows=selectRows(ctx,expr);
  const assertions = expr.assertions || [];
  if (!expr.predicate && assertions.length === 0) {
    throw new Error(
      "Vacuous every_placement: at least one assertion or predicate is required."
    );
  }
  const violations=rows.filter(row => {
    if (expr.predicate) return !matchesPredicate(row, expr.predicate);
    return !assertions.every(a =>
      compare(
        valueAt(row,a.field),
        a.op,
        a.field==="day" && Array.isArray(a.value)
          ? a.value.map(normalizeRuleDay)
          : a.value
      )
    );
  });
  return {valid:violations.length===0,violations};
}

function executeClassEndHour(ctx, expr) {
  const classes=selectRows(ctx,{...expr,source:"student_classes"});
  const days=(expr.days || Object.keys(ctx.schedule || {})).map(normalizeRuleDay);
  const violations=[];
  if (expr.assert?.op === "all_equal") {
    for (const day of days) {
      const values=classes.map(c=>({className:c.className,endHour:(ctx.classDays.find(x=>x.className===c.className && x.day===day)?.endHour ?? 0)}));
      const distinct=[...new Set(values.map(x=>x.endHour))];
      if (distinct.length>1) violations.push({day,values,expected:{op:"all_equal"}});
    }
  } else {
    for (const c of classes) for (const day of days) {
      const actual=ctx.classDays.find(x=>x.className===c.className && x.day===day)?.endHour ?? 0;
      if (!assertMetric(actual,expr.assert)) violations.push({className:c.className,day,actual,expected:expr.assert});
    }
  }
  return {valid:violations.length===0,violations};
}

function executeRequiredSlots(ctx, expr) {
  const violations=[];
  for (const req of expr.requirements || []) {
    const day=normalizeRuleDay(req.day);
    const found=ctx.placements.some(p =>
      p.day===day && Number(p.hour)===Number(req.hour) &&
      (!req.className || p.className===req.className) &&
      (!req.teacherId || p.teacherId===String(req.teacherId)) &&
      (!req.constraintGroupId || p.constraintGroupId===String(req.constraintGroupId))
    );
    if (!found) violations.push({...req,day});
  }
  return {valid:violations.length===0,violations};
}

function executeExists(ctx, expr) {
  const rows=selectRows(ctx,expr);
  const count=rows.length;
  const minCount=expr.minCount == null ? 1 : Number(expr.minCount);
  const maxCount=expr.maxCount == null ? null : Number(expr.maxCount);
  if (!Number.isFinite(minCount) || minCount < 0) {
    throw new Error("exists.minCount must be a non-negative number.");
  }
  if (maxCount != null && (!Number.isFinite(maxCount) || maxCount < minCount)) {
    throw new Error("exists.maxCount must be null or a number >= minCount.");
  }
  const valid=count >= minCount && (maxCount == null || count <= maxCount);
  return {
    valid,
    count,
    rows,
    violations: valid ? [] : [{
      actual:count,
      expected:{minCount,maxCount},
      reason:"exists cardinality requirement not met"
    }]
  };
}


function conditionalTriggerRows(ctx, whenExpr) {
  if (!whenExpr?.type) {
    throw new Error(
      "conditional.when must be a full typed expression (for example aggregate/every_placement/coverage), not a raw source+assertions selector."
    );
  }

  if (whenExpr.type === "aggregate") {
    const groups=groupRows(selectRows(ctx,whenExpr),whenExpr.groupBy || []);
    return groups
      .map(g => ({...g.key, actual:metric(g,whenExpr.metric)}))
      .filter(row => assertMetric(row.actual,whenExpr.assert));
  }

  if (whenExpr.type === "every_placement") {
    const rows=selectRows(ctx,whenExpr);
    const assertions=whenExpr.assertions || [];
    if (!whenExpr.predicate && assertions.length===0) {
      throw new Error("conditional.when every_placement requires assertions or predicate.");
    }
    return rows.filter(row => {
      if (whenExpr.predicate) return matchesPredicate(row,whenExpr.predicate);
      return assertions.every(a=>compare(valueAt(row,a.field),a.op,a.value));
    });
  }

  if (whenExpr.type === "coverage") {
    const groups=groupRows(selectRows(ctx,whenExpr),whenExpr.groupBy || []);
    return groups.map(g => {
      const total=g.rows.length;
      const matched=g.rows.filter(r=>matchesPredicate(r,whenExpr.match)).length;
      const ratio=total?matched/total:(whenExpr.emptyRatio??1);
      const actual=whenExpr.metric==="count"?matched:ratio;
      return {...g.key,matched,total,ratio,actual};
    }).filter(row=>assertMetric(row.actual,whenExpr.assert));
  }

  if (whenExpr.type === "aggregate_pipeline") {
    const result=executeAggregatePipeline(ctx,whenExpr);
    return result.valid ? (result.results || []) : [];
  }

  throw new Error(`Unsupported conditional.when expression type: ${whenExpr.type}`);
}

function injectConditionalBindings(expression, bindings) {
  const child=JSON.parse(JSON.stringify(expression));
  const bindingFilters=Object.entries(bindings)
    .filter(([,value])=>value!==undefined && value!==null)
    .map(([field,value])=>({field,op:"eq",value}));

  function apply(expr) {
    if (!expr || typeof expr!=="object") return expr;
    if (["every_placement","aggregate","aggregate_pipeline","coverage","class_end_hour"].includes(expr.type)) {
      expr.filters=[...(expr.filters || []),...bindingFilters];
      return expr;
    }
    if (expr.type==="and" || expr.type==="or") {
      expr.children=(expr.children || []).map(apply);
      return expr;
    }
    if (expr.type==="conditional") {
      expr.when=apply(expr.when);
      expr.then=apply(expr.then);
      return expr;
    }
    return expr;
  }
  return apply(child);
}

function executeConditional(ctx, expr, rule, schedule, schoolData, baselineSchedule) {
  const active=conditionalTriggerRows(ctx,expr.when);
  const violations=[],children=[];
  for(const row of active){
    const bindings=Object.fromEntries(
      (expr.bind||[])
        .map(f=>[f,valueAt(row,f)])
        .filter(([,value])=>value!==undefined && value!==null)
    );
    const child=injectConditionalBindings(expr.then,bindings);
    const result=evaluateGenericRuleExpression({rule,expression:child,schedule,schoolData,baselineSchedule});
    children.push({bindings,trigger:row,result});
    if(!result.supported || !result.valid) {
      violations.push({
        bindings,
        trigger:row,
        reason:result.reason || null,
        violations:result.violations || []
      });
    }
  }
  return {valid:violations.length===0,violations,children,triggerCount:active.length,triggers:active};
}
function executeCoverage(ctx,expr){
  const groups=groupRows(selectRows(ctx,expr),expr.groupBy||[]);
  const results=[],violations=[];
  for(const g of groups){
    const total=g.rows.length, matched=g.rows.filter(r=>matchesPredicate(r,expr.match)).length;
    const ratio=total?matched/total:(expr.emptyRatio??1);
    const actual=expr.metric==="count"?matched:ratio;
    const valid=assertMetric(actual,expr.assert);
    const row={...g.key,matched,total,ratio,actual}; results.push(row);
    if(!valid) violations.push({...row,expected:expr.assert});
  }
  return {valid:violations.length===0,violations,results};
}


function reduceObjectiveValues(values, reduction="sum") {
  const nums=(values || []).map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  if (reduction==="avg") return nums.reduce((a,b)=>a+b,0)/nums.length;
  if (reduction==="min") return Math.min(...nums);
  if (reduction==="max") return Math.max(...nums);
  if (reduction==="count_groups") return nums.length;
  return nums.reduce((a,b)=>a+b,0);
}

function executeObjective(ctx, expr) {
  const groups=groupRows(selectRows(ctx,expr),expr.groupBy || []);
  const measurements=groups.map(g => ({
    ...g.key,
    value: metric(g,expr.metric)
  }));
  const objectiveValue=reduceObjectiveValues(
    measurements.map(x=>x.value),
    expr.reduce || "sum"
  );
  return {
    valid:true,
    violations:[],
    objective:true,
    direction:expr.direction,
    objectiveValue,
    reduction:expr.reduce || "sum",
    measurements
  };
}


function childPenalty(result) {
  if (!result?.supported) return Number.POSITIVE_INFINITY;
  if (result.objective) return Number(result.objectiveValue) || 0;
  return (result.violations || []).length;
}

function executeWeightedObjective(ctx, expr, rule, schedule, schoolData, baselineSchedule) {
  const components=[];
  let objectiveValue=0;
  for (const [index,item] of (expr.children || []).entries()) {
    const weight=Number(item?.weight ?? 1);
    if (!item?.expression || !Number.isFinite(weight) || weight < 0) {
      throw new Error("weighted_objective child requires expression and non-negative numeric weight.");
    }
    const result=evaluateGenericRuleExpression({
      rule,expression:item.expression,schedule,schoolData,baselineSchedule
    });
    if (!result.supported) {
      throw new Error(`weighted_objective child ${index + 1} unsupported: ${result.reason || "unknown"}`);
    }
    const baseCost=childPenalty(result);
    const weightedCost=baseCost*weight;
    objectiveValue+=weightedCost;
    components.push({index,label:item.label || null,weight,baseCost,weightedCost,result});
  }
  return {
    valid:true,violations:[],objective:true,weighted:true,direction:"minimize",
    objectiveValue,components,
    measurements:components.map(c=>({
      label:c.label,weight:c.weight,value:c.baseCost,weightedValue:c.weightedCost
    }))
  };
}

function canonicalScheduleCells(schedule) {
  const map=new Map();
  for (const [dayRaw,classes] of Object.entries(schedule || {})) {
    const day=normalizeRuleDay(dayRaw);
    for (const [className,hours] of Object.entries(classes || {})) {
      for (const [hourRaw,cell] of Object.entries(hours || {})) {
        const ids=[...new Set(cellIds(cell).map(String))].sort();
        if (!ids.length) continue;
        map.set(`${day}::${className}::${Number(hourRaw)}`,ids.join("|"));
      }
    }
  }
  return map;
}

function countChangedCells(candidateSchedule,baselineSchedule) {
  const a=canonicalScheduleCells(candidateSchedule);
  const b=canonicalScheduleCells(baselineSchedule);
  const keys=new Set([...a.keys(),...b.keys()]);
  let count=0;
  const changes=[];
  for (const key of keys) {
    const candidate=a.get(key) || "";
    const baseline=b.get(key) || "";
    if (candidate!==baseline) {
      count++;
      changes.push({key,baseline,candidate});
    }
  }
  return {count,changes};
}

function measurementRows(ctx,spec) {
  return groupRows(selectRows(ctx,spec),spec.groupBy || []).map(g=>({
    ...g.key,value:metric(g,spec.metric)
  }));
}

function measurementGroupKey(row,fields) {
  return (fields || []).map(f=>`${f}=${String(valueAt(row,f) ?? "")}`).join("::");
}

function executeComparativeObjective(ctx, expr, rule, schedule, schoolData, baselineSchedule) {
  if (!baselineSchedule || typeof baselineSchedule!=="object") {
    throw new Error("comparative_objective requires baselineSchedule.");
  }

  if (expr.mode==="changed_cells") {
    const diff=countChangedCells(schedule,baselineSchedule);
    return {
      valid:true,violations:[],objective:true,comparative:true,
      direction:expr.direction || "minimize",
      objectiveValue:diff.count,measurements:diff.changes
    };
  }

  const measure=expr.measure;
  if (!measure?.source || !measure?.metric) {
    throw new Error("comparative_objective measure requires source and metric.");
  }

  const baselineCtx=makeContext(baselineSchedule,schoolData);
  const candidateRows=measurementRows(ctx,measure);
  const baselineRows=measurementRows(baselineCtx,measure);
  const fields=measure.groupBy || [];
  const cMap=new Map(candidateRows.map(r=>[measurementGroupKey(r,fields),r]));
  const bMap=new Map(baselineRows.map(r=>[measurementGroupKey(r,fields),r]));
  const keys=new Set([...cMap.keys(),...bMap.keys()]);
  const comparisons=[];
  let objectiveValue=0;

  for (const key of keys) {
    const c=cMap.get(key) || {};
    const b=bMap.get(key) || {};
    const candidate=Number(c.value) || 0;
    const baseline=Number(b.value) || 0;
    const delta=candidate-baseline;
    const positiveDelta=Math.max(delta,0);
    comparisons.push({
      ...Object.fromEntries(fields.map(f=>[f,c[f] ?? b[f] ?? null])),
      candidate,baseline,delta,positiveDelta
    });
    objectiveValue += expr.mode==="nonincrease_per_group"
      ? positiveDelta
      : Math.abs(delta);
  }

  return {
    valid:true,violations:[],objective:true,comparative:true,
    direction:expr.direction || "minimize",
    objectiveValue,comparisons,measurements:comparisons
  };
}

export function evaluateGenericRuleExpression({rule, expression, schedule, schoolData, baselineSchedule=null}) {
  try {
    const ctx=makeContext(schedule,schoolData);
    let result;
    if (expression.type==="every_placement") result=executeEveryPlacement(ctx,expression);
    else if (expression.type==="aggregate") result=executeAggregate(ctx,expression);
    else if (expression.type==="aggregate_pipeline") result=executeAggregatePipeline(ctx,expression);
    else if (expression.type==="class_end_hour") result=executeClassEndHour(ctx,expression);
    else if (expression.type==="required_slots") result=executeRequiredSlots(ctx,expression);
    else if (expression.type==="exists") result=executeExists(ctx,expression);
    else if (expression.type==="conditional") result=executeConditional(ctx,expression,rule,schedule,schoolData,baselineSchedule);
    else if (expression.type==="coverage") result=executeCoverage(ctx,expression);
    else if (expression.type==="objective") result=executeObjective(ctx,expression);
    else if (expression.type==="weighted_objective") result=executeWeightedObjective(ctx,expression,rule,schedule,schoolData,baselineSchedule);
    else if (expression.type==="comparative_objective") result=executeComparativeObjective(ctx,expression,rule,schedule,schoolData,baselineSchedule);
    else if (expression.type==="and") {
      const children=(expression.children || []).map(child =>
        evaluateGenericRuleExpression({rule,expression:child,schedule,schoolData,baselineSchedule})
      );
      result={valid:children.every(c=>c.valid),violations:children.flatMap(c=>c.violations || []),children};
    } else if (expression.type==="or") {
      const children=(expression.children || []).map(child =>
        evaluateGenericRuleExpression({rule,expression:child,schedule,schoolData,baselineSchedule})
      );
      const valid=children.some(c=>c.supported && c.valid);
      result={
        valid,
        violations:valid ? [] : children.flatMap(c=>c.violations || []),
        children
      };
    } else {
      return {supported:false,valid:null,violations:[],ruleId:rule?.id,reason:`Unsupported generic expression type: ${expression.type}`};
    }
    return {supported:true,ruleId:rule?.id,...result};
  } catch (error) {
    return {supported:false,valid:null,violations:[],ruleId:rule?.id,reason:error?.message || String(error)};
  }
}
