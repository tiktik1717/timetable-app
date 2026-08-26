
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

function makeContext(schedule, schoolData) {
  const units = schoolData?.teachingUnits || [];
  const unitsById = new Map(units.map(u => [String(u.id), u]));
  const teachersById = new Map((schoolData?.teachers || []).map(t => [String(t.id), t]));
  const homeroomByClass = new Map(
    (schoolData?.teachers || [])
      .filter(t => t?.educationClass)
      .map(t => [String(t.educationClass), String(t.id)])
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
          placements.push({
            kind: "placement", day, hour, className,
            grade: gradeOf(className), unitId: String(unitId),
            teacherId: unit.teacherId == null ? null : String(unit.teacherId),
            constraintGroupId: unit.constraintGroupId == null ? null : String(unit.constraintGroupId),
            constraintGroupName: unit.constraintGroupId == null ? null : String(groupsById.get(String(unit.constraintGroupId))?.name || groupsById.get(String(unit.constraintGroupId))?.label || ""),
            subject: unit.subject ?? unit.subjectName ?? null,
            unitType: unit.type ?? null,
            isHomeroomForClass: homeroomByClass.get(String(className)) === String(unit.teacherId),
          });
        }
      }
    }
  }
  const days=[...new Set(Object.keys(schedule || {}).map(normalizeRuleDay))];
  const classDays=[];
  for (const className of studentClasses) for (const day of days) {
    const rs=placements.filter(p=>p.className===className && p.day===day);
    const hs=[...new Set(rs.map(r=>Number(r.hour)).filter(Number.isFinite))].sort((a,b)=>a-b);
    classDays.push({kind:"class_day",className,grade:gradeOf(className),day,count:rs.length,distinctHours:hs.length,startHour:hs.length?hs[0]:0,endHour:hs.length?hs[hs.length-1]:0,gapCount:hs.length?(hs[hs.length-1]-hs[0]+1)-hs.length:0,maxConsecutiveHours:maxConsecutive(hs)});
  }
  const gradeDays=[];
  const grades=[...new Set([...studentClasses].map(gradeOf))];
  for (const grade of grades) for (const day of days) {
    const members=classDays.filter(x=>x.grade===grade && x.day===day);
    const ends=members.map(x=>x.endHour);
    const allEqual=new Set(ends).size<=1;
    gradeDays.push({kind:"grade_day",grade,day,classCount:members.length,allEqualEndHour:allEqual,endHour:allEqual && ends.length?ends[0]:null});
  }
  const teacherDays=[];
  for (const teacherId of teachersById.keys()) for (const day of days) {
    const rs=placements.filter(p=>p.teacherId===teacherId && p.day===day);
    const hs=[...new Set(rs.map(r=>Number(r.hour)).filter(Number.isFinite))].sort((a,b)=>a-b);
    teacherDays.push({kind:"teacher_day",teacherId,day,count:rs.length,distinctHours:hs.length,startHour:hs.length?hs[0]:0,endHour:hs.length?hs[hs.length-1]:0,gapCount:hs.length?(hs[hs.length-1]-hs[0]+1)-hs.length:0,maxConsecutiveHours:maxConsecutive(hs)});
  }
  return { schedule, schoolData, unitsById, teachersById, studentClasses, homeroomByClass, placements, classDays, gradeDays, teacherDays };
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
  if (type === "field_value") {
    if (!rows.length) return 0;
    const values = rows.map(r => Number(valueAt(r, metricSpec.field))).filter(Number.isFinite);
    if (!values.length) return 0;
    // Summary sources such as teacher_days/class_days normally contain one row per group.
    // If a caller groups more broadly, summing preserves the meaning of an already-computed count field.
    return values.reduce((sum, value) => sum + value, 0);
  }
  if (type === "count_distinct") return new Set(rows.map(r => String(valueAt(r, metricSpec.field)))).size;
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
  for (const assertion of expr.assertions || []) {
    const actual = rows.length ? valueAt(rows[0], assertion.field) : null;
    if (!compare(actual, assertion.op || "eq", assertion.value)) {
      violations.push({field:assertion.field,actual,expected:{op:assertion.op || "eq",value:assertion.value}});
    }
  }
  return {valid:violations.length===0,violations,results:rows};
}

function executeEveryPlacement(ctx, expr) {
  const rows=selectRows(ctx,expr);
  const violations=rows.filter(row => {
    if (expr.predicate) return !matchesPredicate(row, expr.predicate);
    return !(expr.assertions || []).every(a =>
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

export function evaluateGenericRuleExpression({rule, expression, schedule, schoolData}) {
  try {
    const ctx=makeContext(schedule,schoolData);
    let result;
    if (expression.type==="every_placement") result=executeEveryPlacement(ctx,expression);
    else if (expression.type==="aggregate") result=executeAggregate(ctx,expression);
    else if (expression.type==="aggregate_pipeline") result=executeAggregatePipeline(ctx,expression);
    else if (expression.type==="class_end_hour") result=executeClassEndHour(ctx,expression);
    else if (expression.type==="required_slots") result=executeRequiredSlots(ctx,expression);
    else if (expression.type==="and") {
      const children=(expression.children || []).map(child =>
        evaluateGenericRuleExpression({rule,expression:child,schedule,schoolData})
      );
      result={valid:children.every(c=>c.valid),violations:children.flatMap(c=>c.violations || []),children};
    } else {
      return {supported:false,valid:null,violations:[],ruleId:rule?.id,reason:`Unsupported generic expression type: ${expression.type}`};
    }
    return {supported:true,ruleId:rule?.id,...result};
  } catch (error) {
    return {supported:false,valid:null,violations:[],ruleId:rule?.id,reason:error?.message || String(error)};
  }
}
