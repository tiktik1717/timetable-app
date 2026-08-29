
import {
  evaluateGenericRuleExpression
} from "../../src/scheduling/genericRuleEngine.js";
import {
  formalRuleEvaluationsToRuleCheckResults
} from "../../src/scheduling/ruleEvaluator.js";

function assert(c,m){ if(!c) throw new Error(m); }

const schoolData={
  teachers:[
    {id:"11",name:"Teacher 11"},
    {id:"5",name:"Teacher 5"},
    {id:"41",name:"Teacher 41"}
  ],
  classes:["א1"],
  teachingUnits:[
    {id:"a",teacherId:"11",className:"א1",subject:"X"},
    {id:"b",teacherId:"11",className:"א1",subject:"X"},
    {id:"c",teacherId:"5",className:"א1",subject:"X"},
    {id:"d",teacherId:"41",className:"א1",subject:"X"}
  ]
};
const schedule={
  א:{א1:{2:["a"],3:["b"],6:["c"]}},
  ב:{א1:{2:["a"],6:["d"]}},
  ג:{א1:{6:["c"]}}
};

// Rule 29 family: maximize number of teaching days starting at hour 2.
const maximizeLateStart={
  type:"objective",
  direction:"maximize",
  source:"teacher_teaching_days",
  filters:[
    {field:"teacherId",op:"eq",value:"11"},
    {field:"count",op:"gt",value:0},
    {field:"startHour",op:"eq",value:2}
  ],
  exclude:[],
  groupBy:[],
  metric:{type:"count"},
  reduce:"sum"
};
const maxResult=evaluateGenericRuleExpression({
  rule:{id:"29"},expression:maximizeLateStart,schedule,schoolData
});
assert(maxResult.supported && maxResult.objective,JSON.stringify(maxResult));
assert(maxResult.objectiveValue===2,`Expected 2 start-at-2 days: ${JSON.stringify(maxResult)}`);

// Rule 25 family: minimize total distinct sixth-hour days across two teachers.
const minimizeSixth={
  type:"objective",
  direction:"minimize",
  source:"placements",
  filters:[
    {field:"isInstructionalPlacement",op:"eq",value:true},
    {field:"teacherId",op:"in",value:["5","41"]},
    {field:"hour",op:"eq",value:6}
  ],
  exclude:[],
  groupBy:["teacherId"],
  metric:{type:"count_distinct",field:"day"},
  reduce:"sum"
};
const minResult=evaluateGenericRuleExpression({
  rule:{id:"25"},expression:minimizeSixth,schedule,schoolData
});
assert(minResult.objectiveValue===3,`Expected 3 total distinct teacher-days: ${JSON.stringify(minResult)}`);

// Objective results must be surfaced as measured objectives, not "satisfied".
const check=formalRuleEvaluationsToRuleCheckResults([
  {ruleId:"29",...maxResult}
])[0];
assert(check.status==="objective_measured",JSON.stringify(check));
assert(check.objectiveValue===2,JSON.stringify(check));

console.log("PASS: maximize objective measures matching teaching days.");
console.log("PASS: minimize objective reduces per-teacher sixth-hour day counts.");
console.log("PASS: objective evaluator result is surfaced as objective_measured.");
