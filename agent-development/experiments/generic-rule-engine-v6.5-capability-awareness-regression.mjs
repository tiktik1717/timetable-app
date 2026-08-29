
import {
  evaluateGenericRuleExpression,
  GENERIC_RULE_DSL_CAPABILITIES
} from "../../src/scheduling/genericRuleEngine.js";

function assert(c,m){ if(!c) throw new Error(m); }

assert(GENERIC_RULE_DSL_CAPABILITIES.expressions.aggregate_pipeline, "pipeline absent");
assert(GENERIC_RULE_DSL_CAPABILITIES.metrics.max_consecutive_hours, "sequence metric absent");
assert(GENERIC_RULE_DSL_CAPABILITIES.metrics.count_where, "count_where absent");
assert(GENERIC_RULE_DSL_CAPABILITIES.metrics.sum, "sum absent");

const schoolData={
  teachers:[{id:"1",name:"T1"},{id:"2",name:"T2"}],
  classes:["א1"],
  constraintGroups:[{id:"g1",name:"Target 1"},{id:"g2",name:"Target 2"}],
  teachingUnits:[
    {id:"g1a",teacherId:"1",className:"א1",subject:"A",constraintGroupId:"g1"},
    {id:"g1b",teacherId:"1",className:"א1",subject:"A",constraintGroupId:"g1"},
    {id:"g2a",teacherId:"2",className:"א1",subject:"B",constraintGroupId:"g2"},
    {id:"g2b",teacherId:"2",className:"א1",subject:"B",constraintGroupId:"g2"}
  ]
};
const schedule={
  א:{א1:{2:["g1a","g2a"],3:["g1b"],4:["g2b"]}},
  ב:{א1:{4:["g1a","g2a"]}},
  ג:{א1:{5:["g1a","g2a"]}}
};

const weeklyPattern={
  type:"aggregate_pipeline",
  source:"placements",
  filters:[
    {field:"constraintGroupId",op:"in",value:["g1","g2"]},
    {field:"isInstructionalPlacement",op:"eq",value:true}
  ],
  exclude:[],
  stages:[
    {
      groupBy:["constraintGroupId","day"],
      metrics:[
        {as:"hourCount",type:"count_distinct",field:"hour"},
        {as:"maxRun",type:"max_consecutive_hours",field:"hour"}
      ]
    },
    {
      groupBy:["constraintGroupId"],
      metrics:[
        {as:"daysWith2",type:"count_where",field:"hourCount",where:{field:"hourCount",op:"eq",value:2}},
        {as:"daysWith1",type:"count_where",field:"hourCount",where:{field:"hourCount",op:"eq",value:1}},
        {as:"daysWithRun2",type:"count_where",field:"maxRun",where:{field:"maxRun",op:"eq",value:2}},
        {as:"totalHours",type:"sum",field:"hourCount"}
      ]
    }
  ],
  assertions:[
    {field:"daysWith2",op:"eq",value:1},
    {field:"daysWith1",op:"eq",value:2},
    {field:"daysWithRun2",op:"eq",value:1},
    {field:"totalHours",op:"eq",value:4}
  ]
};

const r=evaluateGenericRuleExpression({
  rule:{id:"unseen-weekly-pattern"},
  expression:weeklyPattern,
  schedule,
  schoolData
});
assert(r.supported===true,JSON.stringify(r));
assert(r.results?.length===2,JSON.stringify(r));
assert(r.valid===false,JSON.stringify(r));
assert(r.violations.some(v=>v.constraintGroupId==="g2" && v.field==="daysWithRun2"),JSON.stringify(r));
assert(!r.violations.some(v=>v.constraintGroupId==="g1"),JSON.stringify(r));

const orRule={
  type:"or",
  children:[
    {
      type:"every_placement",source:"placements",
      filters:[{field:"teacherId",op:"eq",value:"1"}],exclude:[],
      assertions:[{field:"hour",op:"eq",value:99}],predicate:null
    },
    {
      type:"every_placement",source:"placements",
      filters:[{field:"teacherId",op:"eq",value:"1"}],exclude:[],
      assertions:[{field:"day",op:"in",value:["א","ב","ג"]}],predicate:null
    }
  ]
};
const orResult=evaluateGenericRuleExpression({
  rule:{id:"or"},expression:orRule,schedule,schoolData
});
assert(orResult.supported && orResult.valid,JSON.stringify(orResult));

console.log("PASS: machine-readable capability catalog.");
console.log("PASS: generic weekly distribution composition.");
console.log("PASS: pipeline assertions cover every final group.");
console.log("PASS: sum metric on derived pipeline rows.");
console.log("PASS: OR composition.");
