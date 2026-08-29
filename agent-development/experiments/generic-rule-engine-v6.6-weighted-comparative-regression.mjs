
import { evaluateGenericRuleExpression } from "../../src/scheduling/genericRuleEngine.js";
function assert(c,m){ if(!c) throw new Error(m); }

const schoolData={
  teachers:[
    {id:"1",name:"H1",educationClass:"א1"},
    {id:"33",name:"Special",educationClass:"א2"},
    {id:"5",name:"T5"}
  ],
  classes:["א1","א2"],
  teachingUnits:[
    {id:"a",teacherId:"1",className:"א2",subject:"X"},
    {id:"b",teacherId:"33",className:"א1",subject:"Y"},
    {id:"c",teacherId:"5",className:"א1",subject:"Z"}
  ]
};
const baseline={א:{א1:{1:["c"]},א2:{1:["a"]}},ב:{א1:{6:["c"]}}};
const candidate={א:{א1:{1:["b"]},א2:{1:["a"]}},ב:{א1:{6:["c"]}},ג:{א1:{6:["c"]}}};

const firstHomeroom={
  type:"every_placement",source:"placements",
  filters:[
    {field:"isHomeroomTeacher",op:"eq",value:true},
    {field:"isInstructionalPlacement",op:"eq",value:true},
    {field:"isTeacherFirstTeachingSlot",op:"eq",value:true}
  ],
  exclude:[],assertions:[{field:"isHomeroomForClass",op:"eq",value:true}],predicate:null
};
const special=JSON.parse(JSON.stringify(firstHomeroom));
special.filters.push({field:"teacherId",op:"eq",value:"33"});
const weighted={type:"weighted_objective",children:[
  {label:"general",weight:1,expression:firstHomeroom},
  {label:"special",weight:2,expression:special}
]};
const w=evaluateGenericRuleExpression({rule:{id:"22"},expression:weighted,schedule:candidate,schoolData,baselineSchedule:baseline});
assert(w.supported && w.objective && w.weighted,JSON.stringify(w));
assert(w.objectiveValue===4,`Expected general 2 + special 2 = 4: ${JSON.stringify(w)}`);

const changed={type:"comparative_objective",mode:"changed_cells",direction:"minimize"};
const ch=evaluateGenericRuleExpression({rule:{id:"17"},expression:changed,schedule:candidate,schoolData,baselineSchedule:baseline});
assert(ch.supported && ch.comparative && ch.objective,JSON.stringify(ch));
assert(ch.objectiveValue===2,`Expected two changed cells: ${JSON.stringify(ch)}`);

const nonincrease={
  type:"comparative_objective",mode:"nonincrease_per_group",direction:"minimize",
  measure:{
    source:"placements",
    filters:[
      {field:"isInstructionalPlacement",op:"eq",value:true},
      {field:"hour",op:"eq",value:6}
    ],
    exclude:[],groupBy:["teacherId"],metric:{type:"count_distinct",field:"day"}
  }
};
const ni=evaluateGenericRuleExpression({rule:{id:"18"},expression:nonincrease,schedule:candidate,schoolData,baselineSchedule:baseline});
assert(ni.supported && ni.objectiveValue===1,JSON.stringify(ni));
assert(ni.comparisons.some(x=>x.teacherId==="5" && x.baseline===1 && x.candidate===2 && x.positiveDelta===1),JSON.stringify(ni));

const missing=evaluateGenericRuleExpression({rule:{id:"bad"},expression:changed,schedule:candidate,schoolData});
assert(missing.supported===false,JSON.stringify(missing));

console.log("PASS: weighted relative preference scoring.");
console.log("PASS: baseline changed-cell objective.");
console.log("PASS: nonincrease-per-group baseline objective.");
console.log("PASS: missing baseline is rejected.");
