
import { evaluateGenericRuleExpression } from "../../src/scheduling/genericRuleEngine.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const schoolData = {
  teachers: [
    { id: "1", name: "Teacher 1" },
    { id: "2", name: "Teacher 2" },
    { id: "38", name: "Excluded Teacher" },
  ],
  classes: ["א1", "א2", "א3"],
  teachingUnits: [
    { id: "u1", teacherId: "1", className: "א1", subject: "X" },
    { id: "u2", teacherId: "1", className: "א1", subject: "X" },
    { id: "u3", teacherId: "1", className: "א1", subject: "X" },
    { id: "v1", teacherId: "2", className: "א2", subject: "Y" },
    { id: "v2", teacherId: "2", className: "א2", subject: "Y" },
    { id: "v3", teacherId: "2", className: "א2", subject: "Y" },
  ],
};

const schedule = {
  א: { א1: { 6:["u1"], 7:["u2"] }, א2:{1:["v1"],3:["v2"],5:["v3"]} },
  ב: { א1: { 6:["u1"] }, א2:{1:["v1"],4:["v2"]} },
  ג: { א1: { 6:["u1"] } },
  ד: { א1: { 5:["u1"] } },
};

// Regression 1: count_distinct(where) must count only days whose placement is hour 6.
// Teacher 1 has hour 6 on א/ב/ג = 3 days, plus hour 5 on ד.
const sixthHourDays = {
  type:"aggregate",
  source:"placements",
  filters:[{field:"teacherId",op:"eq",value:"1"}],
  exclude:[],
  groupBy:["teacherId"],
  metric:{
    type:"count_distinct",
    field:"day",
    where:{field:"hour",op:"eq",value:6}
  },
  assert:{op:"eq",value:3}
};

const r1 = evaluateGenericRuleExpression({
  rule:{id:"where-count-distinct"},
  expression:sixthHourDays,
  schedule,
  schoolData,
});
assert(r1.supported && r1.valid, `count_distinct(where) failed: ${JSON.stringify(r1)}`);

// Regression 2a: two NON-consecutive single gaps must be allowed by maxConsecutiveGapHours<=1.
// Sunday Teacher 2 teaches 1,3,5 -> gaps at 2 and 4, longest gap run = 1.
const separatedGaps = {
  type:"aggregate",
  source:"teacher_days",
  filters:[
    {field:"teacherId",op:"eq",value:"2"},
    {field:"day",op:"eq",value:"א"},
    {field:"count",op:"gt",value:0}
  ],
  exclude:[],
  groupBy:["teacherId","day"],
  metric:{type:"field_value",field:"maxConsecutiveGapHours"},
  assert:{op:"lte",value:1}
};
const r2 = evaluateGenericRuleExpression({
  rule:{id:"separated-gaps"},
  expression:separatedGaps,
  schedule,
  schoolData,
});
assert(r2.supported && r2.valid, `separated gaps incorrectly failed: ${JSON.stringify(r2)}`);

// Regression 2b: two CONSECUTIVE gaps must violate <=1.
// Monday Teacher 2 teaches 1,4 -> free hours 2+3 consecutively.
const consecutiveGaps = {
  ...separatedGaps,
  filters:[
    {field:"teacherId",op:"eq",value:"2"},
    {field:"day",op:"eq",value:"ב"},
    {field:"count",op:"gt",value:0}
  ],
};
const r3 = evaluateGenericRuleExpression({
  rule:{id:"consecutive-gaps"},
  expression:consecutiveGaps,
  schedule,
  schoolData,
});
assert(r3.supported && !r3.valid, `consecutive gaps should violate: ${JSON.stringify(r3)}`);
assert(r3.violations?.[0]?.actual === 2, `expected longest gap run 2: ${JSON.stringify(r3)}`);

console.log("PASS: count_distinct(where) filters rows correctly.");
console.log("PASS: separated single gaps are not treated as a 2-hour consecutive gap.");
console.log("PASS: a true 2-hour consecutive gap is detected.");
