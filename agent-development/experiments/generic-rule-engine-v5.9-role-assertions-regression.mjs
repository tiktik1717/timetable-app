
import { evaluateGenericRuleExpression } from "../../src/scheduling/genericRuleEngine.js";

function assert(c,m){ if(!c) throw new Error(m); }

const schoolData={
  teachers:[
    {id:"1",name:"Homeroom A",educationClass:"א1"},
    {id:"21",name:"Teacher 21"},
    {id:"2",name:"Other"}
  ],
  classes:["א1","א2"],
  teachingUnits:[
    {id:"hA",teacherId:"1",className:"א1",subject:"X"},
    {id:"hB",teacherId:"1",className:"א2",subject:"Y"},
    {id:"u21a",teacherId:"21",className:"א2",subject:"Z"},
    {id:"u21b",teacherId:"21",className:"א2",subject:"Z"}
  ]
};

const schedule={
  א:{
    א1:{3:["hA"]},
    א2:{1:["hB"]}
  },
  ג:{
    א2:{2:["u21a"]}
  },
  ה:{
    א2:{3:["u21b"]}
  }
};

// Homeroom teacher 1 starts Sunday in א2, not his homeroom א1.
// The generic rule must therefore detect a violation.
const homeroomStart={
  type:"every_placement",
  source:"placements",
  filters:[
    {field:"isHomeroomTeacher",op:"eq",value:true},
    {field:"isTeacherFirstTeachingSlot",op:"eq",value:true}
  ],
  exclude:[],
  assertions:[
    {field:"isHomeroomForClass",op:"eq",value:true}
  ],
  predicate:null
};

const r1=evaluateGenericRuleExpression({
  rule:{id:"homeroom-start"},
  expression:homeroomStart,
  schedule,schoolData
});
assert(r1.supported===true,"homeroom rule should be supported");
assert(r1.valid===false,"wrong first homeroom placement should violate");
assert(r1.violations?.[0]?.isHomeroomTeacher===true,"role metadata missing");
assert(r1.violations?.[0]?.homeroomClassName==="א1","homeroom class metadata missing");

// Rule 6 generic pattern: teacher 21 only Tue/Thu and never hour 1.
const rule6={
  type:"and",
  children:[
    {
      type:"every_placement",source:"placements",
      filters:[{field:"teacherId",op:"eq",value:"21"}],
      exclude:[],
      assertions:[{field:"day",op:"in",value:["ג","ה"]}],
      predicate:null
    },
    {
      type:"every_placement",source:"placements",
      filters:[{field:"teacherId",op:"eq",value:"21"}],
      exclude:[],
      assertions:[{field:"hour",op:"neq",value:1}],
      predicate:null
    }
  ]
};
const r2=evaluateGenericRuleExpression({
  rule:{id:"rule6"},
  expression:rule6,
  schedule,schoolData
});
assert(r2.supported===true && r2.valid===true,JSON.stringify(r2));

// Vacuous every_placement must not silently pass.
const vacuous={
  type:"every_placement",source:"placements",
  filters:[{field:"teacherId",op:"eq",value:"1"}],
  exclude:[],assertions:[],predicate:null
};
const r3=evaluateGenericRuleExpression({
  rule:{id:"vacuous"},
  expression:vacuous,
  schedule,schoolData
});
assert(r3.supported===false,"vacuous every_placement must be unsupported");

console.log("PASS: generic homeroom-role metadata detects incorrect first placement.");
console.log("PASS: generic negative assertion formalizes teacher allowed-days + blocked-hour rule.");
console.log("PASS: vacuous every_placement is rejected instead of passing tautologically.");
