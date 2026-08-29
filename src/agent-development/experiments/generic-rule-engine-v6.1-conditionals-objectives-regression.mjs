
import { evaluateGenericRuleExpression } from "../../src/scheduling/genericRuleEngine.js";
function assert(c,m){if(!c)throw new Error(m);}

const schoolData={
 teachers:[
  {id:"1",name:"Homeroom",educationClass:"א1"},
  {id:"2",name:"Non homeroom"}
 ],
 classes:["א1"],
 constraintGroups:[
  {id:"eng",name:"English"},
  {id:"meet",name:"Meeting",groupKind:"meeting"}
 ],
 teachingUnits:[
  {id:"e1",teacherId:"2",className:"א1",subject:"English",constraintGroupId:"eng"},
  {id:"e2",teacherId:"2",className:"א1",subject:"English",constraintGroupId:"eng"},
  {id:"e3",teacherId:"2",className:"א1",subject:"English",constraintGroupId:"eng"},
  {id:"h1",teacherId:"1",className:"א1",subject:"Math"},
  {id:"m1",teacherId:"1",className:"א1",subject:"Meeting",constraintGroupId:"meet",type:"teamMeeting"}
 ]
};
const schedule={
 א:{א1:{1:["e1"],2:["e2"],3:["e3"]}},
 ו:{א1:{1:["m1"],2:["h1"]}}
};

// Regression for rule-20 logical direction: target group is filter; forbidden hours are assertion.
const english={
 type:"every_placement",source:"placements",
 filters:[{field:"constraintGroupId",op:"eq",value:"eng"}],exclude:[],
 assertions:[{field:"hour",op:"not_in",value:[1,6]}],predicate:null
};
const r20=evaluateGenericRuleExpression({rule:{id:"20"},expression:english,schedule,schoolData});
assert(r20.supported && !r20.valid && r20.violations.length===1,JSON.stringify(r20));

// Teaching/activity summaries differ because Friday hour 1 is a meeting.
const activity={
 type:"aggregate",source:"teacher_activity_days",
 filters:[{field:"teacherId",op:"eq",value:"1"},{field:"day",op:"eq",value:"ו"}],
 groupBy:["teacherId","day"],metric:{type:"field_value",field:"startHour"},assert:{op:"eq",value:1}
};
const teaching=JSON.parse(JSON.stringify(activity));
teaching.source="teacher_teaching_days"; teaching.assert.value=2;
assert(evaluateGenericRuleExpression({rule:{id:"a"},expression:activity,schedule,schoolData}).valid,"activity start");
assert(evaluateGenericRuleExpression({rule:{id:"t"},expression:teaching,schedule,schoolData}).valid,"teaching start");

// Conditional: non-homeroom teacher has >2 teaching hours in class/day => max consecutive <=2.
// Here teacher 2 has 3 consecutive, so it must violate.
const conditional={
 type:"conditional",
 when:{
  source:"teacher_teaching_days",
  filters:[{field:"teacherId",op:"eq",value:"2"},{field:"day",op:"eq",value:"א"}],
  assertions:[{field:"count",op:"gt",value:2}]
 },
 bind:["teacherId","day"],
 then:{
  type:"aggregate",source:"placements",
  filters:[{field:"isInstructionalPlacement",op:"eq",value:true},{field:"className",op:"eq",value:"א1"}],
  exclude:[],groupBy:["teacherId","className","day"],
  metric:{type:"max_consecutive_hours",field:"hour"},
  assert:{op:"lte",value:2}
 }
};
const c=evaluateGenericRuleExpression({rule:{id:"28"},expression:conditional,schedule,schoolData});
assert(c.supported && !c.valid,JSON.stringify(c));

// Coverage: Friday instructional placements of homeroom teacher are in homeroom => 100%.
const coverage={
 type:"coverage",source:"placements",
 filters:[
  {field:"teacherId",op:"eq",value:"1"},
  {field:"day",op:"eq",value:"ו"},
  {field:"isInstructionalPlacement",op:"eq",value:true}
 ],
 exclude:[],groupBy:["teacherId"],
 match:{type:"condition",field:"isHomeroomForClass",op:"eq",value:true},
 metric:"ratio",assert:{op:"eq",value:1}
};
const cov=evaluateGenericRuleExpression({rule:{id:"31"},expression:coverage,schedule,schoolData});
assert(cov.supported && cov.valid,JSON.stringify(cov));

console.log("PASS: rule-20 filter/assertion direction regression.");
console.log("PASS: teaching-day vs activity-day aggregates.");
console.log("PASS: generic conditional IF/THEN.");
console.log("PASS: generic coverage ratio.");
