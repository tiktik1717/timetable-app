
import { evaluateGenericRuleExpression } from "../../src/scheduling/genericRuleEngine.js";
function assert(c,m){if(!c)throw new Error(m);}

const schoolData={
  teachers:[
    {id:"1",name:"Homeroom",educationClass:"א1"},
    {id:"2",name:"Other"}
  ],
  classes:["א1"],
  constraintGroups:[{id:"meet",name:"Meeting",groupKind:"meeting"}],
  teachingUnits:[
    {id:"x1",teacherId:"2",className:"א1",subject:"X"},
    {id:"x2",teacherId:"2",className:"א1",subject:"X"},
    {id:"x3",teacherId:"2",className:"א1",subject:"X"},
    {id:"m1",teacherId:"2",className:"א1",subject:"Meeting",constraintGroupId:"meet",type:"teamMeeting"}
  ]
};

const schedule={
  א:{א1:{1:["x1"],2:["x2"],3:["x3"],4:["m1"]}}
};

// Correct generic Rule 28: aggregate trigger (>2 distinct instructional hours)
// then check the same teacher+class+day for max consecutive instructional hours <=2.
const rule28={
  type:"conditional",
  when:{
    type:"aggregate",
    source:"placements",
    filters:[
      {field:"isInstructionalPlacement",op:"eq",value:true},
      {field:"isHomeroomForClass",op:"eq",value:false}
    ],
    exclude:[],
    groupBy:["teacherId","className","day"],
    metric:{type:"count_distinct",field:"hour"},
    assert:{op:"gt",value:2}
  },
  bind:["teacherId","className","day"],
  then:{
    type:"aggregate",
    source:"placements",
    filters:[
      {field:"isInstructionalPlacement",op:"eq",value:true},
      {field:"isHomeroomForClass",op:"eq",value:false}
    ],
    exclude:[],
    groupBy:["teacherId","className","day"],
    metric:{type:"max_consecutive_hours",field:"hour"},
    assert:{op:"lte",value:2}
  }
};
const r28=evaluateGenericRuleExpression({rule:{id:"28"},expression:rule28,schedule,schoolData});
assert(r28.supported===true,JSON.stringify(r28));
assert(r28.triggerCount===1,`Expected one aggregate trigger: ${JSON.stringify(r28)}`);
assert(r28.valid===false,`Three consecutive hours must violate: ${JSON.stringify(r28)}`);
assert(r28.violations?.[0]?.bindings?.teacherId==="2","Binding propagation failed");

// Old v6.1 raw when selector must be rejected instead of silently producing 0 triggers.
const malformed={
  type:"conditional",
  when:{
    source:"placements",
    filters:[{field:"isHomeroomForClass",op:"eq",value:false}],
    assertions:[{field:"count",op:"gt",value:2}]
  },
  bind:["teacherId","className","day"],
  then:rule28.then
};
const bad=evaluateGenericRuleExpression({rule:{id:"bad"},expression:malformed,schedule,schoolData});
assert(bad.supported===false,`Malformed conditional should be unsupported: ${JSON.stringify(bad)}`);

// Generic Rule 11: meetings are excluded semantically by instructional universe, not IDs.
const rule11={
  type:"aggregate",
  source:"placements",
  filters:[{field:"isInstructionalPlacement",op:"eq",value:true}],
  exclude:[],
  groupBy:["teacherId","className","day"],
  metric:{type:"max_consecutive_hours",field:"hour"},
  assert:{op:"lte",value:3}
};
const r11=evaluateGenericRuleExpression({rule:{id:"11"},expression:rule11,schedule,schoolData});
assert(r11.supported && r11.valid,`Meeting at hour4 must not extend teaching run: ${JSON.stringify(r11)}`);

// Sixth-hour teaching filter: a non-instructional activity at hour 6 must not count.
const schedule2={א:{א1:{6:["m1"]}}};
const sixth={
  type:"aggregate",source:"placements",
  filters:[
    {field:"isInstructionalPlacement",op:"eq",value:true},
    {field:"hour",op:"eq",value:6}
  ],
  exclude:[],groupBy:["teacherId"],
  metric:{type:"count_distinct",field:"day"},
  assert:{op:"lte",value:0}
};
const s=evaluateGenericRuleExpression({rule:{id:"sixth"},expression:sixth,schedule:schedule2,schoolData});
assert(s.supported && s.valid,JSON.stringify(s));

console.log("PASS: conditional WHEN can be a real aggregate expression.");
console.log("PASS: aggregate group bindings propagate into THEN.");
console.log("PASS: legacy raw conditional.when is rejected, not silently satisfied.");
console.log("PASS: instructional universe removes meetings without hard-coded IDs.");
console.log("PASS: non-instructional hour-6 activity is not counted as sixth teaching hour.");
