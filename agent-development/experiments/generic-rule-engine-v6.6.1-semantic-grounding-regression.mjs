
import { evaluateGenericRuleExpression } from "../../src/scheduling/genericRuleEngine.js";

function assert(c,m){ if(!c) throw new Error(m); }

const schoolData={
  teachers:[
    {id:"33",name:"Special",educationClass:"א1"},
    {id:"44",name:"T44"}
  ],
  classes:["א1","ג1"],
  constraintGroups:[{id:"g","name":"Target Group"}],
  teachingUnits:[
    {id:"s",teacherId:"33",className:"ג1",subject:"X"},
    {id:"x",teacherId:"44",className:"ג1",subject:"X"},
    {id:"g1",teacherId:"44",className:"ג1",subject:"X",constraintGroupId:"g"}
  ]
};

const schedule={
  א:{ג1:{6:["x"]}},
  ג:{ג1:{6:["g1"]}},
  ה:{ג1:{1:["s"]}}
};

// Partial temporal requirement: no day supplied, so any day at hour 6 is acceptable.
const existsRule={
  type:"exists",source:"placements",
  filters:[
    {field:"teacherId",op:"eq",value:"44"},
    {field:"className",op:"eq",value:"ג1"},
    {field:"hour",op:"eq",value:6},
    {field:"isInstructionalPlacement",op:"eq",value:true}
  ],
  exclude:[],minCount:1,maxCount:null
};
const ex=evaluateGenericRuleExpression({rule:{id:"33"},expression:existsRule,schedule,schoolData});
assert(ex.supported && ex.valid && ex.count>=1,JSON.stringify(ex));

// "Only Tuesday at hour 6": every occurrence must be in the exclusive scope.
const onlyRule={
  type:"every_placement",source:"placements",
  filters:[{field:"constraintGroupId",op:"eq",value:"g"}],
  exclude:[],
  assertions:[
    {field:"day",op:"eq",value:"ג"},
    {field:"hour",op:"eq",value:6}
  ],
  predicate:null
};
const only=evaluateGenericRuleExpression({rule:{id:"39"},expression:onlyRule,schedule,schoolData});
assert(only.supported && only.valid,JSON.stringify(only));

const scheduleBad={
  ...schedule,
  ד:{ג1:{5:["g1"]}}
};
const onlyBad=evaluateGenericRuleExpression({rule:{id:"39"},expression:onlyRule,schedule:scheduleBad,schoolData});
assert(onlyBad.supported && !onlyBad.valid && onlyBad.violations.length===1,JSON.stringify(onlyBad));

// Disjoint weighted semantics: special teacher is excluded from general component.
const general={
  type:"every_placement",source:"placements",
  filters:[
    {field:"isHomeroomTeacher",op:"eq",value:true},
    {field:"isTeacherFirstTeachingSlot",op:"eq",value:true}
  ],
  exclude:[{field:"teacherId",op:"eq",value:"33"}],
  assertions:[{field:"isHomeroomForClass",op:"eq",value:true}],
  predicate:null
};
const special={
  type:"every_placement",source:"placements",
  filters:[
    {field:"teacherId",op:"eq",value:"33"},
    {field:"isTeacherFirstTeachingSlot",op:"eq",value:true}
  ],
  exclude:[],
  assertions:[{field:"isHomeroomForClass",op:"eq",value:true}],
  predicate:null
};
const weighted={
  type:"weighted_objective",
  children:[
    {label:"general",weight:1,expression:general},
    {label:"special",weight:2,expression:special}
  ]
};
const w=evaluateGenericRuleExpression({rule:{id:"22"},expression:weighted,schedule,schoolData});
assert(w.supported && w.objective && w.objectiveValue===2,JSON.stringify(w));

console.log("PASS: exists leaves unspecified day free.");
console.log("PASS: exclusivity checks every matching placement, not mere existence.");
console.log("PASS: weighted special=2 is disjoint from general=1.");
