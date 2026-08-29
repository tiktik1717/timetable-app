
import { evaluateGenericRuleExpression } from "../../src/scheduling/genericRuleEngine.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Minimal dataset with duplicated structural placements in hour 6 and a later hour 7.
const schoolData = {
  teachers: [
    { id: "1", name: "A" },
    { id: "2", name: "B" },
  ],
  classes: ["א1"],
  loadUnits: [
    { id: "u1", teacherId: "1", className: "א1", subject: "X" },
    { id: "u2", teacherId: "1", className: "א1", subject: "X" },
    { id: "u3", teacherId: "1", className: "א1", subject: "X" },
  ],
};

const schedule = {
  א: {
    "א1": {
      6: ["u1", "u2"],
      7: ["u3"],
    },
  },
  ב: {
    "א1": {
      6: ["u1"],
    },
  },
  ג: {
    "א1": {
      6: ["u1"],
    },
  },
};

// Rule 24 semantics: count distinct DAYS containing hour 6.
// Teacher 1 has hour 6 on א,ב,ג => actual must be 3, even though:
// - Sunday also has hour 7 (endHour would be 7)
// - Sunday contains two structural records at hour 6.
const sixthHourDays = {
  type: "aggregate",
  source: "placements",
  filters: [{ field: "hour", op: "eq", value: 6 }],
  groupBy: ["teacherId"],
  metric: { type: "count_distinct", field: "day" },
  assert: { op: "lte", value: 2 },
};

const r1 = evaluateGenericRuleExpression({
  rule: { id: "rule24-regression" },
  expression: sixthHourDays,
  schedule,
  schoolData,
});

assert(r1.supported === true, "Rule 24 regression must be supported");
assert(r1.valid === false, "Three distinct sixth-hour days must violate <=2");
assert(
  r1.violations?.[0]?.actual === 3,
  `Expected 3 distinct days, got ${JSON.stringify(r1.violations)}`,
);

console.log("PASS: distinct sixth-hour days are counted by placement hour, not endHour.");
