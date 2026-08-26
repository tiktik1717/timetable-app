
import fs from "node:fs";
import { evaluateFormalRules } from "../src/scheduling/ruleEvaluator.js";

const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const schoolData = input.schoolData;
const schedule = input.schedule;

const rules = [
  {
    id: "test-grade-d",
    originalText: "כל כיתות ד' חייבות לסיים בכל יום באותה שעה.",
    evaluatorKey: "grade_same_end_hour",
    formalRule: {
      version: 1,
      scope: "grade",
      constraint: "same_end_hour_each_day",
      targets: { teacherIds: [], classNames: [], grades: ["ד"], constraintGroupIds: [] },
      params: { days: [], hours: [], min: null, max: null, exact: null, count: null, value: null },
      logic: "all",
      severity: "critical"
    }
  },
  {
    id: "test-teacher-10",
    originalText: "למורה גימני ליאור אסור שיהיו חלונות במערכת.",
    evaluatorKey: "teacher_no_internal_gaps",
    formalRule: {
      version: 1,
      scope: "teacher_day",
      constraint: "no_internal_gaps",
      targets: { teacherIds: ["10"], classNames: [], grades: [], constraintGroupIds: [] },
      params: { days: [], hours: [], min: null, max: null, exact: null, count: null, value: null },
      logic: "all",
      severity: "critical"
    }
  },
  {
    id: "test-class-gaps",
    originalText: "אסור שלכיתה יהיה חור באמצע או בתחילת יום הלימודים.",
    evaluatorKey: "class_no_internal_gaps",
    formalRule: {
      version: 1,
      scope: "class_day",
      constraint: "no_gaps_from_first_hour",
      targets: { teacherIds: [], classNames: [], grades: [], constraintGroupIds: [] },
      params: { days: [], hours: [], min: null, max: null, exact: null, count: null, value: null },
      logic: "all",
      severity: "critical"
    }
  }
];

const results = evaluateFormalRules({ rules, schedule, schoolData });
console.log(JSON.stringify(results, null, 2));
