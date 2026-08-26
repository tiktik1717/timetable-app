
import fs from "node:fs";
import { evaluateFormalRules } from "../src/scheduling/ruleEvaluator.js";

const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const { schoolData, schedule } = input;

const emptyTargets = () => ({
  teacherIds: [],
  classNames: [],
  grades: [],
  constraintGroupIds: [],
});
const params = (x={}) => ({
  days: [],
  hours: [],
  min: null,
  max: null,
  exact: null,
  count: null,
  value: null,
  ...x,
});

const rules = [
  {
    id: "r-grade-he",
    evaluatorKey: "compound",
    formalRule: {
      version: 2,
      operator: "AND",
      severity: "critical",
      clauses: [
        {
          id: "c1",
          scope: "grade",
          constraint: "same_end_hour_each_day",
          evaluatorKey: "grade_same_end_hour",
          targets: { ...emptyTargets(), grades: ["ה"] },
          params: params(),
          logic: "all",
        },
        {
          id: "c2",
          scope: "grade",
          constraint: "exact_end_hour",
          evaluatorKey: "grade_exact_end_hour",
          targets: { ...emptyTargets(), grades: ["ה"] },
          params: params({ days: ["א"], exact: 6 }),
          logic: "all",
        },
      ],
    },
  },
  {
    id: "r-21",
    evaluatorKey: "compound",
    formalRule: {
      version: 2,
      operator: "AND",
      severity: "critical",
      clauses: [
        {
          id: "c1",
          scope: "teacher",
          constraint: "allowed_days_only",
          evaluatorKey: "teacher_allowed_days",
          targets: { ...emptyTargets(), teacherIds: ["21"] },
          params: params({ days: ["ג", "ה"] }),
          logic: "all",
        },
        {
          id: "c2",
          scope: "teacher_day",
          constraint: "blocked_hours",
          evaluatorKey: "teacher_blocked_hours",
          targets: { ...emptyTargets(), teacherIds: ["21"] },
          params: params({ days: ["ג", "ה"], hours: [1] }),
          logic: "all",
        },
      ],
    },
  },
  {
    id: "r-25",
    evaluatorKey: "teacher_blocked_hours",
    formalRule: {
      version: 1,
      scope: "teacher_day",
      constraint: "blocked_hours",
      targets: { ...emptyTargets(), teacherIds: ["25"] },
      params: params({ days: ["ג"], hours: [1,2] }),
      logic: "all",
      severity: "critical",
    },
  },
  {
    id: "r-friday-homeroom",
    evaluatorKey: "homeroom_first_hours",
    formalRule: {
      version: 1,
      scope: "class_day",
      constraint: "homeroom_first_hours",
      targets: emptyTargets(),
      params: params({ days: ["ו"], count: 2 }),
      logic: "all",
      severity: "critical",
    },
  },
  {
    id: "r-nonhomeroom-max3",
    evaluatorKey: "non_homeroom_max_hours_same_class_day",
    formalRule: {
      version: 1,
      scope: "teacher_class_day",
      constraint: "max_hours_same_class_day_if_not_homeroom",
      targets: emptyTargets(),
      params: params({ max: 3 }),
      logic: "all",
      severity: "critical",
    },
  },
];

const results = evaluateFormalRules({ rules, schedule, schoolData });
console.log(JSON.stringify(results, null, 2));
